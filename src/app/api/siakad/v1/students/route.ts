import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { siakadAuthorized } from "@/lib/siakad";
import { milestoneProgressMap, pct } from "@/lib/admin-api";

// API baca untuk SIAKAD: tarik status skripsi tiap mahasiswa (kirim balik ke kampus).
// Opsional filter ?email=. Read-only, ber-secret.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!siakadAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const email = new URL(req.url).searchParams.get("email")?.toLowerCase().trim();

  const bimbingan = await prisma.bimbingan.findMany({
    where: {
      deletedAt: null,
      ...(email ? { client: { email } } : {}),
    },
    select: {
      id: true,
      status: true,
      thesisTitle: true,
      updatedAt: true,
      client: { select: { name: true, email: true, angkatan: true, studyProgram: { select: { name: true, code: true } } } },
      tutor: { select: { name: true } },
    },
    orderBy: { id: "desc" },
    take: 2000,
  });

  const progress = await milestoneProgressMap(bimbingan.map((b) => b.id));

  const data = bimbingan.map((b) => {
    const m = progress.get(b.id);
    return {
      email: b.client.email,
      name: b.client.name,
      prodi: b.client.studyProgram?.code ?? b.client.studyProgram?.name ?? null,
      angkatan: b.client.angkatan ?? null,
      judul: b.thesisTitle ?? "",
      status: b.status,
      progress_pct: pct(m?.total ?? 0, m?.done ?? 0),
      tutor: b.tutor?.name ?? null,
      updated_at: b.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ ok: true, count: data.length, students: data });
}
