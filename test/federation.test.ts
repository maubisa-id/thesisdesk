import { describe, it, expect, beforeEach } from "vitest";
import { createHmac, randomUUID } from "node:crypto";
import { verifyHubRequest } from "@/lib/federation";

const SECRET = "test-secret-federation";
const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");

// Mint token persis seperti hub (federation.ts sisi hub) supaya uji verifikasi realistis.
function mint(opts: {
  aud?: string;
  scope?: string;
  expOffset?: number;
  alg?: string;
  secret?: string;
  actor?: unknown;
} = {}): string {
  const { aud = "thesis", scope = "thesis", expOffset = 60, alg = "HS256", secret = SECRET } = opts;
  const now = Math.floor(Date.now() / 1000);
  const header = b64({ alg, typ: "JWT" });
  const actor = "actor" in opts ? opts.actor : { uuid: "env:admin@x.id", email: "admin@x.id" };
  const payload = b64({ iss: "akun.contoh.id", aud, scope, actor, jti: randomUUID(), iat: now, exp: now + expOffset });
  const sig = alg === "none" ? "" : createHmac("sha256", secret).update(`${header}.${payload}`).digest("base64url");
  return `${header}.${payload}.${sig}`;
}

function req(token: string | null, method = "GET"): Request {
  const headers: Record<string, string> = { "x-correlation-id": randomUUID() };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request("http://localhost/admin/v1/stats", { method, headers });
}

describe("verifyHubRequest", () => {
  beforeEach(() => {
    process.env.THESIS_ADMIN_API_SECRET = SECRET;
  });

  it("menerima token valid", () => {
    const r = verifyHubRequest(req(mint()));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.actor.email).toBe("admin@x.id");
  });

  it("tolak 503 bila secret belum diset", () => {
    delete process.env.THESIS_ADMIN_API_SECRET;
    const r = verifyHubRequest(req(mint()));
    expect(r).toMatchObject({ ok: false, status: 503 });
  });

  it("tolak 401 tanpa Authorization", () => {
    expect(verifyHubRequest(req(null))).toMatchObject({ ok: false, status: 401 });
  });

  it("tolak 401 signature salah", () => {
    const r = verifyHubRequest(req(mint({ secret: "secret-lain" })));
    expect(r).toMatchObject({ ok: false, status: 401 });
  });

  it("tolak 403 audience salah", () => {
    expect(verifyHubRequest(req(mint({ aud: "kelas" })))).toMatchObject({ ok: false, status: 403 });
  });

  it("tolak 403 scope salah", () => {
    expect(verifyHubRequest(req(mint({ scope: "kelas" })))).toMatchObject({ ok: false, status: 403 });
  });

  it("tolak 401 token kedaluwarsa", () => {
    expect(verifyHubRequest(req(mint({ expOffset: -120 })))).toMatchObject({ ok: false, status: 401 });
  });

  it("tolak 401 alg=none", () => {
    expect(verifyHubRequest(req(mint({ alg: "none" })))).toMatchObject({ ok: false, status: 401 });
  });

  it("tolak 401 klaim actor tak lengkap", () => {
    expect(verifyHubRequest(req(mint({ actor: { uuid: "x" } })))).toMatchObject({ ok: false, status: 401 });
  });

  it("anti-replay: POST dengan token sama ditolak pada panggilan kedua", () => {
    const token = mint();
    expect(verifyHubRequest(req(token, "POST")).ok).toBe(true);
    expect(verifyHubRequest(req(token, "POST"))).toMatchObject({ ok: false, status: 401 });
  });
});
