// RBAC/Policy terpusat (Fondasi §5.2). MySQL/SQLite tak punya RLS → filter tiap query by user
// + cek policy di sini. Mencegah IDOR antar-klien (blueprint §7). Default-deny.
import type { SessionUser } from "@/lib/session";

export function isAdmin(u: { role: string }): boolean {
  return u.role === "admin";
}
export function isTutor(u: { role: string }): boolean {
  return u.role === "tutor";
}
export function isKlien(u: { role: string }): boolean {
  return u.role === "klien";
}

type BimbinganOwners = { clientUserId: number; tutorUserId: number | null };

// Boleh melihat/aksi sebuah bimbingan? admin: semua · tutor: hanya yang ditugaskan ·
// klien: hanya miliknya. Dipakai sebelum membaca dokumen/log/anotasi (cegah IDOR).
export function canAccessBimbingan(u: SessionUser, b: BimbinganOwners): boolean {
  if (u.role === "admin") return true;
  if (u.role === "tutor") return b.tutorUserId === u.id;
  return b.clientUserId === u.id;
}

// Boleh berkirim pesan / melihat percakapan dengan lawan bicara `otherId`?
// klien hanya dengan tutornya; tutor dengan klien bimbingannya; admin bebas.
export function canMessage(u: SessionUser, otherId: number): boolean {
  if (u.role === "admin") return true;
  return otherId !== u.id; // relasi tutor↔klien divalidasi di query (peserta bimbingan)
}

export class ForbiddenError extends Error {
  constructor(message = "Akses ditolak.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export function assertAccess(cond: boolean, message?: string): void {
  if (!cond) throw new ForbiddenError(message);
}
