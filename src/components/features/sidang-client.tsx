"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { generateDefenseQuestions, saveDefenseAnswer } from "@/lib/actions";
import { DisclaimerBanner } from "@/components/states";
import { Badge, ProgressRing } from "@/components/kit";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  HelpCircle,
  Check,
  Shuffle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  GraduationCap,
  Trophy,
} from "lucide-react";

export type Question = {
  id: number;
  question: string;
  category: string;
  difficulty: string;
  suggestedAnswer: string | null;
};

const CAT_LABEL: Record<string, string> = {
  metodologi: "Metodologi", teori: "Teori", hasil: "Hasil", kontribusi: "Kontribusi", teknis: "Teknis", umum: "Umum",
};
const DIFF_TONE: Record<string, string> = { mudah: "done", sedang: "in_progress", sulit: "blocked" };
const DIFF_DOT: Record<string, string> = { mudah: "bg-emerald-500", sedang: "bg-primary", sulit: "bg-rose-500" };

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function SidangClient({ questions: initial }: { questions: Question[] }) {
  const [questions, setQuestions] = useState(initial);
  const [mode, setMode] = useState<"bank" | "latihan">("bank");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function generate() {
    setError(null);
    start(async () => {
      const res = await generateDefenseQuestions({});
      if (res.ok) {
        toast.success(res.message ?? "Pertanyaan ditambahkan.");
        window.location.reload();
      } else setError(res.error);
    });
  }

  if (questions.length === 0) {
    return (
      <div className="space-y-5">
        <DisclaimerBanner>Latih pemahaman, jangan menghafal. Pertanyaan dibuat dari topik skripsimu untuk membantumu siap, percaya diri, dan berbasis data.</DisclaimerBanner>
        <div className="flex flex-col items-center rounded-2xl border border-dashed border-border bg-muted/30 py-14 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <HelpCircle className="size-6" />
          </span>
          <p className="mt-3 text-sm font-semibold text-foreground">Belum ada bank pertanyaan</p>
          <p className="mt-1 max-w-sm text-xs text-muted-foreground">Buat set pertanyaan penguji dari judul skripsimu, lalu latih dengan kartu interaktif.</p>
          <Button onClick={generate} disabled={pending} className="mt-5 rounded-full">
            <Sparkles /> {pending ? "Menyusun" : "Buat pertanyaan"}
          </Button>
          {error ? <p role="alert" className="mt-3 text-xs text-destructive">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div role="tablist" aria-label="Mode simulasi" className="flex rounded-full bg-muted p-0.5">
          {(["bank", "latihan"] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={cn(
                "rounded-full px-4 py-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                mode === m ? "bg-card text-primary shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "bank" ? "Bank soal" : "Mode latihan"}
            </button>
          ))}
        </div>
        <Button onClick={generate} disabled={pending} variant="outline" size="sm" className="rounded-full">
          <Sparkles /> Tambah pertanyaan
        </Button>
      </div>
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}

      {mode === "bank" ? (
        <div className="space-y-3">
          <DisclaimerBanner>Latih pemahaman, jangan menghafal. Jawab singkat, percaya diri, berbasis data & teori.</DisclaimerBanner>
          <ul className="space-y-3">
            {questions.map((q) => (
              <QuestionCard key={q.id} q={q} onSaved={(ans) => setQuestions((xs) => xs.map((x) => (x.id === q.id ? { ...x, suggestedAnswer: ans } : x)))} />
            ))}
          </ul>
        </div>
      ) : (
        <PracticeDeck questions={questions} />
      )}
    </div>
  );
}

// ── Mode Latihan: flashcard interaktif + skor kesiapan (gamified) ──
function PracticeDeck({ questions }: { questions: Question[] }) {
  const [order, setOrder] = useState(() => questions);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mastered, setMastered] = useState<Set<number>>(new Set());

  const total = order.length;
  const current = order[idx];
  const pct = total ? Math.round((mastered.size / total) * 100) : 0;
  const done = mastered.size >= total && total > 0;

  function go(next: number) {
    setFlipped(false);
    setIdx((next + total) % total);
  }
  function rate(paham: boolean) {
    setMastered((s) => {
      const n = new Set(s);
      if (paham) n.add(current.id);
      else n.delete(current.id);
      return n;
    });
    setTimeout(() => go(idx + 1), 120);
  }
  function reshuffle() {
    setOrder(shuffle(questions));
    setIdx(0);
    setFlipped(false);
    setMastered(new Set());
  }

  return (
    <div className="space-y-5">
      {/* Header skor + progress */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 ring-1 ring-primary/10">
        <div className="flex items-center gap-4">
          <ProgressRing value={pct} size={64} stroke={7}>
            <span className="text-sm font-bold text-primary">{pct}%</span>
          </ProgressRing>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Kesiapan sidang</p>
            <p className="font-heading text-lg font-bold tracking-tight text-foreground">
              {mastered.size} dari {total} dikuasai
            </p>
            <p className="text-xs text-muted-foreground">Kartu {idx + 1} / {total}</p>
          </div>
        </div>
        <Button onClick={reshuffle} variant="outline" size="sm" className="rounded-full">
          <Shuffle /> Acak ulang
        </Button>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${((idx + 1) / total) * 100}%` }} />
      </div>

      {done ? (
        <div className="flex flex-col items-center rounded-2xl border border-emerald-200 bg-emerald-50 px-6 py-8 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Trophy className="size-7" />
          </span>
          <p className="mt-3 font-heading text-xl font-bold tracking-tight text-emerald-900">Kesiapan {pct}%! 🎓</p>
          <p className="mt-1 max-w-sm text-sm text-emerald-800">Kamu sudah menguasai semua pertanyaan. Acak ulang untuk mengetes lagi, atau lengkapi draf jawaban di Bank soal.</p>
          <Button onClick={reshuffle} className="mt-4 rounded-full">
            <RotateCcw /> Ulangi latihan
          </Button>
        </div>
      ) : (
        <>
          {/* Flashcard */}
          <div className={cn("flashcard", flipped && "is-flipped")}>
            <div
              role="button"
              tabIndex={0}
              aria-pressed={flipped}
              aria-label={flipped ? "Kartu jawaban, ketuk untuk kembali ke pertanyaan" : "Kartu pertanyaan, ketuk untuk lihat draf jawaban"}
              onClick={() => setFlipped((f) => !f)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setFlipped((f) => !f); }
              }}
              className="flashcard-inner min-h-[19rem] cursor-pointer rounded-3xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:min-h-[17rem]"
            >
              {/* Front: pertanyaan */}
              <div className="flashcard-face flashcard-front flex min-h-[19rem] flex-col rounded-3xl bg-card p-6 shadow-md ring-1 ring-foreground/10 sm:min-h-[17rem]">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary">
                    <span className={cn("size-1.5 rounded-full", DIFF_DOT[current.difficulty] ?? "bg-primary")} />
                    {CAT_LABEL[current.category] ?? current.category}
                  </span>
                  <Badge value={DIFF_TONE[current.difficulty] ?? "pending"} label={current.difficulty} />
                </div>
                <div className="flex flex-1 items-center justify-center py-6">
                  <p className="text-center font-heading text-xl font-bold leading-snug tracking-tight text-foreground sm:text-2xl">
                    {current.question}
                  </p>
                </div>
                <p className="text-center text-xs text-muted-foreground">Ketuk kartu untuk lihat draf jawaban</p>
              </div>

              {/* Back: draf jawaban */}
              <div className="flashcard-face flashcard-back flex min-h-[19rem] flex-col rounded-3xl bg-gradient-to-br from-primary to-brand-700 p-6 text-white shadow-md sm:min-h-[17rem]">
                <p className="text-xs font-semibold uppercase tracking-wide text-white/70">Draf jawabanmu</p>
                <div className="flex flex-1 items-center py-4">
                  {current.suggestedAnswer ? (
                    <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-relaxed text-white/95">{current.suggestedAnswer}</p>
                  ) : (
                    <p className="text-sm text-white/80">Belum ada draf jawaban. Tulis di tab <span className="font-semibold">Bank soal</span> agar bisa kamu latih di sini.</p>
                  )}
                </div>
                <p className="text-center text-xs text-white/60">Ketuk kartu untuk kembali</p>
              </div>
            </div>
          </div>

          {/* Kontrol: prev/next + rating mastery */}
          <div className="flex items-center justify-between gap-3">
            <Button onClick={() => go(idx - 1)} variant="outline" size="icon" aria-label="Kartu sebelumnya" className="rounded-full">
              <ChevronLeft />
            </Button>
            <div className="flex flex-1 items-center justify-center gap-2">
              <Button onClick={() => rate(false)} variant="outline" className="rounded-full">
                Belum paham
              </Button>
              <Button onClick={() => rate(true)} className="rounded-full bg-emerald-600 hover:bg-emerald-700">
                <Check /> Sudah paham
              </Button>
            </div>
            <Button onClick={() => go(idx + 1)} variant="outline" size="icon" aria-label="Kartu berikutnya" className="rounded-full">
              <ChevronRight />
            </Button>
          </div>
          <p className="flex items-center justify-center gap-1.5 text-center text-xs text-muted-foreground">
            <GraduationCap className="size-3.5" /> Tandai pemahamanmu untuk menaikkan skor kesiapan sidang.
          </p>
        </>
      )}
    </div>
  );
}

function QuestionCard({ q, onSaved }: { q: Question; onSaved: (ans: string) => void }) {
  const [answer, setAnswer] = useState(q.suggestedAnswer ?? "");
  const [editing, setEditing] = useState(false);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);

  function save() {
    start(async () => {
      const res = await saveDefenseAnswer({ id: q.id, answer });
      if (res.ok) {
        toast.success("Draf jawaban disimpan.");
        onSaved(answer);
        setEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 1500);
      }
    });
  }

  return (
    <li className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-foreground/10">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-foreground">{q.question}</p>
        <Badge value={DIFF_TONE[q.difficulty] ?? "pending"} label={q.difficulty} />
      </div>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{CAT_LABEL[q.category] ?? q.category}</p>

      {editing ? (
        <div className="mt-3 space-y-2">
          <Textarea value={answer} onChange={(e) => setAnswer(e.target.value)} rows={4} placeholder="Tulis draf jawabanmu…" autoFocus />
          <div className="flex gap-2">
            <Button onClick={save} disabled={pending} size="sm" className="rounded-full">Simpan</Button>
            <Button onClick={() => setEditing(false)} variant="ghost" size="sm" className="rounded-full">Batal</Button>
          </div>
        </div>
      ) : q.suggestedAnswer ? (
        <div className="mt-3 rounded-xl bg-muted/60 p-3 text-sm text-ink-soft">
          <p className="whitespace-pre-wrap">{q.suggestedAnswer}</p>
          <button type="button" onClick={() => setEditing(true)} className="mt-2 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Ubah jawaban</button>
        </div>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="mt-3 inline-flex items-center gap-1.5 rounded text-xs font-semibold text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {saved ? <><Check className="size-3.5 text-emerald-600" /> Tersimpan</> : "+ Tulis draf jawaban"}
        </button>
      )}
    </li>
  );
}
