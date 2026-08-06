// Asisten nulis AI - SCAFFOLDING, bukan ghostwriter (etika akademik, best-practices §H).
// Implementasi lokal DETERMINISTIK (nol token, nol biaya) yang menghasilkan KERANGKA, UMPAN
// BALIK, dan PERTANYAAN - bukan naskah jadi. Di produksi, ganti fungsi ini dengan Vercel AI SDK
// (streaming) + worker BullMQ + metering token; kontraknya (input → {content, data}) tetap sama.

export const AI_DISCLAIMER =
  "Ini alat bantu (scaffolding) untuk mempercepat proses & pemahamanmu - bukan pengganti " +
  "tulisanmu sendiri. Tinjau, verifikasi, dan tulis ulang dengan kata-katamu sebelum dipakai.";

export type ScaffoldResult = {
  content: string;
  data?: unknown;
  tokensIn: number;
  tokensOut: number;
};

const est = (s: string) => Math.max(1, Math.round(s.length / 4));

function outline(topic: string): ScaffoldResult {
  const t = topic.trim() || "topik skripsimu";
  const bab: { bab: string; poin: string[] }[] = [
    {
      bab: "BAB I - Pendahuluan",
      poin: [
        `Latar belakang: fenomena/masalah seputar "${t}" dan mengapa penting diteliti sekarang`,
        "Rumusan masalah: 2-3 pertanyaan penelitian yang tajam dan terukur",
        "Tujuan & manfaat: teoretis (menambah khazanah) dan praktis (bagi siapa)",
        "Batasan masalah: ruang lingkup agar penelitian fokus dan selesai tepat waktu",
      ],
    },
    {
      bab: "BAB II - Tinjauan Pustaka",
      poin: [
        "Landasan teori: definisi konsep kunci dari sumber primer (bukan blog)",
        `Penelitian terdahulu: minimal 5 rujukan relevan dengan "${t}" (5 tahun terakhir)`,
        "Kerangka berpikir: bagan hubungan antar-variabel",
        "Hipotesis (bila kuantitatif): dugaan yang bisa diuji",
      ],
    },
    {
      bab: "BAB III - Metodologi",
      poin: [
        "Jenis & pendekatan penelitian (kualitatif/kuantitatif/campuran) + alasannya",
        "Populasi & sampel / subjek + teknik pengambilan",
        "Instrumen & teknik pengumpulan data (kuesioner/wawancara/observasi)",
        "Teknik analisis data + uji validitas-reliabilitas",
      ],
    },
    {
      bab: "BAB IV - Hasil & Pembahasan",
      poin: [
        "Deskripsi data / profil responden",
        "Hasil analisis menjawab tiap rumusan masalah (tabel/grafik)",
        "Pembahasan: kaitkan hasil dengan teori & penelitian terdahulu (setuju/berbeda)",
        "Keterbatasan penelitian",
      ],
    },
    {
      bab: "BAB V - Penutup",
      poin: [
        "Kesimpulan: jawaban ringkas atas tiap rumusan masalah",
        "Saran: praktis (bagi pihak terkait) dan akademis (bagi peneliti lanjutan)",
      ],
    },
  ];
  const content =
    `# Kerangka BAB - ${t}\n\n` +
    bab
      .map(
        (b) =>
          `## ${b.bab}\n` + b.poin.map((p) => `- ${p}`).join("\n"),
      )
      .join("\n\n") +
    `\n\n> Kerangka ini titik mulai. Isi tiap poin dengan argumen & datamu sendiri.`;
  return { content, data: bab, tokensIn: est(topic), tokensOut: est(content) };
}

