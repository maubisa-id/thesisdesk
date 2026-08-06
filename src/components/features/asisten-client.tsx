"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { runAiTool, rateAiOutput } from "@/lib/actions";
import { generateOutlineText, generateAbstractText, enhanceTextTone, generateMethodologyText, ingestDocumentForAI } from "@/lib/ai-text-actions";
import { AI_DISCLAIMER } from "@/lib/ai-scaffold";
import { DisclaimerBanner } from "@/components/states";
import { MarkdownLite } from "@/components/markdown-lite";
import { IconSparkle, IconArrow, IconCheck, IconClose, IconPlus, IconDoc, IconUpload } from "@/components/icons";

type DocItem = { id: number; label: string; version: number };

type ContentKind = "outline" | "abstract" | "eyd_check" | "paraphrase" | "methodology";
type ToolKind = "tone" | ContentKind;

type Tool = { kind: ToolKind; label: string; desc: string; ai: boolean };

// Grup 1 - Alat AI: benar-benar mengolah TEKS-mu (badge "AI"), dengan fallback deterministik.
const AI_TOOLS: Tool[] = [
  { kind: "tone", label: "Perkuat Kalimat", desc: "Sugesti per-kalimat untuk memperkuat bahasa akademik (Tone Enhancer)", ai: true },
  { kind: "outline", label: "Kerangka BAB", desc: "Judul jadi struktur BAB I-V", ai: true },
  { kind: "abstract", label: "Abstrak", desc: "Susun abstrak dari poin/isi bab (grounding bila dokumen dipilih)", ai: true },
  { kind: "methodology", label: "Pemandu Metodologi", desc: "Rekomendasi kualitatif / kuantitatif / campuran + alasan", ai: true },
];

// Grup 2 - Panduan: penjelasan deterministik (nol token), BUKAN AI mengerjakan teksmu.
const GUIDE_TOOLS: Tool[] = [
  { kind: "eyd_check", label: "Perapian EYD", desc: "Sorot ejaan yang sering salah" },
  { kind: "paraphrase", label: "Panduan Parafrase", desc: "Parafrase yang beretika" },
].map((t) => ({ ...t, ai: false })) as Tool[];

const TONE_MODES = [
  { k: "perjelas", label: "Perjelas" },
  { k: "akademik", label: "Akademik" },
  { k: "perkuat", label: "Perkuat argumen" },
  { k: "eyd", label: "EYD & tata bahasa" },
  { k: "ringkas", label: "Ringkas" },
] as const;
type ToneModeKey = (typeof TONE_MODES)[number]["k"];

type ToneSugg = { kutipan: string; saran: string; alasan: string };

const PLACEHOLDER =
  "Tulis atau tempel di sini bagian naskah yang mau digarap (kalimat/paragraf/topik). Pilih alat di bawah, lalu minta saran - saran muncul di bawah tanpa menimpa tulisanmu.";

