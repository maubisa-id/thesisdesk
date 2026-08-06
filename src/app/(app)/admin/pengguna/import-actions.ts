"use server";

import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getSessionUser } from "@/lib/session";

export type ImportRow = { email: string; name: string; status: "dibuat" | "dilewati" | "gagal"; note?: string; tempPassword?: string };
export type ImportResult = { ok: true; rows: ImportRow[]; created: number; skipped: number; failed: number } | { ok: false; error: string };

// Parser CSV ringan. Header: name,email,role,prodi,angkatan. ponytail: dukung kutip ganda sederhana;
// belum menangani baris-baru di dalam sel (jarang untuk data pengguna).
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];
  const cell = (line: string) =>
    line.match(/(".*?"|[^,]*)(,|$)/g)?.slice(0, -1).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"').trim()) ?? [];
  const header = cell(lines[0]!).map((h) => h.toLowerCase());
  return lines.slice(1).map((line) => {
    const cells = cell(line);
    const row: Record<string, string> = {};
    header.forEach((h, i) => (row[h] = cells[i] ?? ""));
    return row;
  });
}

const VALID_ROLES = new Set(["klien", "tutor", "admin"]);

export async function importUsers(csvText: string): Promise<ImportResult> {
  const admin = await getSessionUser();
  if (!admin || admin.role !== "admin") return { ok: false, error: "Akses ditolak." };

  const rows = parseCsv(csvText);
  if (rows.length === 0) return { ok: false, error: "CSV kosong atau tanpa baris data. Sertakan header: name,email,role,prodi,angkatan." };
  if (rows.length > 500) return { ok: false, error: "Maksimal 500 baris per impor." };

  // Peta kode/nama prodi -> id (resolusi di server; jangan percaya klien).
  const programs = await prisma.studyProgram.findMany({ select: { id: true, code: true, name: true } });
  const progByKey = new Map<string, number>();
  for (const p of programs) {
    if (p.code) progByKey.set(p.code.toLowerCase(), p.id);
    progByKey.set(p.name.toLowerCase(), p.id);
  }

  const out: ImportRow[] = [];
  let created = 0, skipped = 0, failed = 0;

  for (const r of rows) {
    const email = (r.email ?? "").toLowerCase().trim();
    const name = (r.name ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || name.length < 2) {
      out.push({ email, name, status: "gagal", note: "email/nama tidak valid" });
      failed++;
      continue;
    }
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      out.push({ email, name, status: "dilewati", note: "email sudah terdaftar" });
      skipped++;
      continue;
    }
    const role = VALID_ROLES.has((r.role ?? "").toLowerCase()) ? (r.role ?? "").toLowerCase() : "klien";
    const studyProgramId = r.prodi ? progByKey.get(r.prodi.toLowerCase()) ?? null : null;
    const angkatan = /^\d{4}$/.test(r.angkatan ?? "") ? Number(r.angkatan) : null;
    const tempPassword = randomBytes(9).toString("base64url");

    try {
      await auth.api.signUpEmail({ body: { email, name, password: tempPassword } });
      await prisma.user.update({ where: { email }, data: { role, studyProgramId, angkatan } });
      out.push({ email, name, status: "dibuat", tempPassword });
      created++;
    } catch {
      out.push({ email, name, status: "gagal", note: "gagal membuat akun" });
      failed++;
    }
  }

  return { ok: true, rows: out, created, skipped, failed };
}
