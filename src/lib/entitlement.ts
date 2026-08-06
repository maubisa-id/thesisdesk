// Gerbang akses (default-deny). Fitur bimbingan/USP hanya untuk user dengan entitlement
// scope='thesis' AKTIF (status 'active' + belum lewat expiresAt). Sumber kebenaran = maubisa_core
// (webhook Midtrans); di sini di-mirror lokal untuk demo. Dihitung LAZY saat dibaca (nol worker).
import { prisma } from "@/lib/prisma";

type EntitlementLike = { status: string; scope?: string; expiresAt?: Date | string | null };

function toDate(v?: Date | string | null): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isEntitlementActive(e: EntitlementLike, now: Date = new Date()): boolean {
  if (e.status !== "active") return false;
  const exp = toDate(e.expiresAt);
  return exp ? exp.getTime() > now.getTime() : true;
}

export function effectiveEntitlementStatus(e: EntitlementLike, now: Date = new Date()): string {
  if (e.status === "active" && !isEntitlementActive(e, now)) return "expired";
  return e.status;
}

// True bila user thesis (users.id) punya entitlement scope='thesis' yang aktif. Default-deny:
// error DB / tak ada baris => false (fitur terkunci, tampilkan CTA beli di Pusat Akun).
export async function hasThesisAccess(userId: number): Promise<boolean> {
  try {
    const ents = await prisma.entitlement.findMany({
      where: { userId, scope: "thesis" },
      select: { status: true, expiresAt: true },
    });
    return ents.some((e) => isEntitlementActive(e));
  } catch {
    return false;
  }
}
