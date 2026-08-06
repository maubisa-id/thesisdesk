import "server-only";
import { callText, redactLightPII, type ChatMessage } from "@/lib/ai-client";
import { runScaffold } from "@/lib/ai-scaffold";

// Abstract generator - bantu menyusun abstrak yang KUAT dari poin/isi bab yang diberikan klien.
// Scaffolding: menyusun & merapikan struktur, TIDAK mengarang hasil/angka yang tak ada di input.
// Pakai Workers AI bila dikonfigurasi; kalau tidak, fallback deterministik (panduan struktur).

export type AbstractResult = {
  content: string; // teks abstrak + kata kunci
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
};

export const ABSTRACT_DISCLAIMER =
  "Draf abstrak ini disusun dari poin yang kamu beri. Cocokkan dengan hasil penelitianmu yang sebenarnya, jangan pakai angka yang belum kamu verifikasi.";

const SYSTEM_PROMPT = `Kamu pembimbing akademik yang membantu mahasiswa Indonesia menyusun ABSTRAK skripsi dari poin/isi bab yang mereka beri. Kamu alat bantu (scaffolding), bukan penulis skripsi.

ATURAN WAJIB:
- Susun abstrak SATU paragraf, 150-250 kata, mengikuti alur: (1) latar & tujuan, (2) metode/pendekatan, (3) hasil utama, (4) kesimpulan/implikasi.
- HANYA gunakan informasi dari input. JANGAN mengarang angka, temuan, sampel, atau hasil yang tidak disebutkan. Bila sebuah bagian belum ada datanya di input, tulis penanda jelas dalam kurung siku, mis. "[isi hasil utama penelitianmu di sini]" - jangan mengada-ada.
- Bahasa Indonesia akademik baku, objektif. Tanpa sitasi, tanpa singkatan tak baku, tanpa emoji atau tanda seru.
- Setelah paragraf abstrak, beri baris "Kata kunci: " diikuti 3-5 istilah inti dipisah koma.

FORMAT KELUARAN: teks biasa - paragraf abstrak, lalu baris kosong, lalu "Kata kunci: ...". Tanpa judul markdown, tanpa penjelasan tambahan.`;

function fallback(input: string): AbstractResult {
  const r = runScaffold("abstract", input);
  return { content: r.content, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: "scaffold-local", cached: false };
}

// Susun abstrak dari poin/isi bab. `input` = poin-poin atau ringkasan bab dari klien.
// `context` (opsional) = potongan naskah relevan dari Vectorize (grounding) → abstrak menarik dari
// isi ASLI, bukan mengarang. Bila kosong, hanya menyusun dari input.
export async function generateAbstract(input: string, context?: string): Promise<AbstractResult> {
  const clean = redactLightPII(input.trim());
  const ground = context ? redactLightPII(context).slice(0, 5000) : "";
  if (!clean && !ground) return fallback("");

  const userContent = ground
    ? `POTONGAN ISI NASKAH KLIEN (grounding - dasar fakta, jangan menambah di luar ini):\n"""${ground}"""\n\nPOIN/ARAHAN TAMBAHAN DARI KLIEN:\n"""${clean || "(tidak ada; rangkum dari naskah di atas)"}"""`
    : `POIN / ISI BAB DARI KLIEN:\n"""${clean}"""`;

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userContent },
  ];

  try {
    const res = await callText(messages, { maxTokens: 700, temperature: 0.3 });
    const text = res.text.trim();
    if (!text) return fallback(clean); // model kosong -> aman
    return { content: text, tokensIn: res.tokensIn, tokensOut: res.tokensOut, model: res.model, cached: res.cached };
  } catch {
    // AiNotConfiguredError / HTTP error -> fallback deterministik (fitur tetap jalan).
    return fallback(clean);
  }
}
