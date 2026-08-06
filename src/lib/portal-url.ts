import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// Tautan portal ber-tanda-tangan untuk domain cdn.contoh.id (dokumen PII di bucket PRIVAT).
// Model sama seperti signed URL GCS: token HMAC ber-TTL pendek yang mengikat KEY objek + waktu
// kedaluwarsa. Di-mint HANYA oleh app untuk pengguna yang berhak (entitlement dicek saat mint).
// Cloudflare Worker di cdn.contoh.id/portal/* meneruskan ke /api/portal/[...key] yang MEMVERIFIKASI
// token ini lalu men-stream byte dari bucket privat. Domain tetap cdn.contoh.id, isi tetap privat.
//
// ENV:
//   PORTAL_URL_SECRET : rahasia HMAC bersama (app <-> tak perlu di Worker; verifikasi di app).
//   PORTAL_CDN_BASE   : basis URL publik, mis. "https://cdn.contoh.id". Kosong -> fitur cdn nonaktif.

function b64url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function sign(canonical: string, secret: string): string {
  return b64url(createHmac("sha256", secret).update(canonical).digest());
}

export function portalUrlConfigured(): boolean {
  return Boolean(process.env.PORTAL_URL_SECRET && process.env.PORTAL_CDN_BASE);
}

// key = kunci objek di bucket privat, mis. "portal/12/1710000-bab1.pdf".
export function portalCdnUrl(key: string, ttlMs = 30 * 60_000): string | null {
  const secret = process.env.PORTAL_URL_SECRET;
  const base = process.env.PORTAL_CDN_BASE;
  if (!secret || !base) return null;
  const clean = key.replace(/^\/+/, "");
  const exp = Math.floor((Date.now() + ttlMs) / 1000);
  const sig = sign(`${clean}\n${exp}`, secret);
  const path = clean
    .split("/")
    .map((seg) => encodeURIComponent(seg))
    .join("/");
  return `${base.replace(/\/+$/, "")}/${path}?e=${exp}&s=${sig}`;
}

// Verifikasi token (dipakai route /api/portal). Konstan-waktu; tolak bila kedaluwarsa/tak cocok.
export function verifyPortalToken(key: string, exp: string | null, sig: string | null): boolean {
  const secret = process.env.PORTAL_URL_SECRET;
  if (!secret || !exp || !sig) return false;
  const expNum = Number.parseInt(exp, 10);
  if (!Number.isFinite(expNum) || expNum * 1000 < Date.now()) return false;
  const clean = key.replace(/^\/+/, "");
  const expected = sign(`${clean}\n${expNum}`, secret);
  const a = Buffer.from(expected);
  const b = Buffer.from(sig);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
