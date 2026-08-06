import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { siakadAuthorized } from "@/lib/siakad";

// Webhook masuk dari SIAKAD kampus: sinkron roster mahasiswa (upsert by email). Idempoten.
// SIAKAD = sumber kebenaran identitas mahasiswa; thesis menautkan prodi/angkatan.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  students: z
    .array(
      z.object({
        email: z.string().trim().email(),
        name: z.string().trim().min(2).max(120),
        prodi: z.string().trim().max(120).optional(),
        angkatan: z.coerce.number().int().min(1900).max(2100).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

export async function POST(req: Request) {
  if (!siakadAuthorized(req)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "body bukan JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "format tidak valid; butuh {students:[{email,name,prodi?,angkatan?}]}" }, { status: 422 });
  }

  const programs = await prisma.studyProgram.findMany({ select: { id: true, code: true, name: true } });
  const progByKey = new Map<string, number>();
  for (const p of programs) {
    if (p.code) progByKey.set(p.code.toLowerCase(), p.id);
    progByKey.set(p.name.toLowerCase(), p.id);
  }

  let created = 0, updated = 0, failed = 0;
  for (const s of parsed.data.students) {
    const email = s.email.toLowerCase();
    const studyProgramId = s.prodi ? progByKey.get(s.prodi.toLowerCase()) ?? null : null;
    try {
      const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
      if (existing) {
        await prisma.user.update({ where: { email }, data: { name: s.name, studyProgramId, angkatan: s.angkatan ?? null } });
        updated++;
      } else {
        await auth.api.signUpEmail({ body: { email, name: s.name, password: randomBytes(9).toString("base64url") } });
        await prisma.user.update({ where: { email }, data: { role: "klien", studyProgramId, angkatan: s.angkatan ?? null } });
        created++;
      }
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, created, updated, failed });
}
