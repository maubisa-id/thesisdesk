import "server-only";
import { Storage } from "@google-cloud/storage";

// Akses GCS untuk NASKAH PORTAL (PII) di bucket PRIVAT terpisah dari aset publik cdn.maubisa.id.
// Prinsip (thesis-fitur-p1-ai-teks.md §1.1 + audit keamanan): dokumen mahasiswa TIDAK boleh publik.
// Bucket privat (PAP enforced, UBLA) diakses hanya oleh layanan via service account (ADC di VM),
// dan disajikan ke klien lewat SIGNED URL ber-TTL pendek - bukan URL publik.
//
// ENV:
//   GCS_PORTAL_BUCKET  : nama bucket privat (mis. "maubisa-portal-doc"). Kosong -> GCS non-aktif
//                         (dev pakai penyimpanan lokal di upload.ts).
//   GCP_PROJECT_ID     : project id (opsional; ADC biasanya sudah membawanya).
//   GOOGLE_APPLICATION_CREDENTIALS : path key file (opsional; di VM pakai metadata SA, tak perlu).
//
// Signing: V4 signed URL. Dengan ADC tanpa key file, library memakai IAM signBlob - SA butuh peran
// roles/iam.serviceAccountTokenCreator pada dirinya sendiri (atau sediakan key file).

export function gcsPortalConfigured(): boolean {
  return Boolean(process.env.GCS_PORTAL_BUCKET);
}

let cached: Storage | null = null;
function client(): Storage {
  if (cached) return cached;
  cached = new Storage({
    projectId: process.env.GCP_PROJECT_ID || undefined,
    keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || undefined,
  });
  return cached;
}

function bucketName(): string {
  const b = process.env.GCS_PORTAL_BUCKET;
  if (!b) throw new Error("GCS_PORTAL_BUCKET belum diset.");
  return b;
}

export type PortalObject = { key: string; size: number; contentType: string };

// Unggah byte ke bucket privat. `key` = path objek relatif (mis. "portal/12/171-draft.pdf").
export async function uploadPortalObject(opts: {
  key: string;
  buffer: Buffer;
  contentType: string;
}): Promise<PortalObject> {
  const file = client().bucket(bucketName()).file(opts.key);
  await file.save(opts.buffer, {
    resumable: false,
    contentType: opts.contentType,
    metadata: { cacheControl: "private, max-age=0, no-transform" },
  });
  return { key: opts.key, size: opts.buffer.length, contentType: opts.contentType };
}

// URL baca bertanda-tangan (V4), TTL pendek. Untuk menyajikan dokumen ke klien tanpa akses publik.
export async function signedReadUrl(key: string, ttlMs = 30 * 60_000): Promise<string> {
  const [url] = await client()
    .bucket(bucketName())
    .file(key)
    .getSignedUrl({ version: "v4", action: "read", expires: Date.now() + ttlMs });
  return url;
}

// Unduh objek sebagai Buffer (untuk ingestion: toMarkdown/embup). Melempar bila objek tak ada.
export async function downloadPortalBuffer(key: string): Promise<Buffer> {
  const [buf] = await client().bucket(bucketName()).file(key).download();
  return buf;
}

// Unduh objek teks (txt/md) sebagai string. PDF/DOCX diproses terpisah (Workers AI toMarkdown).
export async function downloadPortalText(key: string): Promise<string | null> {
  const ext = key.split(".").pop()?.toLowerCase();
  if (ext !== "txt" && ext !== "md") return null;
  try {
    const buf = await downloadPortalBuffer(key);
    return buf.toString("utf8").slice(0, 200_000);
  } catch {
    return null;
  }
}

export async function deletePortalObject(key: string): Promise<void> {
  await client().bucket(bucketName()).file(key).delete({ ignoreNotFound: true });
}