// Pemeriksa EYD berbasis aturan (bukan model). Menyorot pola umum yang sering salah.
function eydCheck(text: string): ScaffoldResult {
  const findings: { issue: string; saran: string }[] = [];
  const rules: { re: RegExp; issue: string; saran: string }[] = [
    { re: /\bdimana\b/gi, issue: '"dimana" sebagai kata sambung', saran: 'Gunakan "tempat", "yang", atau pecah kalimat. "Dimana" hanya untuk kalimat tanya.' },
    { re: /\bdi mana\b/gi, issue: '"di mana" sebagai penghubung', saran: 'Dalam kalimat pernyataan, ganti dengan "tempat"/"yang".' },
    { re: /\bdi (buat|lakukan|teliti|gunakan|analisis|olah|ambil|dapat|peroleh|sajikan)\b/gi, issue: 'Awalan "di-" ditulis terpisah', saran: 'Awalan "di-" pada kata kerja pasif ditulis serangkai (mis. "dibuat", "dilakukan").' },
    { re: /\bdari pada\b/gi, issue: '"dari pada"', saran: 'Untuk perbandingan tulis serangkai: "daripada".' },
    { re: /\bmerubah\b/gi, issue: '"merubah" (baku: mengubah)', saran: 'Kata dasar "ubah" → "mengubah".' },
    { re: /\bmensukseskan\b/gi, issue: '"mensukseskan"', saran: 'Baku: "menyukseskan".' },
    { re: /\bresiko\b/gi, issue: '"resiko"', saran: 'Baku: "risiko".' },
    { re: /\banalisa\b/gi, issue: '"analisa"', saran: 'Baku (kata benda): "analisis".' },
    { re: /\bteknik\b/gi, issue: 'cek ejaan teknis', saran: 'Pastikan istilah teknis konsisten & baku sesuai KBBI.' },
    { re: /\s{2,}/g, issue: "Spasi ganda", saran: "Rapikan menjadi satu spasi." },
    { re: /\b(?:kwalitas|kwantitas)\b/gi, issue: '"kwalitas/kwantitas"', saran: 'Baku: "kualitas"/"kuantitas".' },
  ];
  const seen = new Set<string>();
  for (const r of rules) {
    if (r.re.test(text) && !seen.has(r.issue)) {
      seen.add(r.issue);
      findings.push({ issue: r.issue, saran: r.saran });
    }
  }
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const longOnes = sentences.filter((s) => s.split(/\s+/).length > 35).length;
  if (longOnes > 0) {
    findings.push({
      issue: `${longOnes} kalimat sangat panjang (>35 kata)`,
      saran: "Pertimbangkan memecah agar lebih mudah dibaca penguji.",
    });
  }
  const content =
    findings.length === 0
      ? "Tidak ada pola kesalahan umum yang terdeteksi. Tetap baca ulang manual untuk konteks & makna."
      : `Ditemukan ${findings.length} hal untuk ditinjau:\n\n` +
        findings.map((f, i) => `${i + 1}. **${f.issue}** - ${f.saran}`).join("\n");
  return { content, data: findings, tokensIn: est(text), tokensOut: est(content) };
}

function abstract(input: string): ScaffoldResult {
  const content =
    "Struktur abstrak yang kuat (150-250 kata, satu paragraf):\n\n" +
    "1. **Latar & tujuan** (1-2 kalimat): masalah + apa yang diteliti.\n" +
    "2. **Metode** (1-2 kalimat): pendekatan, subjek/sampel, teknik analisis.\n" +
    "3. **Hasil utama** (2-3 kalimat): temuan terpenting, sebutkan angka bila ada.\n" +
    "4. **Kesimpulan & implikasi** (1 kalimat): makna temuan bagi teori/praktik.\n\n" +
    "Kata kunci: 3-5 istilah inti, dipisah koma.\n\n" +
    (input.trim()
      ? `Dari poin yang kamu beri:\n> ${input.trim()}\n\nSusun tiap bagian di atas dengan kalimatmu sendiri.`
      : "Isi kolom di atas dengan poin-poin bab-mu untuk panduan lebih spesifik.");
  return { content, tokensIn: est(input), tokensOut: est(content) };
}

function methodology(topic: string): ScaffoldResult {
  const content =
    `Pemandu metodologi untuk "${topic.trim() || "penelitianmu"}":\n\n` +
    "- **Kuantitatif** bila menguji hubungan/pengaruh antar-variabel & butuh generalisasi. " +
    "Uji umum: regresi, uji-t, ANOVA, korelasi. Tentukan ukuran sampel (Slovin/Cochran).\n" +
    "- **Kualitatif** bila menggali makna/pengalaman mendalam. Teknik: wawancara mendalam, " +
    "observasi, studi kasus. Analisis: tematik/naratif; jaga keabsahan (triangulasi).\n" +
    "- **Campuran** bila butuh keduanya (mis. survei + wawancara penjelas).\n\n" +
    "Cek kesesuaian: rumusan masalah menanyakan *apa/seberapa* (kuantitatif) atau " +
    "*bagaimana/mengapa* (kualitatif)?";
  return { content, tokensIn: est(topic), tokensOut: est(content) };
}

export type DefenseQ = { question: string; category: string; difficulty: string };

