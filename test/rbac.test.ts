import { describe, it, expect } from "vitest";
import { canAccessBimbingan, canMessage, canDecideStage, isAdmin, isTutor, isKlien, isKaprodi } from "@/lib/rbac";
import { nextStage, STAGE_ORDER } from "@/lib/format";
import { tenantWhere } from "@/lib/setup";
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
    expect(isKaprodi(mk(1, "kaprodi"))).toBe(true);
    expect(isAdmin(mk(1, "klien"))).toBe(false);
  });
});

describe("canDecideStage (scope prodi kaprodi)", () => {
  const kaprodi = { role: "kaprodi", studyProgramId: 7 };
  it("admin selalu boleh", () => {
    expect(canDecideStage({ role: "admin", studyProgramId: null }, 7)).toBe(true);
  });
  it("kaprodi hanya prodinya", () => {
    expect(canDecideStage(kaprodi, 7)).toBe(true);
    expect(canDecideStage(kaprodi, 8)).toBe(false);
  });
  it("kaprodi tanpa prodi ditolak (fail-closed)", () => {
    expect(canDecideStage({ role: "kaprodi", studyProgramId: null }, 7)).toBe(false);
  });
  it("mahasiswa tanpa prodi ditolak", () => {
    expect(canDecideStage(kaprodi, null)).toBe(false);
  });
  it("klien/tutor tak pernah boleh memutus tahap", () => {
    expect(canDecideStage({ role: "tutor", studyProgramId: 7 }, 7)).toBe(false);
    expect(canDecideStage({ role: "klien", studyProgramId: 7 }, 7)).toBe(false);
  });
});

describe("nextStage (alur bertingkat)", () => {
  it("maju berurutan proposal -> seminar -> sidang -> selesai", () => {
    expect(nextStage("proposal")).toBe("seminar");
    expect(nextStage("seminar")).toBe("sidang");
    expect(nextStage("sidang")).toBe("selesai");
  });
  it("selesai adalah terminal", () => {
    expect(nextStage("selesai")).toBeNull();
  });
  it("stage tak dikenal aman (null)", () => {
    expect(nextStage("entah")).toBeNull();
  });
  it("urutan tahap tetap 4 langkah", () => {
    expect(STAGE_ORDER.length).toBe(4);
  });
});

describe("tenantWhere (multi-tenant, null-safe)", () => {
  it("viewer dengan institutionId -> filter tenant", () => {
    expect(tenantWhere({ institutionId: 3 })).toEqual({ institutionId: 3 });
  });
  it("viewer tanpa institutionId -> tanpa filter (self-host)", () => {
    expect(tenantWhere({ institutionId: null })).toEqual({});
    expect(tenantWhere({})).toEqual({});
  });
});
