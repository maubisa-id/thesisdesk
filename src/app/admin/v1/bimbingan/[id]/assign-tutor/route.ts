import { guard, jsonOk, jsonError, readJson, auditFederation } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";
import { hasThesisAccess } from "@/lib/entitlement";

// POST /admin/v1/bimbingan/{id}/assign-tutor - body {tutor_user_id}. Idempoten (tutor sama -> 200
// no-op). Menulis bimbingan.tutor_user_id di DB thesis (spoke). Default-deny: cek ulang invariant
// sendiri (bimbingan ada, tutor valid & role=tutor, klien punya entitlement thesis aktif).
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  const bimbinganId = Number(id);
  if (!Number.isInteger(bimbinganId) || bimbinganId <= 0) {
    return jsonError(400, "id bimbingan tidak valid.");
  }

  const body = await readJson(req);
  const raw = body.tutor_user_id;
  const tutorUserId = Number(typeof raw === "string" ? raw.trim() : raw);
  if (!Number.isInteger(tutorUserId) || tutorUserId <= 0) {
    return jsonError(400, "tutor_user_id wajib.");
  }

  const bimbingan = await prisma.bimbingan.findFirst({
    where: { id: bimbinganId, deletedAt: null },
    select: { id: true, tutorUserId: true, clientUserId: true },
  });
  if (!bimbingan) return jsonError(404, "Bimbingan tidak ditemukan.");

  // Idempoten: tutor sama -> no-op sukses (tanpa audit noise).
  if (bimbingan.tutorUserId === tutorUserId) return jsonOk({ ok: true });

  const tutor = await prisma.user.findFirst({
    where: { id: tutorUserId, role: "tutor", deletedAt: null },
    select: { id: true },
  });
  if (!tutor) return jsonError(422, "Tutor tidak valid (bukan tutor / tidak ada).");

  // Default-deny: jangan percaya hub buta - klien wajib punya akses thesis aktif.
  if (!(await hasThesisAccess(bimbingan.clientUserId))) {
    return jsonError(422, "Klien tak punya akses thesis aktif.");
  }

  await prisma.bimbingan.update({
    where: { id: bimbinganId },
    data: { tutorUserId },
  });
  await auditFederation({
    actor: g.actor,
    action: "federation.assign_tutor",
    targetType: "bimbingan",
    targetId: bimbinganId,
    correlationId: g.correlationId,
    metadata: { tutor_user_id: tutorUserId },
  });

  return jsonOk({ ok: true });
}
