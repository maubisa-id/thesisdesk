import { cache } from "react";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";

export type Role = "admin" | "tutor" | "klien" | "kaprodi";

const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),
);

// Email dari sesi Better Auth (null jika belum login). Di-cache per request.
export const getSessionEmail = cache(async (): Promise<string | null> => {
  try {
    const session = await auth.api.getSession({ headers: await headers() });
    return session?.user?.email ?? null;
  } catch {
    return null;
  }
});

// Profil sisi-thesis lengkap untuk user yang login. Sumber peran = kolom users.role
// (di-boost ke 'admin' bila email ada di ADMIN_EMAILS - bootstrap owner). Identitas kanonik
// tetap di core; ini profil domain + peran untuk RBAC & routing dashboard.
export const getSessionUser = cache(async () => {
  const email = await getSessionEmail();
  if (!email) return null;
  try {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return null;
    const role: Role = ADMIN_EMAILS.has(email.toLowerCase())
      ? "admin"
      : (user.role as Role);
    return { ...user, role };
  } catch {
    return null;
  }
});

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.has(email.toLowerCase());
}
