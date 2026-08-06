import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { DB_PROVIDER } from "@/lib/db-config";

// Better Auth mengelola tabel auth_* sendiri. Profil sisi-thesis (users) ditautkan lewat
// users.auth_user_id + email (databaseHook di bawah). SSO-ready: di produksi set
// BETTER_AUTH_URL=https://thesis.maubisa.id + cookie `.maubisa.id` (percaya sesi Better Auth pusat).
const AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

function isMaubisaHost(rawUrl: string): boolean {
  try {
    const host = new URL(rawUrl).hostname.toLowerCase();
    return host === "maubisa.id" || host.endsWith(".maubisa.id");
  } catch {
    return false;
  }
}

// Domain cookie SSO. Default `.maubisa.id` bila AUTH_URL di bawah maubisa.id. Lokal: host-only.
const COOKIE_DOMAIN = (() => {
  const raw = process.env.AUTH_COOKIE_DOMAIN;
  if (raw !== undefined && raw !== "") {
    return raw.toLowerCase() === "host" ? undefined : raw;
  }
  return isMaubisaHost(AUTH_URL) ? ".maubisa.id" : undefined;
})();

const ownOrigin = (() => {
  try {
    return new URL(AUTH_URL).origin;
  } catch {
    return null;
  }
})();
const SSO_ORIGINS =
  COOKIE_DOMAIN === ".maubisa.id"
    ? ["https://maubisa.id", "https://akun.maubisa.id", "https://thesis.maubisa.id"]
    : [];
const TRUSTED_ORIGINS = Array.from(
  new Set([ownOrigin, ...SSO_ORIGINS, "http://localhost:3100"].filter(Boolean)),
) as string[];

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: DB_PROVIDER }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: AUTH_URL,
  trustedOrigins: TRUSTED_ORIGINS,
  // Batasi brute-force di endpoint auth (Fondasi §5.2 rate-limit).
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 8 },
      "/sign-up/email": { window: 60, max: 5 },
    },
  },
  advanced: COOKIE_DOMAIN
    ? { crossSubDomainCookies: { enabled: true, domain: COOKIE_DOMAIN } }
    : undefined,
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
    minPasswordLength: 8,
  },
  user: { modelName: "authUser" },
  session: { modelName: "authSession" },
  account: { modelName: "authAccount" },
  verification: { modelName: "authVerification" },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Buat/tautkan profil sisi-thesis (users) berdasar email (dikunci UNIQUE).
          // Peran default 'klien'; email di ADMIN_EMAILS otomatis jadi 'admin' (bootstrap owner).
          const role = ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : "klien";
          try {
            await prisma.user.upsert({
              where: { email: user.email },
              update: { authUserId: user.id, name: user.name },
              create: {
                authUserId: user.id,
                name: user.name,
                email: user.email,
                role,
                emailVerifiedAt: user.emailVerified ? new Date() : null,
              },
            });
          } catch {
            /* pembuatan profil best-effort; jangan gagalkan signup auth */
          }
        },
      },
    },
  },
});
