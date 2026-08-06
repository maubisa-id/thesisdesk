import "server-only";
import { callText, extractJsonArray, redactLightPII, type ChatMessage } from "@/lib/ai-client";
import { runScaffold } from "@/lib/ai-scaffold";

// Outline generator - judul/topik -> kerangka BAB berisi POIN PANDUAN (bukan isi jadi).
// Scaffolding: kerangka = titik mulai, penulis mengisi argumen & datanya sendiri.
// Pakai Workers AI bila dikonfigurasi; kalau tidak, fallback deterministik (ai-scaffold outline).

export type OutlineChapter = { bab: string; poin: string[] };

export type OutlineResult = {
  content: string; // markdown kerangka
  chapters: OutlineChapter[];
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
};

export const OUTLINE_DISCLAIMER =
  "Kerangka ini titik mulai. Isi tiap poin dengan argumen dan datamu sendiri.";

const SYSTEM_PROMPT = `Kamu pembimbing metodologi skripsi untuk mahasiswa Indonesia. Buatkan KERANGKA bab skripsi dari topik yang diberikan. Kerangka berisi POIN PANDUAN (apa yang harus dibahas), BUKAN isi/paragraf jadi. Kamu alat bantu (scaffolding), bukan penulis skripsi.

ATURAN:
- Struktur umum skripsi Indonesia: BAB I Pendahuluan, BAB II Tinjauan Pustaka, BAB III Metodologi, BAB IV Hasil & Pembahasan, BAB V Penutup. Sesuaikan bila topik jelas kualitatif/kuantitatif.
- Tiap bab berisi 3-5 poin panduan yang spesifik ke topik (bukan generik).
- JANGAN mengarang teori, sumber, angka, atau nama peneliti. Poin boleh menyebut "cari minimal 5 rujukan relevan", bukan menyebut rujukan spesifik yang tidak pasti ada.
- Bahasa Indonesia akademik. Tanpa emoji atau tanda seru.

FORMAT KELUARAN: HANYA JSON array valid, tanpa teks lain. Tiap elemen:
{"bab": "BAB I - Pendahuluan", "poin": ["poin 1", "poin 2", ...]}`;

function coerceChapters(raw: unknown): OutlineChapter[] {
  if (!Array.isArray(raw)) return [];
  const out: OutlineChapter[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const bab = typeof o.bab === "string" ? o.bab.trim() : "";
    const poin = Array.isArray(o.poin)
      ? o.poin.filter((p): p is string => typeof p === "string").map((p) => p.trim()).filter(Boolean)
      : [];
    if (bab && poin.length) out.push({ bab, poin });
  }
  return out;
}

function toMarkdown(topic: string, chapters: OutlineChapter[]): string {
  return (
    `# Kerangka BAB - ${topic}\n\n` +
    chapters.map((c) => `## ${c.bab}\n` + c.poin.map((p) => `- ${p}`).join("\n")).join("\n\n") +
    `\n\n> ${OUTLINE_DISCLAIMER}`
  );
}

// Fallback deterministik: pakai runScaffold("outline") yang sudah ada (nol token).
function fallback(topic: string): OutlineResult {
  const r = runScaffold("outline", topic);
  const chapters = (r.data as OutlineChapter[] | undefined) ?? [];
  return {
    content: r.content,
    chapters,
    tokensIn: r.tokensIn,
    tokensOut: r.tokensOut,
    model: "scaffold-local",
    cached: false,
  };
}

// Hasilkan kerangka BAB. field = bidang/prodi (opsional) untuk konteks.
export async function generateOutline(topic: string, field?: string): Promise<OutlineResult> {
  const clean = redactLightPII(topic.trim()) || "topik skripsi";
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `TOPIK/JUDUL: ${clean}${field ? `\nBIDANG: ${field}` : ""}`,
    },
  ];

  try {
    const res = await callText(messages, { maxTokens: 900, temperature: 0.4 });
    const jsonStr = extractJsonArray(res.text);
    const chapters = jsonStr ? coerceChapters(JSON.parse(jsonStr)) : [];
    if (chapters.length === 0) return fallback(clean); // parse gagal / model ngawur -> aman
    return {
      content: toMarkdown(clean, chapters),
      chapters,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      model: res.model,
      cached: res.cached,
    };
  } catch {
    // AiNotConfiguredError / HTTP / JSON error -> fallback deterministik (fitur tetap jalan).
    return fallback(clean);
  }
}
