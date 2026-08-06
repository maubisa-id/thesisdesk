import { timingSafeEqual } from "node:crypto";

// Autentikasi SIAKAD (server-to-server) via shared secret di header x-siakad-secret. Fail-closed:
// tanpa SIAKAD_WEBHOOK_SECRET, semua ditolak. Bandingkan timing-safe.
export function siakadAuthorized(req: Request): boolean {
  const expected = process.env.SIAKAD_WEBHOOK_SECRET?.trim();
  if (!expected) return false;
  const got = req.headers.get("x-siakad-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
