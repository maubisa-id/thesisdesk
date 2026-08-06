import { cache } from "react";
import { prisma } from "@/lib/prisma";

// First-run: setup wizard aktif hanya kalau belum ada admin/institusi. Dengan ADMIN_EMAILS di-set
// (deploy yang mengatur admin lewat env) wizard dilewati. DB error -> anggap sudah siap (jangan
// blok login / hindari loop redirect). Dipakai server component (bukan "use server").
export const isSetupDone = cache(async (): Promise<boolean> => {
  if ((process.env.ADMIN_EMAILS ?? "").trim()) return true;
  try {
    if (await prisma.institution.findFirst({ select: { id: true } })) return true;
    return Boolean(await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } }));
  } catch {
    return true;
  }
});

export const getInstitution = cache(async () => {
  try {
    return await prisma.institution.findFirst();
  } catch {
    return null;
  }
});

// Id institusi tenant aktif (singleton di deploy self-host). null bila belum di-setup.
export const currentInstitutionId = cache(async (): Promise<number | null> => {
  const inst = await getInstitution();
  return inst?.id ?? null;
});

// Filter tenant untuk query lintas-tenant (daftar pengguna/bimbingan/kaprodi). Null-safe:
// viewer tanpa institutionId (self-host single-tenant / belum di-setup) -> tak difilter (lihat semua).
// ponytail: institutionId ditegakkan pada akar tenant (users/bimbingan) + permukaan daftar admin/
// kaprodi. Penegakan row-level di SETIAP tabel domain + resolusi tenant dari host/subdomain
// ditunda ke mode SaaS; self-host = satu tenant (singleton).
export function tenantWhere(user: { institutionId?: number | null }): { institutionId?: number } {
  return user.institutionId != null ? { institutionId: user.institutionId } : {};
}
