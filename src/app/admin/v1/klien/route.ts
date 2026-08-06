import { guard, jsonOk, milestoneProgressMap, pct } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// GET /admin/v1/klien - daftar klien bimbingan (read-only) untuk konsol hub. Satu baris per
// bimbingan. Array {id, name, email, tutor_name, status, judul, progress_pct, last_activity}.
// Aksi menulis (tuntaskan/catatan) tetap di aplikasi thesis - hub hanya memantau.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const list = await prisma.bimbingan.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      status: true,
      thesisTitle: true,
      updatedAt: true,
      client: { select: { name: true, email: true } },
      tutor: { select: { name: true } },
    },
    orderBy: { id: "desc" },
  });

  const progress = await milestoneProgressMap(list.map((b) => b.id));

  const rows = list.map((b) => {
    const m = progress.get(b.id);
    return {
      id: b.id,
      name: b.client.name,
      email: b.client.email,
      tutor_name: b.tutor?.name ?? null,
      status: b.status,
      judul: b.thesisTitle ?? "",
      progress_pct: pct(m?.total ?? 0, m?.done ?? 0),
      last_activity: b.updatedAt.toISOString(),
    };
  });

  return jsonOk(rows);
}
