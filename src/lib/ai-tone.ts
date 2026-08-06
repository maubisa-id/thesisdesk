import "server-only";
import { callText, extractJsonArray, redactLightPII, type ChatMessage } from "@/lib/ai-client";

// Academic Tone Enhancer - penguat bahasa akademik ("QuillBot ala-ala" TAPI etis).
// Prinsip (thesis-fitur-p1-ai-teks.md §0, §3.4): scaffolding, BUKAN ghostwriter.
// - Sugesti PER-KALIMAT, bukan menulis ulang seluruh paragraf jadi satu blok siap-tempel.
// - SETIAP sugesti WAJIB punya alasan (mendidik, bukan menggantikan).
// - BUKAN alat menghindari deteksi kesamaan; tak ada klaim anti-plagiarisme.

export const TONE_MODES = ["perjelas", "akademik", "perkuat", "eyd", "ringkas"] as const;
export type ToneMode = (typeof TONE_MODES)[number];

export function isToneMode(v: string): v is ToneMode {
  return (TONE_MODES as readonly string[]).includes(v);
}

const MODE_INSTRUCTION: Record<ToneMode, string> = {
  perjelas:
    "Perjelas kalimat yang berbelit/ambigu agar subjek-predikat jelas dan mudah dipahami penguji. Boleh memecah kalimat panjang.",
  akademik:
    "Naikkan register ke bahasa akademik baku (dekati standar SINTA/Scopus): kurangi ragam lisan, gunakan istilah tepat, jaga objektivitas. Pertahankan makna.",
  perkuat:
    "Perkuat argumen: tunjukkan klaim yang belum didukung, sarankan mengaitkan ke teori/data/sumber. JANGAN mengarang sumber atau angka - cukup tandai perlunya justifikasi.",
  eyd: "Perbaiki ejaan baku (EYD/KBBI), imbuhan, kata baku, dan tanda baca. Fokus ketepatan berbahasa Indonesia formal.",
  ringkas:
    "Padatkan tanpa menghilangkan makna: buang redundansi, gabungkan yang bertele-tele. Sebutkan pengurangan bila relevan.",
};

const SYSTEM_PROMPT = `Kamu editor akademik untuk mahasiswa Indonesia yang sedang menulis skripsi. Tugasmu memberi SUGESTI perbaikan, BUKAN menulis ulang untuk mereka. Kamu adalah alat bantu (scaffolding), bukan joki/ghostwriter.

ATURAN WAJIB:
- Analisis teks PER KALIMAT. Untuk tiap kalimat yang perlu diperbaiki, beri satu sugesti.
- SETIAP sugesti WAJIB menyertakan ALASAN singkat (kenapa lebih baik) agar penulis paham dan belajar.
- JANGAN menulis ulang seluruh paragraf menjadi satu blok "siap tempel". Sugesti bersifat per-kalimat.
- Pertahankan MAKNA dan argumen penulis. Jangan menambah klaim, data, atau sumber baru.
- Jangan mengarang sitasi, angka, penulis, atau tahun.
- Bahasa Indonesia. Jangan pakai emoji atau tanda seru.
- Kalau sebuah kalimat sudah baik, JANGAN buat sugesti untuk kalimat itu.

FORMAT KELUARAN: HANYA JSON array valid, tanpa teks lain sebelum/sesudah. Tiap elemen:
{"kutipan": "<potongan kalimat asli yang disorot>", "saran": "<versi perbaikan yang disarankan>", "alasan": "<kenapa lebih baik, singkat>"}
Kalau tidak ada yang perlu diperbaiki, kembalikan [].`;

export type ToneSuggestion = { kutipan: string; saran: string; alasan: string };

export type ToneResult = {
  suggestions: ToneSuggestion[];
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
  disclaimer: string;
};

export const TONE_DISCLAIMER =
  "Ini sugesti untuk memperkuat tulisanmu sendiri, bukan pengganti. Tinjau, pahami alasannya, lalu tulis ulang dengan kata-katamu.";

function coerceSuggestions(raw: unknown): ToneSuggestion[] {
  if (!Array.isArray(raw)) return [];
  const out: ToneSuggestion[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const kutipan = typeof o.kutipan === "string" ? o.kutipan.trim() : "";
    const saran = typeof o.saran === "string" ? o.saran.trim() : "";
    const alasan = typeof o.alasan === "string" ? o.alasan.trim() : "";
    // Guardrail etika: buang sugesti tanpa alasan (mendidik = wajib beralasan).
    if (saran && alasan) out.push({ kutipan, saran, alasan });
  }
  return out;
}

// Jalankan Tone Enhancer pada satu potongan teks (kalimat/paragraf, BUKAN bab penuh).
// Melempar AiNotConfiguredError bila AI belum diset (pemanggil menyediakan fallback).
export async function enhanceTone(mode: ToneMode, text: string): Promise<ToneResult> {
  const clean = redactLightPII(text.trim());
  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: `MODE: ${mode}\nTUGAS: ${MODE_INSTRUCTION[mode]}\n\nTEKS:\n"""${clean}"""`,
    },
  ];

  const res = await callText(messages, { maxTokens: 900, temperature: 0.2 });

  let suggestions: ToneSuggestion[] = [];
  const jsonStr = extractJsonArray(res.text);
  if (jsonStr) {
    try {
      suggestions = coerceSuggestions(JSON.parse(jsonStr));
    } catch {
      suggestions = [];
    }
  }

  return {
    suggestions,
    tokensIn: res.tokensIn,
    tokensOut: res.tokensOut,
    model: res.model,
    cached: res.cached,
    disclaimer: TONE_DISCLAIMER,
  };
}
