import { type NextRequest } from "next/server";
import { verifyPortalToken } from "@/lib/portal-url";
import { gcsPortalConfigured, downloadPortalBuffer } from "@/lib/gcs";

// Penyaji dokumen portal PRIVAT untuk domain cdn.contoh.id (via Cloudflare Worker) ATAU langsung.
// Alur: Worker cdn.contoh.id/portal/<key> -> /api/portal/<key>?e=&s= (token dipertahankan).
// Route ini MEMVERIFIKASI token HMAC (portal-url.ts) lalu men-stream byte dari bucket privat.
// Tanpa token valid -> 403. Byte tak pernah publik; akses dibatasi waktu (TTL) + terikat key.

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONTENT_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  txt: "text/plain; charset=utf-8",
  md: "text/markdown; charset=utf-8",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ key: string[] }> }) {
  if (!gcsPortalConfigured()) {
    return new Response("Portal storage tidak aktif.", { status: 404 });
  }
  const { key: segments } = await ctx.params;
  const key = (segments ?? []).map((s) => decodeURIComponent(s)).join("/");
  // Hanya izinkan objek di bawah prefix portal/ (cegah akses ke prefix lain di bucket).
  if (!key || !key.startsWith("portal/") || key.includes("..")) {
    return new Response("Not found.", { status: 404 });
  }

  const url = new URL(req.url);
  const exp = url.searchParams.get("e");
  const sig = url.searchParams.get("s");
  if (!verifyPortalToken(key, exp, sig)) {
    return new Response("Tautan tidak valid atau kedaluwarsa.", { status: 403 });
  }

  let buffer: Buffer;
  try {
    buffer = await downloadPortalBuffer(key);
  } catch {
    return new Response("Dokumen tidak ditemukan.", { status: 404 });
  }

  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
  const filename = key.split("/").pop() ?? "dokumen";

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "content-type": contentType,
      "content-disposition": `inline; filename="${filename.replace(/["\\]/g, "_")}"`,
      "content-length": String(buffer.length),
      // Privat: jangan di-cache Cloudflare/CDN (byte PII, tautan ber-TTL).
      "cache-control": "private, no-store, max-age=0",
    },
  });
}
