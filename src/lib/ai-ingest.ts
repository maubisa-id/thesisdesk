import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  embedTexts,
  embedOne,
  upsertVectors,
  queryVector,
  vectorizeConfigured,
  type UpsertVector,
  type VectorMetadata,
} from "@/lib/vectorize";
import { gcsPortalConfigured, downloadPortalText } from "@/lib/gcs";

// Ingestion + retrieval untuk grounding naskah (RAG). Alur (thesis-fitur-p1-ai-teks.md §1.1):
//   naskah di GCS (canonical) -> [saat user PILIH dokumen untuk AI] -> baca teks -> chunk -> embed
//   (bge-m3) -> upsert Vectorize (metadata userId+docId) -> fitur AI query Vectorize (grounded).
// R2 TIDAK dipakai: ingestion jalan di VM (server action) yang sudah bisa baca GCS; byte mentah cukup
// dibaca SEKALI saat ingestion. Bentuk AI-nya ada di Vectorize, bukan di file.

const MAX_CHUNKS = 60; // pagar biaya: batasi jumlah chunk per dokumen per ingestion.

// Pecah teks jadi potongan ~1200 char dengan overlap 150 (jaga konteks lintas-batas).
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").replace(/[ \t]+\n/g, "\n").trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length && chunks.length < MAX_CHUNKS) {
    let end = Math.min(i + size, clean.length);
    // Coba potong di batas paragraf/kalimat terdekat sebelum `end` (lebih rapi).
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const brk = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "));
      if (brk > size * 0.5) end = i + brk + 1;
    }
    chunks.push(clean.slice(i, end).trim());
    i = end - overlap;
    if (i < 0) i = 0;
  }
  return chunks.filter(Boolean);
}

function vectorId(userId: number, docId: number, i: number): string {
  return `u${userId}-d${docId}-c${i}`;
}

export type IngestResult = { ok: boolean; chunks: number; reason?: string };

// Ingest teks naskah ke Vectorize. Kembalikan jumlah chunk. Graceful: kalau Vectorize belum
// dikonfigurasi -> {ok:false, reason} (pemanggil menampilkan pesan ramah, fitur lain tetap jalan).
export async function ingestText(opts: {
  userId: number;
  docId: number;
  title?: string;
  text: string;
}): Promise<IngestResult> {
  if (!vectorizeConfigured()) return { ok: false, chunks: 0, reason: "grounding-not-configured" };
  const chunks = chunkText(opts.text);
  if (chunks.length === 0) return { ok: false, chunks: 0, reason: "empty-text" };

  const vectors = await embedTexts(chunks);
  const upserts: UpsertVector[] = chunks.map((c, i) => ({
    id: vectorId(opts.userId, opts.docId, i),
    values: vectors[i]!,
    metadata: {
      userId: opts.userId,
      docId: opts.docId,
      chunk: i,
      title: opts.title,
      text: c.slice(0, 1500),
    } satisfies VectorMetadata,
  }));
  const n = await upsertVectors(upserts);
  return { ok: true, chunks: n };
}

// Ambil konteks paling relevan dari naskah yang sudah di-ingest (filter userId+docId).
// Kembalikan potongan teks tergabung (siap ditempel ke prompt) atau "" bila tak ada / belum aktif.
export async function retrieveContext(opts: {
  userId: number;
  docId: number;
  query: string;
  topK?: number;
}): Promise<string> {
  if (!vectorizeConfigured()) return "";
  try {
    const qv = await embedOne(opts.query.slice(0, 2000));
    const matches = await queryVector(qv, {
      topK: opts.topK ?? 5,
      filter: { userId: { $eq: opts.userId }, docId: { $eq: opts.docId } },
    });
    // Pertahanan ganda: saring lagi berdasar metadata (kalau filter server tak seketat harapan).
    const texts = matches
      .filter((m) => m.metadata && m.metadata.userId === opts.userId && m.metadata.docId === opts.docId)
      .map((m) => m.metadata!.text)
      .filter(Boolean);
    return texts.join("\n\n---\n\n");
  } catch {
    return "";
  }
}

// Baca teks naskah best-effort untuk ingestion.
// - PRODUKSI (GCS privat): objek txt/md di-download via service account. PDF/DOCX -> Workers AI
//   toMarkdown (job terpisah, di luar cakupan sinkron ini).
// - DEV lokal: berkas .txt/.md di public/uploads dibaca langsung.
// Kembalikan null -> pemanggil minta teks tempelan.
export async function readModuleText(filePath: string | null | undefined): Promise<string | null> {
  if (!filePath) return null;
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (ext !== "txt" && ext !== "md") return null;

  // PRODUKSI: kunci objek GCS (mis. "portal/12/171-bab.md"), bukan URL lokal.
  if (gcsPortalConfigured() && !filePath.startsWith("/uploads/")) {
    const key = filePath.replace(/^\/+/, "");
    const fromGcs = await downloadPortalText(key);
    if (fromGcs !== null) return fromGcs;
  }

  // DEV: lokal.
  try {
    const rel = filePath.replace(/^\/+/, "").replace(/^uploads\//, "");
    const abs = path.join(process.cwd(), "public", "uploads", rel);
    const buf = await readFile(abs, "utf8");
    return buf.slice(0, 200_000);
  } catch {
    return null;
  }
}
