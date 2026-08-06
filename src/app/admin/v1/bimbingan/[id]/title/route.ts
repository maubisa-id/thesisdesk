import { guard, jsonOk, jsonError, readJson, auditFederation } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// POST /admin/v1/bimbingan/{id}/title - body {thesis_title}. Idempoten (judul sama -> 200 no-op).
// Menyimpan bimbingan.thesis_title (maks 300 char) di DB thesis. Audit hanya panjang judul.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_TITLE = 300;

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const { id } = await ctx.params;
  const bimbinganId = Number(id);
  if (!Number.isInteger(bimbinganId) || bimbinganId <= 0) {
    return jsonError(400, "id bimbingan tidak valid.");
  }

  const body = await readJson(req);
  const raw = body.thesis_title;
  const title = typeof raw === "string" ? raw.trim() : "";
  if (!title) return jsonError(400, "thesis_title wajib.");
  if (title.length > MAX_TITLE) return jsonError(422, `Judul maksimal ${MAX_TITLE} karakter.`);

  const bimbingan = await prisma.bimbingan.findFirst({
    where: { id: bimbinganId, deletedAt: null },
    select: { id: true, thesisTitle: true },
  });
  if (!bimbingan) return jsonError(404, "Bimbingan tidak ditemukan.");

  // Idempoten: judul sama -> no-op sukses.
  if (bimbingan.thesisTitle === title) return jsonOk({ ok: true });

  await prisma.bimbingan.update({
    where: { id: bimbinganId },
    data: { thesisTitle: title },
  });
  await auditFederation({
    actor: g.actor,
    action: "federation.set_thesis_title",
    targetType: "bimbingan",
    targetId: bimbinganId,
    correlationId: g.correlationId,
    metadata: { title_length: title.length },
  });

  return jsonOk({ ok: true });
}
