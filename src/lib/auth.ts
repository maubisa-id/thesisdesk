import { betterAuth } from "better-auth";
import { genericOAuth } from "better-auth/plugins";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "@/lib/prisma";
import { DB_PROVIDER } from "@/lib/db-config";

// Better Auth mengelola tabel auth_* sendiri. Profil sisi-thesis (users) ditautkan lewat
// users.auth_user_id + email (databaseHook di bawah). SSO-ready: untuk berbagi sesi lintas-
// subdomain dengan hub akun Anda, set AUTH_COOKIE_DOMAIN (mis. ".contoh.id") + TRUSTED_SSO_ORIGINS.
const AUTH_URL = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";

// Domain cookie SSO (opsional). Kosong/tak diset -> cookie host-only (default aman, tanpa SSO
// lintas-subdomain). Set AUTH_COOKIE_DOMAIN (mis. ".contoh.id") untuk mengaktifkan.
const COOKIE_DOMAIN = (() => {
  const raw = process.env.AUTH_COOKIE_DOMAIN;
  if (raw === undefined || raw === "" || raw.toLowerCase() === "host") return undefined;
  return raw;
})();

const ownOrigin = (() => {
  try {
    return new URL(AUTH_URL).origin;
  } catch {
    return null;
  }
})();
// Origin hub yang dipercaya untuk SSO lintas-subdomain (opsional, dipisah koma), mis.
// TRUSTED_SSO_ORIGINS="https://akun.contoh.id,https://contoh.id". Relevan hanya bila
// COOKIE_DOMAIN diaktifkan di atas.
const SSO_ORIGINS = (process.env.TRUSTED_SSO_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const TRUSTED_ORIGINS = Array.from(
  new Set([ownOrigin, ...SSO_ORIGINS, "http://localhost:3100"].filter(Boolean)),
) as string[];

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

// SSO kampus (OIDC generik, opsional). Aktif hanya bila OIDC_* diset. Cocok untuk Google Workspace,
// Microsoft Entra, Keycloak, dsb. SAML/LDAP di luar cakupan (butuh add-on terpisah).
const oidcEnabled = Boolean(
  process.env.OIDC_CLIENT_ID && process.env.OIDC_CLIENT_SECRET && process.env.OIDC_DISCOVERY_URL,
);
const oidcPlugins = oidcEnabled
  ? [
      genericOAuth({
        config: [
          {
            providerId: "campus",
            clientId: process.env.OIDC_CLIENT_ID as string,
            clientSecret: process.env.OIDC_CLIENT_SECRET as string,
            discoveryUrl: process.env.OIDC_DISCOVERY_URL as string,
            scopes: ["openid", "email", "profile"],
          },
        ],
      }),
    ]
  : [];

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
  plugins: oidcPlugins,
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // Buat/tautkan profil sisi-thesis (users) berdasar email (dikunci UNIQUE).
          // Peran default 'klien'; email di ADMIN_EMAILS otomatis jadi 'admin' (bootstrap owner).
          const role = ADMIN_EMAILS.has(user.email.toLowerCase()) ? "admin" : "klien";
          try {
            // Tag tenant: institusi singleton aktif (multi-tenant foundation). null bila belum setup.
            const inst = await prisma.institution.findFirst({ select: { id: true } });
            await prisma.user.upsert({
              where: { email: user.email },
              update: { authUserId: user.id, name: user.name },
              create: {
                authUserId: user.id,
                name: user.name,
                email: user.email,
                role,
                institutionId: inst?.id ?? null,
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
