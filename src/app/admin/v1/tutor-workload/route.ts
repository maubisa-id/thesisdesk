import { guard, jsonOk, milestoneProgressMap, pct } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// GET /admin/v1/tutor-workload - pemantauan beban tutor (read-only). Array
// {id, name, active_clients, avg_progress, last_activity}. Hub cache 30 dtk + degradasi anggun.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const [tutors, bimbingan] = await Promise.all([
    prisma.user.findMany({
      where: { role: "tutor", deletedAt: null },
      select: { id: true, name: true, lastSeenAt: true },
      orderBy: { name: "asc" },
    }),
    prisma.bimbingan.findMany({
      where: { status: "ongoing", deletedAt: null, tutorUserId: { not: null } },
      select: { id: true, tutorUserId: true, updatedAt: true },
    }),
  ]);

  const progress = await milestoneProgressMap(bimbingan.map((b) => b.id));

  const byTutor = new Map<number, { ids: number[]; lastActivity: Date | null }>();
  for (const b of bimbingan) {
    const key = b.tutorUserId;
    if (key == null) continue;
    const cur = byTutor.get(key) ?? { ids: [], lastActivity: null };
    cur.ids.push(b.id);
    if (!cur.lastActivity || b.updatedAt > cur.lastActivity) cur.lastActivity = b.updatedAt;
    byTutor.set(key, cur);
  }

  const rows = tutors.map((t) => {
    const agg = byTutor.get(t.id);
    const ids = agg?.ids ?? [];
    const pcts = ids.map((id) => {
      const m = progress.get(id);
      return pct(m?.total ?? 0, m?.done ?? 0);
    });
    const avg = pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : 0;

    const candidates = [agg?.lastActivity ?? null, t.lastSeenAt ?? null].filter(
      (d): d is Date => d != null,
    );
    const last = candidates.length
      ? candidates.reduce((a, b) => (a.getTime() >= b.getTime() ? a : b))
      : null;

    return {
      id: t.id,
      name: t.name,
      active_clients: ids.length,
      avg_progress: avg,
      last_activity: last ? last.toISOString() : null,
    };
  });

  return jsonOk(rows);
}
