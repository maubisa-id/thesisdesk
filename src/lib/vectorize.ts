import "server-only";

// Klien Cloudflare Vectorize (grounding RAG) + embedding via Workers AI (bge-m3).
// Semua env-gated: kalau CF_VECTORIZE_INDEX / kredensial kosong -> no-op (fitur AI tetap jalan tanpa
// grounding). Ini fondasi anti-halusinasi (usp §Anti-Halusinasi): fitur yang menyentuh isi skripsi
// berlabuh ke naskah klien di Vectorize, bukan mengarang.
//
// ENV:
//   CF_ACCOUNT_ID        : id akun Cloudflare (dipakai bersama Workers AI)
//   CF_VECTORIZE_INDEX   : nama index Vectorize (mis. "thesis-naskah")
//   CF_VECTORIZE_TOKEN   : token dgn izin Vectorize (opsional; fallback ke CF_AI_TOKEN)
//   CF_EMBED_MODEL       : model embedding (default @cf/baai/bge-m3, dimensi 1024)
//
// Catatan setup: index dibuat sekali (wrangler/REST) dengan dimensi model + metadata index untuk
// field "userId" & "docId" agar filter query cepat. Lihat doc thesis-fitur-p1-ai-teks.md §1.1.

export const DEFAULT_EMBED_MODEL = "@cf/baai/bge-m3";

export function embedModel(): string {
  return process.env.CF_EMBED_MODEL || DEFAULT_EMBED_MODEL;
}

function vectorizeToken(): string | undefined {
  return process.env.CF_VECTORIZE_TOKEN || process.env.CF_AI_TOKEN;
}

export function vectorizeConfigured(): boolean {
  return Boolean(process.env.CF_ACCOUNT_ID && vectorizeToken() && process.env.CF_VECTORIZE_INDEX);
}

export type VectorMetadata = {
  userId: number;
  docId: number;
  chunk: number;
  title?: string;
  text: string;
};

export type VectorMatch = { id: string; score: number; metadata: VectorMetadata | null };

const acct = () => process.env.CF_ACCOUNT_ID!;
const indexName = () => process.env.CF_VECTORIZE_INDEX!;

// ── Embedding (Workers AI bge-m3) ──
// Mengembalikan satu vektor per teks. Melempar Error bila gagal (pemanggil menangani -> tanpa grounding).
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (!process.env.CF_ACCOUNT_ID || !process.env.CF_AI_TOKEN) {
    throw new Error("Embedding belum dikonfigurasi (CF_ACCOUNT_ID + CF_AI_TOKEN).");
  }
  const model = embedModel().replace(/^@/, "");
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct()}/ai/run/@${model}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.CF_AI_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ text: texts }),
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Embedding gagal: ${res.status}`);
  const json = (await res.json()) as { result?: { data?: number[][] }; success?: boolean };
  const data = json.result?.data;
  if (!Array.isArray(data) || data.length !== texts.length) throw new Error("Bentuk embedding tak terduga.");
  return data;
}

export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embedTexts([text]);
  if (!v) throw new Error("Embedding kosong.");
  return v;
}

// ── Vectorize upsert (NDJSON, v2) ──
export type UpsertVector = { id: string; values: number[]; metadata: VectorMetadata };

export async function upsertVectors(vectors: UpsertVector[]): Promise<number> {
  if (!vectorizeConfigured()) return 0;
  if (vectors.length === 0) return 0;
  const ndjson = vectors.map((v) => JSON.stringify(v)).join("\n");
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct()}/vectorize/v2/indexes/${indexName()}/upsert`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${vectorizeToken()}`, "content-type": "application/x-ndjson" },
    body: ndjson,
    signal: AbortSignal.timeout(20000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vectorize upsert gagal: ${res.status}`);
  return vectors.length;
}

// ── Vectorize query (v2) ──
export async function queryVector(
  values: number[],
  opts: { topK?: number; filter?: Record<string, unknown> } = {},
): Promise<VectorMatch[]> {
  if (!vectorizeConfigured()) return [];
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct()}/vectorize/v2/indexes/${indexName()}/query`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${vectorizeToken()}`, "content-type": "application/json" },
    body: JSON.stringify({
      vector: values,
      topK: opts.topK ?? 5,
      returnMetadata: "all",
      ...(opts.filter ? { filter: opts.filter } : {}),
    }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vectorize query gagal: ${res.status}`);
  const json = (await res.json()) as {
    result?: { matches?: { id: string; score: number; metadata?: VectorMetadata }[] };
  };
  return (json.result?.matches ?? []).map((m) => ({ id: m.id, score: m.score, metadata: m.metadata ?? null }));
}

// Hapus vektor per id (eviction saat dokumen diarsip / consent dicabut).
export async function deleteVectors(ids: string[]): Promise<number> {
  if (!vectorizeConfigured() || ids.length === 0) return 0;
  const url = `https://api.cloudflare.com/client/v4/accounts/${acct()}/vectorize/v2/indexes/${indexName()}/delete_by_ids`;
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${vectorizeToken()}`, "content-type": "application/json" },
    body: JSON.stringify({ ids }),
    signal: AbortSignal.timeout(15000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Vectorize delete gagal: ${res.status}`);
  return ids.length;
}
