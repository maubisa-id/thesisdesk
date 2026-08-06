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