function defenseQuestions(topic: string): ScaffoldResult {
  const t = topic.trim() || "penelitianmu";
  const bank: DefenseQ[] = [
    { question: `Apa yang melatarbelakangi kamu memilih topik "${t}"?`, category: "umum", difficulty: "mudah" },
    { question: "Apa kontribusi orisinal penelitianmu dibanding penelitian terdahulu?", category: "kontribusi", difficulty: "sulit" },
    { question: "Mengapa kamu memilih metode ini, bukan alternatif lain?", category: "metodologi", difficulty: "sedang" },
    { question: "Bagaimana kamu memastikan validitas dan reliabilitas instrumenmu?", category: "metodologi", difficulty: "sulit" },
    { question: "Teori utama apa yang kamu pakai, dan mengapa relevan?", category: "teori", difficulty: "sedang" },
    { question: "Coba jelaskan temuan terpentingmu dalam satu kalimat.", category: "hasil", difficulty: "mudah" },
    { question: "Apakah hasilmu sejalan atau bertentangan dengan penelitian sebelumnya? Jelaskan.", category: "hasil", difficulty: "sedang" },
    { question: "Apa keterbatasan penelitianmu, dan bagaimana itu memengaruhi kesimpulan?", category: "hasil", difficulty: "sedang" },
    { question: "Jika mengulang, apa yang akan kamu perbaiki dari desain penelitian?", category: "metodologi", difficulty: "sedang" },
    { question: "Bagaimana sampel/subjekmu dipilih, dan apakah cukup representatif?", category: "metodologi", difficulty: "sedang" },
    { question: "Apa implikasi praktis temuanmu bagi pihak terkait?", category: "kontribusi", difficulty: "mudah" },
    { question: "Bagaimana kamu mengolah data, dan mengapa teknik itu tepat?", category: "teknis", difficulty: "sulit" },
  ];
  const content =
    `Bank pertanyaan penguji untuk "${t}" (${bank.length} pertanyaan). ` +
    "Latih jawabanmu singkat, percaya diri, dan berbasis data. Jangan hafal - pahami.";
  return { content, data: bank, tokensIn: est(topic), tokensOut: est(content) };
}

export type ReviewAssist = {
  summary: string;
  issues: { title: string; detail: string }[];
  drafts: string[];
};

// Pra-baca draft UNTUK TUTOR (human-in-the-loop): ringkas + 3 isu prioritas + draf komentar siap
// sunting. Deterministik/lokal (nol token). Tutor WAJIB meninjau sebelum kirim (AI = scaffolding,
// bukan penilai). Di produksi: ganti dengan LLM + RAG dokumen, kontrak {content, data} tetap sama.
function tutorReviewAssist(input: string): ScaffoldResult {
  let title = input.trim();
  let note = "";
  let version = 1;
  try {
    const p = JSON.parse(input) as { title?: string; note?: string | null; version?: number };
    if (p && typeof p === "object") {
      title = (p.title ?? "").trim() || title;
      note = (p.note ?? "").trim();
      version = p.version ?? 1;
    }
  } catch {
    /* input = teks judul biasa */
  }

  const summary =
    `Pra-baca draft v${version}${title ? ` "${title}"` : ""}. ` +
    (note ? `Fokus yang diminta penulis: ${note}. ` : "Penulis tidak menyertakan catatan fokus. ") +
    "Bandingkan dengan versi sebelumnya untuk melihat perubahan struktur, argumen, dan data.";

  const issues: ReviewAssist["issues"] = [
    { title: "Klaim tanpa bukti", detail: "Tandai paragraf yang masih asertif tanpa data atau sitasi pendukung, terutama di latar belakang dan pembahasan." },
    { title: "Konsistensi metode dan hasil", detail: "Pastikan hasil yang dilaporkan menjawab seluruh rumusan masalah dan sesuai teknik analisis di BAB III." },
    { title: "Bahasa dan sitasi", detail: "Periksa gaya bahasa akademik dan kelengkapan sitasi: format konsisten, sumber primer 5 tahun terakhir." },
  ];

  const drafts = [
    "Bagian ini menarik, tetapi klaimnya perlu didukung sitasi primer. Bisa tambahkan rujukan yang relevan?",
    "Tolong kaitkan hasil ini dengan rumusan masalah dan teori di BAB II agar pembahasannya lebih tajam.",
    "Cek konsistensi istilah dan format sitasi pada paragraf ini agar seragam dengan bagian lain.",
  ];

  const content =
    `Ringkasan: ${summary}\n\nTiga isu prioritas:\n` +
    issues.map((s, i) => `${i + 1}. ${s.title} - ${s.detail}`).join("\n") +
    "\n\nCatatan: ini bantuan pra-baca (scaffolding). Tinjau dokumen sendiri sebelum mengirim komentar ke klien.";

  return { content, data: { summary, issues, drafts } satisfies ReviewAssist, tokensIn: est(input), tokensOut: est(content) };
}

export function runScaffold(kind: string, input: string): ScaffoldResult {
  switch (kind) {
    case "outline":
      return outline(input);
    case "eyd_check":
      return eydCheck(input);
    case "abstract":
      return abstract(input);
    case "methodology":
      return methodology(input);
    case "defense_questions":
      return defenseQuestions(input);
    case "tutor_review_assist":
      return tutorReviewAssist(input);
    case "paraphrase":
      return {
        content:
          "Parafrase yang baik = ubah struktur & diksi, PERTAHANKAN makna, lalu SITASI sumber " +
          "aslinya. Langkah: (1) baca & tutup sumber, (2) tulis ulang dari ingatan dengan " +
          "kalimatmu, (3) bandingkan agar tak sama persis, (4) tambahkan sitasi. Menyalin lalu " +
          "menukar sinonim BUKAN parafrase dan berisiko plagiarisme.",
        tokensIn: est(input),
        tokensOut: 80,
      };
    default:
      return outline(input);
  }
}
