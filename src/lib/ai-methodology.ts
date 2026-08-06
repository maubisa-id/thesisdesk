import "server-only";
import { callText, redactLightPII, type ChatMessage } from "@/lib/ai-client";
import { runScaffold } from "@/lib/ai-scaffold";

// Pemandu Metodologi - real Workers AI bila dikonfigurasi; kalau tidak, fallback deterministik
// (runScaffold methodology). Advisory: bantu mahasiswa MEMILIH & MEMBENARKAN metode, bukan
// mengerjakan analisis. Scaffolding, bukan ghostwriter.

export type MethodologyResult = {
  content: string; // markdown panduan
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
};

export const METHODOLOGY_DISCLAIMER =
  "Panduan metodologi ini titik awal. Diskusikan dengan pembimbingmu dan sesuaikan dengan rumusan masalah & konteks lapanganmu.";

const SYSTEM_PROMPT = `Kamu pembimbing metodologi penelitian untuk mahasiswa Indonesia. Bantu mahasiswa MEMILIH pendekatan (kualitatif/kuantitatif/campuran) yang tepat untuk topik/rumusan masalahnya, dan jelaskan ALASAN + langkah kuncinya. Kamu alat bantu (scaffolding), bukan pengerja analisis.

ATURAN:
- Rekomendasikan pendekatan berdasarkan sifat rumusan masalah (apa/seberapa -> cenderung kuantitatif; bagaimana/mengapa -> cenderung kualitatif; keduanya -> campuran). Jelaskan trade-off singkat.
- Sertakan: jenis & pendekatan + alasan, populasi/sampel atau subjek + teknik pengambilan, instrumen/teknik pengumpulan data, teknik analisis + uji keabsahan (validitas-reliabilitas / triangulasi).
- JANGAN mengarang angka sampel spesifik sebagai fakta; beri rumus/pertimbangan (mis. Slovin/Cochran, saturasi data) agar mahasiswa menghitung sendiri.
- Bahasa Indonesia akademik, ringkas dan actionable. Gunakan poin/subjudul markdown. Tanpa emoji atau tanda seru.
- Tutup dengan 2-3 pertanyaan reflektif yang membantu mahasiswa memastikan pilihannya.`;

function fallback(topic: string): MethodologyResult {
  const r = runScaffold("methodology", topic);
  return { content: r.content, tokensIn: r.tokensIn, tokensOut: r.tokensOut, model: "scaffold-local", cached: false };
}

// topic = topik/judul; problem = (opsional) rumusan masalah agar rekomendasi lebih tajam.
export async function guideMethodology(topic: string, problem?: string): Promise<MethodologyResult> {
  const t = redactLightPII((topic ?? "").trim());
  const p = redactLightPII((problem ?? "").trim());
  if (!t && !p) return fallback("");

  const messages: ChatMessage[] = [
    { role: "system", content: SYSTEM_PROMPT },
    {
      role: "user",
      content: [
        `TOPIK/JUDUL: ${t || "(belum spesifik)"}`,
        p ? `RUMUSAN MASALAH: ${p}` : "RUMUSAN MASALAH: (belum diberikan - beri panduan memilih berdasarkan topik + cara merumuskannya)",
      ].join("\n"),
    },
  ];

  try {
    const res = await callText(messages, { maxTokens: 900, temperature: 0.3 });
    const text = res.text.trim();
    if (!text) return fallback(t);
    return { content: text, tokensIn: res.tokensIn, tokensOut: res.tokensOut, model: res.model, cached: res.cached };
  } catch {
    return fallback(t);
  }
}
