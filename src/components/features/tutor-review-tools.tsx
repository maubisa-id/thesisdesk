"use client";

import { useLayoutEffect, useRef, useState, useTransition, type RefObject } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { MessageSquarePlus, Plus, X, Loader2, Trash2 } from "lucide-react";
import {
  createFeedbackTemplate,
  deleteFeedbackTemplate,
  bumpFeedbackTemplate,
  type FeedbackTemplateItem,
} from "@/lib/actions";

const CATS = ["metodologi", "sitasi", "struktur", "bahasa", "data", "umum"] as const;
type Cat = (typeof CATS)[number];

const CAT_LABEL: Record<string, string> = {
  metodologi: "Metodologi",
  sitasi: "Sitasi",
  struktur: "Struktur",
  bahasa: "Bahasa",
  data: "Data",
  umum: "Umum",
};

// Panel popover ber-portal ke <body> + posisi fixed: lolos dari overflow-hidden kartu komentar.
// Reposisi saat scroll (capture, agar ikut scroll ancestor) & resize; flip ke bawah + clamp tinggi
// bila ruang di atas trigger tak cukup (anti kepotong di viewport pendek).
function PopoverPanel({
  anchorRef,
  open,
  onClose,
  width = 320,
  children,
}: {
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
}) {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const compute = () => {
      const el = anchorRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const margin = 8;
      const left = Math.max(margin, Math.min(r.left, window.innerWidth - width - margin));
      const spaceAbove = r.top - margin;
      const spaceBelow = window.innerHeight - r.bottom - margin;
      if (spaceAbove >= spaceBelow) {
        setPos({ left, bottom: window.innerHeight - r.top + margin, maxH: Math.max(120, spaceAbove) });
      } else {
        setPos({ left, top: r.bottom + margin, maxH: Math.max(120, spaceBelow) });
      }
    };
    compute();
    window.addEventListener("scroll", compute, true);
    window.addEventListener("resize", compute);
    return () => {
      window.removeEventListener("scroll", compute, true);
      window.removeEventListener("resize", compute);
    };
  }, [open, anchorRef, width]);

  if (!open || !pos || typeof document === "undefined") return null;
  return createPortal(
    <>
      <button type="button" aria-hidden tabIndex={-1} className="fixed inset-0 z-40 cursor-default" onClick={onClose} />
      <div
        style={{ position: "fixed", left: pos.left, top: pos.top, bottom: pos.bottom, width, maxHeight: pos.maxH }}
        className="z-50 overflow-y-auto rounded-2xl border border-border bg-popover p-3 shadow-lg"
      >
        {children}
      </div>
    </>,
    document.body,
  );
}

// Penunjang tutor: sisip template feedback ke komposer anotasi.
export function TutorReviewToolbar({
  templates,
  onInsert,
}: {
  templates: FeedbackTemplateItem[];
  onInsert: (text: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <TemplateMenu templates={templates} onInsert={onInsert} />
    </div>
  );
}

function chipCls(active = false) {
  return `inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
    active ? "bg-brand-50 text-brand-700 ring-brand-200" : "bg-card text-muted-foreground ring-border hover:bg-accent hover:text-foreground"
  }`;
}

function TemplateMenu({
  templates,
  onInsert,
}: {
  templates: FeedbackTemplateItem[];
  onInsert: (text: string) => void;
}) {
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState(templates);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<Cat>("umum");
  const [pending, start] = useTransition();

  function insert(t: FeedbackTemplateItem) {
    onInsert(t.body);
    setOpen(false);
    start(async () => {
      await bumpFeedbackTemplate({ id: t.id });
    });
  }

  function create(e: React.FormEvent) {
    e.preventDefault();
    start(async () => {
      const res = await createFeedbackTemplate({ title, body, category });
      if (res.ok) {
        toast.success("Template disimpan.");
        setItems((xs) => [{ id: Date.now(), title, body, category, scope: "private", mine: true }, ...xs]);
        setTitle("");
        setBody("");
        setCategory("umum");
        setCreating(false);
      } else {
        toast.error(res.error);
      }
    });
  }

  function remove(id: number) {
    setItems((xs) => xs.filter((x) => x.id !== id));
    start(async () => {
      const res = await deleteFeedbackTemplate({ id });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={() => setOpen((o) => !o)} className={chipCls(open)} aria-haspopup="menu" aria-expanded={open}>
        <MessageSquarePlus className="size-3.5" /> Template
      </button>
      <PopoverPanel anchorRef={btnRef} open={open} onClose={() => setOpen(false)}>
        <div className="flex items-center justify-between px-1 pb-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Template feedback</p>
          <button type="button" onClick={() => setCreating((c) => !c)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50">
            {creating ? <X className="size-3.5" /> : <Plus className="size-3.5" />} {creating ? "Tutup" : "Baru"}
          </button>
        </div>

        {creating ? (
          <form onSubmit={create} className="mb-2 space-y-2 rounded-xl bg-muted/50 p-2">
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Judul (mis. Perkuat sitasi)" className="w-full rounded-lg bg-card px-2.5 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={2} placeholder="Isi snippet. Boleh pakai {{placeholder}}." className="w-full resize-none rounded-lg bg-card px-2.5 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <div className="flex flex-wrap gap-1">
              {CATS.map((c) => (
                <button key={c} type="button" onClick={() => setCategory(c)} className={chipCls(category === c)}>
                  {CAT_LABEL[c]}
                </button>
              ))}
            </div>
            <button type="submit" disabled={pending || title.trim().length < 2 || body.trim().length < 3} className="inline-flex items-center gap-1.5 rounded-full bg-brand-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-600 disabled:opacity-50">
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Plus className="size-3.5" />} Simpan template
            </button>
          </form>
        ) : null}

        <ul className="space-y-0.5">
          {items.length === 0 ? (
            <li className="px-2 py-3 text-center text-xs text-muted-foreground">Belum ada template. Buat yang pertama.</li>
          ) : (
            items.map((t) => (
              <li key={t.id} className="group/tpl flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-accent">
                <button type="button" onClick={() => insert(t)} className="min-w-0 flex-1 text-left" role="menuitem">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium text-foreground">{t.title}</span>
                    <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground">{CAT_LABEL[t.category] ?? t.category}</span>
                    {!t.mine ? <span className="shrink-0 text-[11px] text-muted-foreground">bersama</span> : null}
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{t.body}</span>
                </button>
                {t.mine ? (
                  <button type="button" onClick={() => remove(t.id)} aria-label={`Hapus template ${t.title}`} className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus-visible:opacity-100 group-hover/tpl:opacity-100">
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </PopoverPanel>
    </>
  );
}

