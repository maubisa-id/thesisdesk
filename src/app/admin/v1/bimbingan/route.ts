import { guard, jsonOk } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// GET /admin/v1/bimbingan?status=unassigned - daftar bimbingan (default: BELUM ber-tutor) untuk
// picker assign di hub. Array {id, klien_name, judul}.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const status = new URL(req.url).searchParams.get("status");
  const where =
    status === "unassigned" || !status
      ? { status: "ongoing", deletedAt: null, tutorUserId: null }
      : { status: "ongoing", deletedAt: null };

  const list = await prisma.bimbingan.findMany({
    where,
    select: { id: true, thesisTitle: true, client: { select: { name: true } } },
    orderBy: { id: "desc" },
  });

  return jsonOk(
    list.map((b) => ({ id: b.id, klien_name: b.client.name, judul: b.thesisTitle ?? "" })),
  );
}
