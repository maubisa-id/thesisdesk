import { guard, jsonOk } from "@/lib/admin-api";
import { prisma } from "@/lib/prisma";

// GET /admin/v1/tutors - daftar tutor untuk picker assign di hub. Array {id, name}.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const g = guard(req);
  if (!g.ok) return g.response;

  const tutors = await prisma.user.findMany({
    where: { role: "tutor", deletedAt: null },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return jsonOk(tutors.map((t) => ({ id: t.id, name: t.name })));
}
