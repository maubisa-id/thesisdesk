import "server-only";
import { callText, extractJsonArray, redactLightPII, type ChatMessage } from "@/lib/ai-client";
import { runScaffold } from "@/lib/ai-scaffold";
import type { ReviewAssist } from "@/lib/ai-scaffold";

// AI pra-baca draft UNTUK TUTOR (human-in-the-loop). Real Workers AI bila dikonfigurasi; kalau tidak,
// fallback ke stub deterministik (runScaffold tutor_review_assist). Kontrak keluaran SAMA:
// { summary, issues[{title,detail}], drafts[] } supaya UI tutor-review-tools.tsx tak berubah.
//
// Prinsip (blueprint §5.7, usp Penunjang Tutor): AI = scaffolding, tutor tetap PEMUTUS. Output ini
// draf komentar yang WAJIB ditinjau/diedit tutor sebelum dikirim ke klien. Bukan penilai.

export type ReviewResult = ReviewAssist & {
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
  grounded: boolean;
};

const SYSTEM_PROMPT = `Kamu asisten pra-baca untuk DOSEN PEMBIMBING skripsi (bukan untuk mahasiswa). Tugasmu membantu tutor me-review draft mahasiswa lebih cepat: ringkas fokusnya, tunjukkan isu prioritas, dan siapkan DRAF komentar yang bisa tutor sunting. Kamu alat bantu (scaffolding); tutor tetap pengambil keputusan akhir.

ATURAN WAJIB:
- Nada profesional, membangun, untuk disampaikan tutor ke mahasiswa. Bahasa Indonesia akademik.
- JANGAN memberi nilai/lulus-tidak. JANGAN mengarang isi dokumen yang tak ada di konteks.
- Isu berbasis prinsip metodologi & penulisan akademik (klaim tanpa bukti, konsistensi metode-hasil, sitasi, kejelasan argumen).
- Draf komentar berupa pertanyaan/arahan yang mendidik, bukan menuliskan ulang skripsi mahasiswa.
- Tanpa emoji, tanpa tanda seru berlebihan.

FORMAT KELUARAN: HANYA satu objek JSON valid, tanpa teks lain. Bentuk:
{"summary":"<ringkasan 1-2 kalimat fokus review>","issues":[{"title":"<judul isu singkat>","detail":"<penjelasan + apa yang tutor perlu cek>"}],"drafts":["<draf komentar siap sunting>", "..."]}
Beri 3 issues dan 3 drafts.`;

function coerce(raw: unknown): ReviewAssist | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const summary = typeof o.summary === "string" ? o.summary.trim() : "";
  const issuesRaw = Array.isArray(o.issues) ? o.issues : [];
  const issues = issuesRaw
    .map((it) => {
      if (!it || typeof it !== "object") return null;
      const r = it as Record<string, unknown>;
      const title = typeof r.title === "string" ? r.title.trim() : "";
      const detail = typeof r.detail === "string" ? r.detail.trim() : "";
      return title && detail ? { title, detail } : null;
    })
    .filter((x): x is { title: string; detail: string } => Boolean(x));
  const drafts = (Array.isArray(o.drafts) ? o.drafts : [])
    .map((d) => (typeof d === "string" ? d.trim() : ""))
    .filter(Boolean);
  if (!summary || issues.length === 0 || drafts.length === 0) return null;
  return { summary, issues, drafts };
}

// Ekstrak objek JSON pertama (balanced-scan) dari teks model - pendamping extractJsonArray untuk objek.
function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

export type ReviewInput = {
  title: string;
  note?: string | null;
  version?: number;
  context?: string | null; // potongan naskah dari Vectorize (grounding), opsional
};

function fallback(input: ReviewInput): ReviewResult {
  const r = runScaffold(
    "tutor_review_assist",
    JSON.stringify({ title: input.title, note: input.note ?? null, version: input.version ?? 1 }),
  );
  const data = r.data as ReviewAssist;
  return { ...data, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: "scaffold-local", cached: false, grounded: false };
}

export async function reviewDraft(input: ReviewInput): Promise<ReviewResult> {
  const title = (input.title ?? "").trim();
  const note = (input.note ?? "").trim();
  const version = input.version ?? 1;
  const context = input.context ? redactLightPII(input.context).slice(0, 6000) : "";

  const userParts = [
    `JUDUL DRAFT: ${title || "(tanpa judul)"}`,
    `VERSI: ${version}`,
    note ? `CATATAN FOKUS DARI MAHASISWA: ${note}` : "CATATAN FOKUS: (tidak ada)",
    context
      ? `\nPOTONGAN ISI NASKAH (untuk konteks, jangan dikutip mentah ke mahasiswa):\n"""${context}"""`
      : "\n(Isi naskah belum tersedia untuk konteks - beri isu berbasis prinsip umum + minta tutor verifikasi di dokumen.)",
  ];

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userParts.join("\n") },
  ];

  try {
    const res = await callText(messages, { maxTokens: 900, temperature: 0.3 });
    const jsonStr = extractJsonObject(res.text) ?? extractJsonArray(res.text);
    const parsed = jsonStr ? coerce(JSON.parse(jsonStr)) : null;
    if (!parsed) return fallback(input); // model gagal terstruktur -> aman
    return {
      ...parsed,
      tokensIn: res.tokensIn,
      tokensOut: res.tokensOut,
      model: res.model,
      cached: res.cached,
      grounded: Boolean(context),
    };
  } catch {
    return fallback(input);
  }
}
