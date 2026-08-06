"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";

type Result = { ok: true } | { ok: false; error: string };

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") throw new Error("forbidden");
  return user;
}

function guard(fn: () => Promise<Result>): Promise<Result> {
  return fn().catch((e) => ({ ok: false, error: e instanceof Error && e.message === "forbidden" ? "Akses ditolak." : "Gagal memproses." }));
}

const facultySchema = z.object({ name: z.string().trim().min(2).max(120), code: z.string().trim().max(20).optional() });
const programSchema = z.object({
  facultyId: z.coerce.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  code: z.string().trim().max(20).optional(),
  level: z.enum(["D3", "S1", "S2", "S3"]).default("S1"),
});

export async function createFaculty(input: unknown): Promise<Result> {
  return guard(async () => {
    await requireAdmin();
    const p = facultySchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Nama fakultas tidak valid." };
    await prisma.faculty.create({ data: { name: p.data.name, code: p.data.code || null } });
    revalidatePath("/admin/prodi");
    return { ok: true };
  });
}

export async function deleteFaculty(input: unknown): Promise<Result> {
  return guard(async () => {
    await requireAdmin();
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(input);
    await prisma.faculty.delete({ where: { id } });
    revalidatePath("/admin/prodi");
    return { ok: true };
  });
}

export async function createProgram(input: unknown): Promise<Result> {
  return guard(async () => {
    await requireAdmin();
    const p = programSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "Data prodi tidak valid." };
    await prisma.studyProgram.create({
      data: { facultyId: p.data.facultyId, name: p.data.name, code: p.data.code || null, level: p.data.level },
    });
    revalidatePath("/admin/prodi");
    return { ok: true };
  });
}

export async function deleteProgram(input: unknown): Promise<Result> {
  return guard(async () => {
    await requireAdmin();
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(input);
    await prisma.studyProgram.delete({ where: { id } });
    revalidatePath("/admin/prodi");
    return { ok: true };
  });
}
