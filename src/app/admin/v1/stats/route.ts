import { guard, jsonOk } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// GET /admin/v1/stats - ringkasan untuk dashboard hub (federasi). Verifikasi JWT hub dulu.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const [bimbinganAktif, tutor, tanpaTutor] = await Promise.all([
    prisma.bimbingan.count({ where: { status: "ongoing", deletedAt: null } }),
    prisma.user.count({ where: { role: "tutor", deletedAt: null } }),
    prisma.bimbingan.findMany({
      where: { status: "ongoing", deletedAt: null, tutorUserId: null },
      select: { clientUserId: true },
      distinct: ["clientUserId"],
    }),
  ]);

  return jsonOk({
    bimbingan_aktif: bimbinganAktif,
    tutor,
    klien_tanpa_tutor: tanpaTutor.length,
  });
}