export function AsistenClient({ documents = [] }: { documents?: DocItem[] }) {
  const [source, setSource] = useState<"paste" | "doc">("paste");
  const [docId, setDocId] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [tool, setTool] = useState<Tool>(AI_TOOLS[0]);
  const [toneMode, setToneMode] = useState<ToneModeKey>("akademik");

  // Hasil "content" (outline/abstrak/panduan): satu blok teks yang bisa disisipkan.
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [suggestedBy, setSuggestedBy] = useState<Tool | null>(null);
  const [aiUsed, setAiUsed] = useState<boolean | null>(null);
  const [contentJobId, setContentJobId] = useState<number | null>(null);
  const [contentRated, setContentRated] = useState<number | null>(null);

  // Hasil Tone Enhancer: daftar sugesti per-kalimat (terima/lewati).
  const [toneSuggs, setToneSuggs] = useState<ToneSugg[] | null>(null);
  const [toneJobId, setToneJobId] = useState<number | null>(null);
  const [toneRated, setToneRated] = useState<number | null>(null);
  const [toneNote, setToneNote] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [grounded, setGrounded] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  const selectedDoc = documents.find((d) => d.id === docId) ?? null;
  const groundingDocId = source === "doc" ? docId : null;

  function resetResults() {
    setError(null);
    setSuggestion(null);
    setContentRated(null);
    setAiUsed(null);
    setGrounded(false);
    setToneSuggs(null);
    setToneRated(null);
    setToneNote(null);
  }

  function ask() {
    resetResults();
    start(async () => {
      try {
        if (tool.kind === "tone") {
          const r = await enhanceTextTone({ mode: toneMode, text });
          if (r.ok) {
            setToneSuggs(r.suggestions);
            setToneJobId(r.jobId);
            setToneNote(r.fallback ? r.note ?? "AI belum aktif; menampilkan pemeriksaan dasar." : null);
          } else setError(r.error);
          return;
        }
        if (tool.kind === "outline") {
          const r = await generateOutlineText({ topic: text });
          if (r.ok) applyContent(r.content, r.jobId, r.aiUsed);
          else setError(r.error);
          return;
        }
        if (tool.kind === "abstract") {
          const r = await generateAbstractText({ input: text, ...(groundingDocId ? { moduleId: groundingDocId } : {}) });
          if (r.ok) applyContent(r.content, r.jobId, r.aiUsed, r.grounded ?? false);
          else setError(r.error);
          return;
        }
        if (tool.kind === "methodology") {
          const r = await generateMethodologyText({ topic: text });
          if (r.ok) applyContent(r.content, r.jobId, r.aiUsed);
          else setError(r.error);
          return;
        }
        const r = await runAiTool({ kind: tool.kind, input: text });
        if (r.ok && r.content) applyContent(r.content, r.jobId ?? null, false);
        else if (!r.ok) setError(r.error);
        else setError("Panduan belum tersusun. Coba lagi.");
      } catch {
        setError("Koneksi terputus. Saran belum tersusun, tulisanmu tetap aman. Coba lagi.");
      }
    });
  }

  // Siapkan naskah untuk grounding: index isi dokumen ke Vectorize. Pakai teks yang sedang di ruang
  // tulis sebagai isi (dev/lokal); di produksi job server membaca PDF/GCS via toMarkdown.
  function prepareGrounding() {
    if (!groundingDocId) return;
    setIngestMsg(null);
    setError(null);
    start(async () => {
      const r = await ingestDocumentForAI({ moduleId: groundingDocId, ...(text.trim() ? { text } : {}) });
      if (r.ok) setIngestMsg(r.message);
      else setError(r.error);
    });
  }

  function applyContent(content: string, jobId: number | null, usedAi: boolean, isGrounded = false) {
    setSuggestion(content);
    setSuggestedBy(tool);
    setContentJobId(jobId);
    setAiUsed(usedAi);
    setGrounded(isGrounded);
  }

  // Sisipkan blok saran di posisi kursor (tak menimpa isi).
  function insertSuggestion() {
    if (!suggestion) return;
    const el = editorRef.current;
    const block = `${text && !text.endsWith("\n") ? "\n\n" : ""}${suggestion}\n`;
    if (el && typeof el.selectionStart === "number") {
      const s = el.selectionStart;
      const eNd = el.selectionEnd;
      setText(text.slice(0, s) + block + text.slice(eNd));
      requestAnimationFrame(() => {
        el.focus();
        const pos = s + block.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      setText((t) => t + block);
    }
    setSuggestion(null);
  }

  // Tone Enhancer: terapkan satu sugesti -> ganti kutipan dengan saran di teks (klien tetap memutuskan).
  function applyTone(idx: number) {
    const s = toneSuggs?.[idx];
    if (!s) return;
    setText((t) => {
      if (s.kutipan && t.includes(s.kutipan)) return t.replace(s.kutipan, s.saran);
      return t + (t === "" || t.endsWith("\n") ? "" : "\n") + s.saran;
    });
    setToneSuggs((xs) => (xs ? xs.filter((_, i) => i !== idx) : xs));
  }
  function skipTone(idx: number) {
    setToneSuggs((xs) => (xs ? xs.filter((_, i) => i !== idx) : xs));
  }

  function rate(jobId: number | null, value: number, setter: (v: number) => void) {
    if (!jobId) return;
    setter(value);
    start(async () => {
      await rateAiOutput({ jobId, rating: value });
    });
  }

  return (
    <div className="space-y-5">
      <DisclaimerBanner>{AI_DISCLAIMER}</DisclaimerBanner>

      {/* Sumber naskah: tempel teks ATAU pilih dokumen tersimpan (pointer GCS). */}
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-semibold text-muted-foreground">Sumber naskah</span>
          <div className="flex rounded-full bg-muted p-0.5" role="radiogroup" aria-label="Sumber naskah">
            {(
              [
                ["paste", "Tempel teks"],
                ["doc", "Dari dokumen"],
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                role="radio"
                aria-checked={source === k}
                onClick={() => setSource(k)}
                className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                  source === k ? "bg-card text-brand-700 shadow-sm ring-1 ring-brand-200" : "text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <Link
            href="/dokumen"
            className="ml-auto inline-flex items-center gap-1.5 text-xs font-semibold text-brand-600 hover:text-brand-700"
          >
            <IconUpload className="h-3.5 w-3.5" /> Unggah baru
          </Link>
        </div>

        {source === "doc" ? (
          documents.length > 0 ? (
            <div className="mt-3 space-y-2">
              <label htmlFor="doc-select" className="sr-only">
                Pilih dokumen
              </label>
              <select
                id="doc-select"
                value={docId ?? ""}
                onChange={(e) => setDocId(e.target.value ? Number(e.target.value) : null)}
                className="w-full rounded-xl border border-border bg-card px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-400"
              >
                <option value="">Pilih dokumen tersimpan</option>
                {documents.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label} (v{d.version})
                  </option>
                ))}
              </select>
              {selectedDoc ? (
                <div className="space-y-2">
                  <p className="flex items-start gap-1.5 rounded-xl bg-brand-50/60 px-3 py-2 text-xs text-brand-700">
                    <IconDoc className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      Konteks: <strong>{selectedDoc.label}</strong>. Abstrak akan <strong>grounded</strong> ke isi
                      naskah yang sudah disiapkan. Siapkan sekali; PDF/DOCX diproses server di produksi, untuk sekarang
                      isi ruang tulis dipakai sebagai isinya.
                    </span>
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={prepareGrounding}
                      disabled={pending}
                      className="inline-flex items-center gap-1.5 rounded-full bg-card px-3.5 py-1.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 hover:bg-brand-50 disabled:opacity-50"
                    >
                      <IconSparkle className="h-3.5 w-3.5" /> Siapkan untuk AI (grounding)
                    </button>
                    {ingestMsg ? <span className="text-xs text-lime-700">{ingestMsg}</span> : null}
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-border px-3 py-3 text-xs text-muted-foreground">
              Belum ada dokumen tersimpan.{" "}
              <Link href="/dokumen" className="font-semibold text-brand-600 hover:text-brand-700">
                Unggah dokumen dulu
              </Link>{" "}
              untuk memakainya sebagai konteks.
            </p>
          )
        ) : null}
      </div>

      {/* Editor: ruang tulis */}
      <div className="rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
          <span className="text-xs font-medium text-muted-foreground">
            Ruang tulis{selectedDoc ? ` · ${selectedDoc.label}` : ""}
          </span>
          <span className="text-xs tabular-nums text-muted-foreground">{words} kata</span>
        </div>
        <label htmlFor="ai-editor" className="sr-only">
          Ruang tulis
        </label>
        <textarea
          id="ai-editor"
          ref={editorRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={10}
          placeholder={PLACEHOLDER}
          className="w-full resize-y bg-transparent px-4 py-4 text-sm leading-relaxed text-ink placeholder:text-muted-foreground focus:outline-none"
        />

        {/* Toolbar: dua grup alat + minta saran */}
        <div className="space-y-3 border-t border-border px-4 py-3">
          <ToolGroup title="Alat AI" hint="Mengolah teksmu" tools={AI_TOOLS} active={tool} onPick={setTool} accent />
          <ToolGroup title="Panduan" hint="Penjelasan, nol token" tools={GUIDE_TOOLS} active={tool} onPick={setTool} />

          {/* Mode khusus Tone Enhancer */}
          {tool.kind === "tone" ? (
            <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-muted/60 p-2">
              <span className="px-1 text-[11px] font-semibold text-muted-foreground">Mode:</span>
              {TONE_MODES.map((m) => (
                <button
                  key={m.k}
                  type="button"
                  onClick={() => setToneMode(m.k)}
                  aria-pressed={toneMode === m.k}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors ${
                    toneMode === m.k ? "bg-brand-600 text-white" : "bg-card text-muted-foreground ring-1 ring-border hover:bg-muted"
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          ) : null}

          <div className="flex items-center">
            <p className="text-xs text-muted-foreground">{tool.desc}</p>
            <button
              type="button"
              onClick={ask}
              disabled={pending || text.trim().length === 0}
              className="group ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
            >
              <IconSparkle className="h-4 w-4" />
              <span>{pending ? "Menyusun saran…" : "Minta saran AI"}</span>
              {!pending ? <IconArrow className="h-4 w-4 transition-transform group-hover:translate-x-0.5" /> : null}
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* Hasil Tone Enhancer: sugesti per-kalimat */}
      {toneSuggs ? (
        <section aria-label="Sugesti Tone Enhancer" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <IconSparkle className="h-3.5 w-3.5" /> Perkuat Kalimat · {TONE_MODES.find((m) => m.k === toneMode)?.label}
              {toneNote ? (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">panduan dasar</span>
              ) : (
                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">AI</span>
              )}
            </span>
            {toneJobId ? (
              <RateButtons rated={toneRated} onRate={(v) => rate(toneJobId, v, setToneRated)} />
            ) : null}
          </div>

          {toneNote ? <p className="rounded-xl bg-muted px-3 py-2 text-xs text-muted-foreground">{toneNote}</p> : null}

          {toneSuggs.length === 0 && !toneNote ? (
            <p className="rounded-2xl border border-brand-200 bg-brand-50/50 px-4 py-3 text-sm text-ink">
              Kalimat-kalimatmu sudah cukup baik untuk mode ini - tidak ada sugesti. Coba mode lain atau potongan teks yang berbeda.
            </p>
          ) : null}

          <ul className="space-y-2.5">
            {toneSuggs.map((s, idx) => (
              <li key={idx} className="overflow-hidden rounded-2xl border border-brand-200 bg-card">
                <div className="space-y-2 px-4 py-3">
                  {s.kutipan ? (
                    <p className="text-xs text-muted-foreground">
                      <span className="font-semibold">Asli:</span> <span className="line-through">{s.kutipan}</span>
                    </p>
                  ) : null}
                  <p className="text-sm text-ink">
                    <span className="font-semibold text-brand-700">Saran:</span> {s.saran}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">Kenapa:</span> {s.alasan}
                  </p>
                </div>
                <div className="flex items-center gap-2 border-t border-border px-4 py-2.5">
                  <button
                    type="button"
                    onClick={() => applyTone(idx)}
                    className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                  >
                    <IconCheck className="h-3.5 w-3.5" /> Terapkan
                  </button>
                  <button
                    type="button"
                    onClick={() => skipTone(idx)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-ink"
                  >
                    Lewati
                  </button>
                  <span className="ml-auto text-[11px] text-muted-foreground">Tulis ulang dengan kata-katamu.</span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* Hasil content (outline/abstrak/panduan): satu blok */}
      {suggestion ? (
        <section aria-label="Saran AI" className="overflow-hidden rounded-2xl border border-brand-200 bg-brand-50/50">
          <header className="flex items-center justify-between gap-2 border-b border-brand-200/70 px-4 py-2.5">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-700">
              <IconSparkle className="h-3.5 w-3.5" /> Saran · {suggestedBy?.label}
              {suggestedBy?.ai ? (
                aiUsed === true ? (
                  <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700" title="Dihasilkan Workers AI via AI Gateway.">
                    AI
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground" title="Workers AI belum dikonfigurasi; memakai panduan dasar deterministik.">
                    panduan dasar
                  </span>
                )
              ) : (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">panduan</span>
              )}
              {grounded ? (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200" title="Berlabuh ke isi naskahmu (Vectorize) - bukan mengarang.">
                  grounded
                </span>
              ) : null}
            </span>
            {contentJobId ? <RateButtons rated={contentRated} onRate={(v) => rate(contentJobId, v, setContentRated)} /> : null}
          </header>
          <div className="max-h-[24rem] overflow-y-auto px-4 py-4 text-sm leading-relaxed text-ink">
            <MarkdownLite text={suggestion} />
          </div>
          <footer className="flex flex-wrap items-center gap-2 border-t border-brand-200/70 px-4 py-3">
            <button
              type="button"
              onClick={insertSuggestion}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <IconPlus className="h-4 w-4" /> Sisipkan ke tulisan
            </button>
            <button
              type="button"
              onClick={() => setSuggestion(null)}
              className="inline-flex min-h-11 items-center rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <IconClose className="mr-1 h-4 w-4" /> Tutup
            </button>
            <span className="ml-auto text-xs text-muted-foreground">Tulis ulang dengan kata-katamu sendiri.</span>
          </footer>
        </section>
      ) : null}
    </div>
  );
}

function ToolGroup({
  title,
  hint,
  tools,
  active,
  onPick,
  accent,
}: {
  title: string;
  hint: string;
  tools: Tool[];
  active: Tool;
  onPick: (t: Tool) => void;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="inline-flex items-center gap-1.5">
        <span className={`text-[11px] font-bold uppercase tracking-wide ${accent ? "text-brand-700" : "text-muted-foreground"}`}>
          {title}
        </span>
        <span className="text-[11px] text-muted-foreground">· {hint}</span>
      </span>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={title}>
        {tools.map((t) => {
          const on = t.kind === active.kind;
          return (
            <button
              key={t.kind}
              type="button"
              role="radio"
              aria-checked={on}
              title={t.desc}
              onClick={() => onPick(t)}
              className={`min-h-9 rounded-full px-3 py-1.5 text-xs font-medium ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                on
                  ? accent
                    ? "bg-brand-600 text-white ring-brand-600"
                    : "bg-brand-50 text-brand-700 ring-brand-400"
                  : "bg-transparent text-muted-foreground ring-border hover:bg-muted"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function RateButtons({ rated, onRate }: { rated: number | null; onRate: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground">Bermanfaat?</span>
      <button
        type="button"
        onClick={() => onRate(1)}
        aria-label="Tandai bermanfaat"
        aria-pressed={rated === 1}
        className={`flex size-8 items-center justify-center rounded-full ring-1 transition-colors ${
          rated === 1 ? "bg-brand-100 text-brand-700 ring-brand-400" : "bg-card text-muted-foreground ring-border hover:text-brand-600"
        }`}
      >
        <IconCheck className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onRate(-1)}
        aria-label="Tandai kurang membantu"
        aria-pressed={rated === -1}
        className={`flex size-8 items-center justify-center rounded-full ring-1 transition-colors ${
          rated === -1 ? "bg-destructive/10 text-destructive ring-destructive/40" : "bg-card text-muted-foreground ring-border hover:text-ink"
        }`}
      >
        <IconClose className="h-4 w-4" />
      </button>
    </div>
  );
}
