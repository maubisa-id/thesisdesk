"use client";

import { useState, useTransition } from "react";
import { Trash2, Sparkles } from "lucide-react";
import { setMilestoneStatus, createMilestone, deleteMilestone, generateChapterMilestones } from "@/lib/actions";
import { Badge } from "@/components/kit";
import { IconPlus, IconClock } from "@/components/icons";
import { CHAPTER_SHORT, MILESTONE_STATUS_LABEL, tanggal, persen } from "@/lib/format";

export type MilestoneItem = {
  id: number;
  chapter: string;
  title: string;
  status: string;
  dueDate: string | null;
};

const COLUMNS: { key: string; label: string; accent: string }[] = [
  { key: "todo", label: "Belum mulai", accent: "bg-muted-foreground/50" },
  { key: "in_progress", label: "Dikerjakan", accent: "bg-brand-500" },
  { key: "review", label: "Direview", accent: "bg-violet-500" },
  { key: "done", label: "Selesai", accent: "bg-emerald-500" },
  { key: "blocked", label: "Terhambat", accent: "bg-rose-500" },
];

const CHAPTERS = ["proposal", "bab1", "bab2", "bab3", "bab4", "bab5", "revisi", "sidang", "other"];

export function ProgresBoard({
  bimbinganId,
  milestones,
  canEdit,
  thesisTitle,
}: {
  bimbinganId: number;
  milestones: MilestoneItem[];
  canEdit: boolean;
  thesisTitle?: string | null;
}) {
  const [items, setItems] = useState(milestones);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newChapter, setNewChapter] = useState("bab1");
  const [dragId, setDragId] = useState<number | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<number | null>(null);

  const done = items.filter((m) => m.status === "done").length;
  const total = items.length;
  const pct = total ? (done / total) * 100 : 0;

  function generate() {
    setError(null);
    startTransition(async () => {
      const res = await generateChapterMilestones({ bimbinganId });
      if (res.ok) {
        window.location.reload();
      } else {
        setError(res.error);
      }
    });
  }

  // Papan benar-benar kosong: tawarkan template BAB I-V (empty state yang mengajari).
  if (total === 0 && canEdit) {
    return (
      <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
          <Sparkles className="size-7" />
        </span>
        <p className="mt-4 text-base font-bold text-foreground">Mulai papan progres skripsimu</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          Buat kerangka milestone BAB I-V sekali klik, lalu seret tiap kartu sesuai perkembanganmu. Kamu tetap bisa menambah atau menghapus milestone kapan saja.
        </p>
        {error ? <p role="alert" className="mt-3 text-sm text-destructive">{error}</p> : null}
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-60"
        >
          <Sparkles className="size-4" /> {pending ? "Menyiapkan…" : "Buat template BAB I-V"}
        </button>
      </div>
    );
  }

  function move(id: number, status: string) {
    setError(null);
    const target = items.find((m) => m.id === id);
    if (!target || target.status === status) return;
    const prev = items;
    setItems((xs) => xs.map((m) => (m.id === id ? { ...m, status } : m)));
    startTransition(async () => {
      const res = await setMilestoneStatus({ id, status });
      if (!res.ok) {
        setItems(prev);
        setError(res.error);
      }
    });
  }

  function remove(id: number) {
    setError(null);
    const prev = items;
    setItems((xs) => xs.filter((m) => m.id !== id));
    setConfirmId(null);
    startTransition(async () => {
      const res = await deleteMilestone({ id });
      if (!res.ok) {
        setItems(prev);
        setError(res.error);
      }
    });
  }

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (newTitle.trim().length < 3) {
      setError("Judul milestone minimal 3 karakter.");
      return;
    }
    startTransition(async () => {
      const res = await createMilestone({ bimbinganId, chapter: newChapter, title: newTitle.trim() });
      if (res.ok) {
        setAdding(false);
        setNewTitle("");
        setItems((xs) => [
          ...xs,
          { id: Date.now(), chapter: newChapter, title: newTitle.trim(), status: "todo", dueDate: null },
        ]);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Header ringkas: progres + tambah milestone */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-foreground">{done} dari {total} milestone selesai</span>
            <span className="text-xs font-semibold text-primary">{persen(pct)}</span>
          </div>
          <div className="mt-2 h-1.5 max-w-md overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-[width] duration-700 ease-out" style={{ width: `${pct}%` }} />
          </div>
          {thesisTitle ? <p className="mt-1.5 truncate text-xs text-muted-foreground">{thesisTitle}</p> : null}
        </div>
        {canEdit && !adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex min-h-10 items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-primary transition-colors hover:bg-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <IconPlus className="size-4" /> Tambah milestone
          </button>
        ) : null}
      </div>

      {canEdit && adding ? (
        <form onSubmit={add} className="flex flex-wrap items-center gap-2 rounded-2xl border border-border bg-card p-3">
          <select
            value={newChapter}
            onChange={(e) => setNewChapter(e.target.value)}
            aria-label="BAB"
            className="min-h-10 rounded-lg bg-muted px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400"
          >
            {CHAPTERS.map((c) => (
              <option key={c} value={c}>{CHAPTER_SHORT[c]}</option>
            ))}
          </select>
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Judul milestone (mis. Revisi metodologi)"
            className="min-h-10 min-w-0 flex-1 rounded-lg bg-muted px-3 py-2 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
          />
          <button type="submit" disabled={pending} className="min-h-10 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
            Tambah
          </button>
          <button type="button" onClick={() => setAdding(false)} className="min-h-10 rounded-full px-3 py-2 text-sm font-medium text-muted-foreground hover:text-foreground">
            Batal
          </button>
        </form>
      ) : null}

      {error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-4 py-2.5 text-sm text-destructive ring-1 ring-destructive/15">{error}</p>
      ) : null}

      <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-5">
        {COLUMNS.map((col) => {
          const cards = items.filter((m) => m.status === col.key);
          const isOver = overCol === col.key && dragId != null;
          return (
            <div
              key={col.key}
              onDragOver={(e) => {
                if (dragId == null) return;
                e.preventDefault();
                setOverCol(col.key);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setOverCol((c) => (c === col.key ? null : c));
              }}
              onDrop={(e) => {
                e.preventDefault();
                if (dragId != null) move(dragId, col.key);
                setOverCol(null);
                setDragId(null);
              }}
              className={`flex min-h-[19rem] flex-col rounded-2xl border p-2.5 transition-colors duration-200 ${
                isOver ? "border-brand-400 bg-brand-50/60 ring-2 ring-brand-400/40" : "border-border bg-muted/30"
              }`}
            >
              <div className="flex items-center justify-between px-1.5 pb-2.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  <span className={`size-2 rounded-full ${col.accent}`} /> {col.label}
                </span>
                <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-semibold text-muted-foreground ring-1 ring-border">{cards.length}</span>
              </div>
              <div className="flex flex-1 flex-col gap-2">
                {cards.length === 0 ? (
                  <div className={`flex flex-1 items-center justify-center rounded-xl border border-dashed px-3 text-center text-xs transition-colors ${isOver ? "border-brand-400 bg-brand-50/40 text-brand-600" : "border-border/70 text-muted-foreground/50"}`}>
                    {isOver ? "Lepas kartu di sini" : "Belum ada"}
                  </div>
                ) : (
                  cards.map((m) => (
                    <div
                      key={m.id}
                      draggable={canEdit && confirmId !== m.id}
                      onDragStart={(e) => {
                        setDragId(m.id);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverCol(null);
                      }}
                      className={`group relative rounded-xl border border-border bg-card p-3 transition-[transform,box-shadow,opacity] duration-200 ease-out ${
                        canEdit ? "cursor-grab active:cursor-grabbing hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md" : ""
                      } ${dragId === m.id ? "scale-[0.98] opacity-40" : "opacity-100"}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-primary">{CHAPTER_SHORT[m.chapter]}</p>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setConfirmId(m.id)}
                            aria-label={`Hapus milestone ${m.title}`}
                            className="-mr-1 -mt-1 flex size-7 items-center justify-center rounded-lg text-muted-foreground/50 opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        ) : null}
                      </div>
                      <p className="mt-0.5 text-sm font-semibold leading-snug text-foreground">{m.title}</p>
                      {m.dueDate ? (
                        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <IconClock className="size-3" /> {tanggal(m.dueDate)}
                        </p>
                      ) : null}
                      {canEdit ? (
                        <select
                          value={m.status}
                          onChange={(e) => move(m.id, e.target.value)}
                          disabled={pending}
                          aria-label={`Ubah status ${m.title}`}
                          className="mt-2.5 min-h-9 w-full rounded-lg bg-muted px-2.5 py-1.5 text-xs font-medium text-foreground ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400"
                        >
                          {COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>{MILESTONE_STATUS_LABEL[c.key]}</option>
                          ))}
                        </select>
                      ) : (
                        <div className="mt-2.5"><Badge value={m.status} label={MILESTONE_STATUS_LABEL[m.status]} /></div>
                      )}

                      {/* Konfirmasi hapus inline (di dalam kartu, tanpa popover mengambang) */}
                      {confirmId === m.id ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-xl bg-card/95 p-3 text-center backdrop-blur-sm">
                          <p className="text-xs font-semibold text-foreground">Hapus milestone ini?</p>
                          <div className="flex gap-2">
                            <button type="button" onClick={() => remove(m.id)} disabled={pending} className="min-h-8 rounded-full bg-destructive px-3 py-1 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-60">
                              Hapus
                            </button>
                            <button type="button" onClick={() => setConfirmId(null)} className="min-h-8 rounded-full border border-border px-3 py-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                              Batal
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Seret kartu antar kolom untuk mengubah status, atau pakai menu di tiap kartu (bisa penuh keyboard, aksesibel). Arahkan kursor ke kartu untuk menghapus. Perubahan tersimpan otomatis.
      </p>
    </div>
  );
}
