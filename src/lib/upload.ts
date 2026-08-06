import "server-only";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { gcsPortalConfigured, uploadPortalObject } from "@/lib/gcs";

// Penyimpanan berkas. PRODUKSI: bila GCS_PORTAL_BUCKET diset -> unggah ke bucket PRIVAT (PII, disajikan
// via signed URL, bukan publik). DEV: tulis ke public/uploads supaya bisa dibuka via URL statis Next.
// Lihat thesis-fitur-p1-ai-teks.md §1.1 + runbook gcs-remediasi-cdn-maubisa.md.

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED: Record<"doc" | "chat", Set<string>> = {
  doc: new Set(["pdf", "doc", "docx"]),
  chat: new Set(["pdf", "doc", "docx", "png", "jpg", "jpeg", "webp", "xlsx", "pptx", "zip"]),
};

// Validasi MAGIC-BYTE (blueprint-fondasi §5.2 "validasi magic-byte, bukan MIME string"): pastikan
// isi berkas cocok dengan ekstensinya, supaya ekstensi tak bisa dipalsukan (mis. .exe di-rename .pdf).
function matchesMagic(buf: Buffer, ext: string): boolean {
  const b = buf.subarray(0, 12);
  const at = (i: number) => b[i];
  const starts = (sig: number[]) => sig.every((x, i) => at(i) === x);
  const isZip = starts([0x50, 0x4b, 0x03, 0x04]) || starts([0x50, 0x4b, 0x05, 0x06]) || starts([0x50, 0x4b, 0x07, 0x08]); // PK (docx/xlsx/pptx/zip)
  const isOle = starts([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]); // OLE (.doc/.ppt lama)
  switch (ext) {
    case "pdf": return starts([0x25, 0x50, 0x44, 0x46]); // %PDF
    case "png": return starts([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    case "jpg":
    case "jpeg": return starts([0xff, 0xd8, 0xff]);
    case "webp": return starts([0x52, 0x49, 0x46, 0x46]) && at(8) === 0x57 && at(9) === 0x45 && at(10) === 0x42 && at(11) === 0x50; // RIFF....WEBP
    case "doc": return isOle || isZip; // .doc lama (OLE); toleransi bila sebenarnya docx
    case "docx":
    case "xlsx":
    case "pptx":
    case "zip": return isZip;
    default: return false;
  }
}

export type SavedFile = {
  path: string; // DEV: URL "/uploads/..."; PROD(GCS): object key "portal/..." (bukan URL publik)
  originalName: string;
  size: number;
  mime: string;
  storage: "local" | "gcs";
};

function sanitize(name: string): string {
  const base = name.replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.length > 80 ? base.slice(base.length - 80) : base;
}

export async function saveUpload(
  file: File,
  subdir: string,
  kind: "doc" | "chat" = "doc",
): Promise<SavedFile> {
  if (!file || file.size === 0) throw new Error("Berkas kosong atau tidak terpilih.");
  if (file.size > MAX_BYTES) throw new Error("Ukuran berkas maksimal 10 MB.");
  const ext = (file.name.split(".").pop() ?? "").toLowerCase();
  if (!ALLOWED[kind].has(ext)) {
    const list = Array.from(ALLOWED[kind]).join(", ");
    throw new Error(`Tipe berkas tidak didukung. Gunakan: ${list}.`);
  }
  const safeSub = subdir.replace(/[^a-zA-Z0-9/_-]/g, "_");
  const fname = `${Date.now()}-${sanitize(file.name)}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!matchesMagic(buffer, ext)) {
    throw new Error("Isi berkas tidak cocok dengan tipenya (ekstensi mungkin dipalsukan). Unggah berkas asli.");
  }
  const mime = file.type || "application/octet-stream";

  // PRODUKSI: bucket privat GCS (PII), simpan di bawah prefix "portal/" (mirror layout Laravel).
  if (gcsPortalConfigured()) {
    const key = `portal/${safeSub}/${fname}`;
    const saved = await uploadPortalObject({ key, buffer, contentType: mime });
    return { path: key, originalName: file.name, size: saved.size, mime, storage: "gcs" };
  }

  // DEV: penyimpanan lokal (URL statis Next).
  const dir = path.join(process.cwd(), "public", "uploads", safeSub);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fname), buffer);
  return {
    path: `/uploads/${safeSub}/${fname}`,
    originalName: file.name,
    size: file.size,
    mime,
    storage: "local",
  };
}
