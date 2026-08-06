import { describe, it, expect } from "vitest";
import { canAccessBimbingan, canMessage, isAdmin, isTutor, isKlien } from "@/lib/rbac";
import type { SessionUser } from "@/lib/session";

const mk = (id: number, role: string) => ({ id, role }) as SessionUser;

describe("canAccessBimbingan (anti-IDOR)", () => {
  const b = { clientUserId: 10, tutorUserId: 20 };

  it("admin selalu boleh", () => {
    expect(canAccessBimbingan(mk(999, "admin"), b)).toBe(true);
  });
  it("tutor hanya bimbingan yang ditugaskan padanya", () => {
    expect(canAccessBimbingan(mk(20, "tutor"), b)).toBe(true);
    expect(canAccessBimbingan(mk(21, "tutor"), b)).toBe(false);
  });
  it("klien hanya miliknya", () => {
    expect(canAccessBimbingan(mk(10, "klien"), b)).toBe(true);
    expect(canAccessBimbingan(mk(11, "klien"), b)).toBe(false);
  });
  it("tutor pada bimbingan tanpa tutor tetap ditolak", () => {
    expect(canAccessBimbingan(mk(20, "tutor"), { clientUserId: 10, tutorUserId: null })).toBe(false);
  });
});

describe("canMessage", () => {
  it("admin bebas", () => {
    expect(canMessage(mk(1, "admin"), 1)).toBe(true);
  });
  it("tak bisa kirim ke diri sendiri (non-admin)", () => {
    expect(canMessage(mk(5, "klien"), 5)).toBe(false);
  });
  it("boleh ke lawan bicara berbeda", () => {
    expect(canMessage(mk(5, "klien"), 6)).toBe(true);
  });
});

describe("role guards", () => {
  it("membedakan peran", () => {
    expect(isAdmin(mk(1, "admin"))).toBe(true);
    expect(isTutor(mk(1, "tutor"))).toBe(true);
    expect(isKlien(mk(1, "klien"))).toBe(true);
    expect(isAdmin(mk(1, "klien"))).toBe(false);
  });
});
