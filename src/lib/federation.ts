// Federasi admin (sisi SPOKE / thesis). Hub `akun.maubisa.id` = UI + login tunggal operator; aksi
// domain (assign tutor, judul skripsi) TETAP milik thesis. Hub memanggil admin API tipis di sini
// server-to-server dengan JWT HS256 umur-pendek. File ini MEMVERIFIKASI token itu.
//
// Kontrak: maubisa-account-center/docs/federasi-admin.md sec 4. Cermin dari mint hub
// (src/lib/federation.ts sisi hub, node:crypto). Sengaja pakai node:crypto (bukan lib JWT) supaya
// nol-dependency + verifikasi persis sama dengan cara hub menandatangani.
//
// OFF BY DEFAULT: aktif hanya bila THESIS_ADMIN_API_SECRET diset (secret sama dengan hub). Tanpa
// itu, semua endpoint /admin/v1/* balas 503 "belum aktif". Aktivasi = set env, tanpa ubah kode.
import { createHmac, timingSafeEqual } from "node:crypto";

const ISS = "akun.maubisa.id";
const AUD = "thesis";
const SCOPE = "thesis";
const CLOCK_SKEW = 5; // detik toleransi jam antar-mesin

export type FederationActor = { uuid: string; email: string };
export type VerifyOk = { ok: true; actor: FederationActor; correlationId: string | null };
export type VerifyErr = { ok: false; status: number; error: string };
export type VerifyResult = VerifyOk | VerifyErr;

type Claims = {
  iss?: unknown;
  aud?: unknown;
  scope?: unknown;
  actor?: { uuid?: unknown; email?: unknown };
  jti?: unknown;
  iat?: unknown;
  exp?: unknown;
};

// Aktif bila secret S2S terpasang. Endpoint memakai ini untuk fail-closed (503) saat OFF.
export function federationConfigured(): boolean {
  return Boolean(process.env.THESIS_ADMIN_API_SECRET?.trim());
}

// Anti-replay: cache `jti` yang sudah dilihat selama masa token (exp). In-memory per-instance;
// token hanya hidup 60 dtk -> peta tetap kecil (di-sweep tiap verifikasi). ponytail: pindah ke
// Redis saat multi-instance. Diberlakukan HANYA untuk POST (aksi tulis); GET tidak, karena hub
// me-retry GET dengan token yang SAMA (idempoten) sehingga jti bisa muncul dua kali secara sah.
const seenJti = new Map<string, number>();
function claimJti(jti: string, exp: number, now: number): boolean {
  for (const [k, e] of seenJti) if (e <= now) seenJti.delete(k);
  if (seenJti.has(jti)) return false;
  seenJti.set(jti, exp);
  return true;
}

function decodeSegment(seg: string): Buffer {
  return Buffer.from(seg, "base64url");
}

// Verifikasi token hub dari sebuah Request. Enforce anti-replay hanya untuk metode tulis (POST).
export function verifyHubRequest(req: Request): VerifyResult {
  const secret = process.env.THESIS_ADMIN_API_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 503, error: "Federation admin API belum aktif." };
  }

  const authz = req.headers.get("authorization") ?? "";
  const bearer = /^Bearer\s+(.+)$/i.exec(authz.trim());
  if (!bearer) return { ok: false, status: 401, error: "Authorization Bearer wajib." };

  const parts = bearer[1].split(".");
  if (parts.length !== 3) return { ok: false, status: 401, error: "Token malformed." };
  const [headerSeg, payloadSeg, sigSeg] = parts;

  // Header WAJIB HS256. Tolak alg=none dan algorithm-confusion.
  let alg: unknown;
  try {
    alg = (JSON.parse(decodeSegment(headerSeg).toString("utf8")) as { alg?: unknown }).alg;
  } catch {
    return { ok: false, status: 401, error: "Header token rusak." };
  }
  if (alg !== "HS256") return { ok: false, status: 401, error: "Algoritma token tidak didukung." };

  // Verifikasi tanda tangan (timing-safe). Persis cara hub menandatangani: HMAC-SHA256 atas
  // `header.payload` base64url dengan secret bersama.
  const expected = createHmac("sha256", secret).update(`${headerSeg}.${payloadSeg}`).digest();
  let got: Buffer;
  try {
    got = decodeSegment(sigSeg);
  } catch {
    return { ok: false, status: 401, error: "Signature rusak." };
  }
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) {
    return { ok: false, status: 401, error: "Signature tidak cocok." };
  }

  // Payload.
  let claims: Claims;
  try {
    claims = JSON.parse(decodeSegment(payloadSeg).toString("utf8")) as Claims;
  } catch {
    return { ok: false, status: 401, error: "Payload token rusak." };
  }

  const now = Math.floor(Date.now() / 1000);
  const exp = typeof claims.exp === "number" ? claims.exp : 0;
  const iat = typeof claims.iat === "number" ? claims.iat : 0;
  if (!exp || exp + CLOCK_SKEW < now) return { ok: false, status: 401, error: "Token kedaluwarsa." };
  if (iat && iat - CLOCK_SKEW > now) return { ok: false, status: 401, error: "Token belum berlaku." };
  if (claims.iss !== ISS) return { ok: false, status: 401, error: "Issuer tidak dikenal." };
  if (claims.aud !== AUD) return { ok: false, status: 403, error: "Audience token bukan thesis." };
  if (claims.scope !== SCOPE) return { ok: false, status: 403, error: "Scope token bukan thesis." };

  const uuid = typeof claims.actor?.uuid === "string" ? claims.actor.uuid : "";
  const email = typeof claims.actor?.email === "string" ? claims.actor.email : "";
  if (!uuid || !email) return { ok: false, status: 401, error: "Klaim actor (uuid+email) wajib." };

  const jti = typeof claims.jti === "string" ? claims.jti : "";
  if (!jti) return { ok: false, status: 401, error: "Klaim jti wajib." };

  // Anti-replay hanya untuk aksi tulis (POST). GET idempoten -> hub boleh retry token sama.
  if (req.method === "POST" && !claimJti(jti, exp, now)) {
    return { ok: false, status: 401, error: "Token sudah dipakai (replay)." };
  }

  const correlationId = req.headers.get("x-correlation-id");
  return { ok: true, actor: { uuid, email }, correlationId };
}
