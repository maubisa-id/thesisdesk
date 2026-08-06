"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, UploadCloud, FileText, X, Info } from "lucide-react";
import { uploadDocument, setReviewStatus, addAnnotation, resolveAnnotation, type FeedbackTemplateItem } from "@/lib/actions";
import { TutorReviewToolbar } from "./tutor-review-tools";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconUpload, IconCheck, IconPlus } from "@/components/icons";
import { bytesHuman } from "@/lib/format";

const ACCEPT = ".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const ALLOWED_EXT = ["pdf", "doc", "docx"];
const MAX_MB = 10;

// Unggah revisi = input butuh keputusan → Modal berscrim (Cognitive Interruption): klien fokus
// menamai draft & menulis catatan tanpa gangguan konten di belakang.
// Auto-title (TUGAS 2): saat dibuka, judul otomatis terisi "Revisi - [Nama] - [DD/MM/YYYY]"
// (pola dari data live) supaya penamaan konsisten & tak berantakan; tetap bisa diedit.
export function UploadDocForm({ clientName }: { clientName?: string }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function autoTitle() {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, "0");
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const nama = clientName?.trim() || "Draft";
    return `Revisi - ${nama} - ${dd}/${mm}/${d.getFullYear()}`;
  }

  function reset() {
    setTitle("");
    setNote("");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onOpenChange(o: boolean) {
    if (pending) return;
    if (o && !title) setTitle(autoTitle());
    setOpen(o);
    if (!o) setError(null);
  }

  function acceptFile(f: File | null | undefined) {
    if (!f) return;
    const ext = (f.name.split(".").pop() ?? "").toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      setError("Tipe berkas tidak didukung. Gunakan PDF, DOC, atau DOCX.");
      return;
    }
    if (f.size > MAX_MB * 1024 * 1024) {
      setError(`Ukuran berkas maksimal ${MAX_MB} MB.`);
      return;
    }
    setError(null);
    setFile(f);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!file) {
      setError("Pilih atau seret berkas dulu (PDF/DOC/DOCX, maks 10 MB).");
      return;
    }
    const fd = new FormData();
    fd.set("title", title);
    fd.set("note", note);
    fd.set("file", file);
    start(async () => {
      try {
        const res = await uploadDocument(fd);
        if (res.ok) {
          toast.success(res.message ?? "Dokumen terkirim ke tutor.");
          reset();
          setOpen(false);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Koneksi terputus. Dokumen belum terkirim. Periksa internet lalu coba lagi.");
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        render={
          <Button className="rounded-full">
            <IconUpload /> Unggah dokumen
          </Button>
        }
      />
      <DialogContent showCloseButton={!pending} className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <UploadCloud className="size-5" />
          </div>
          <DialogTitle>Unggah dokumen</DialogTitle>
          <DialogDescription>Kirim draft ke tutor untuk direview. Revisi tutor muncul sebagai komentar di dokumen.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          {/* Dropzone / file chip */}
          <div className="space-y-2">
            <Label htmlFor="docfile">Berkas</Label>
            <input
              ref={fileRef}
              id="docfile"
              type="file"
              accept={ACCEPT}
              onChange={(e) => acceptFile(e.target.files?.[0])}
              className="sr-only"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "upload-error" : undefined}
            />
            {/* Tinggi area dijaga tetap (min-h) supaya modal TIDAK resize/geser saat berkas dipilih/dihapus. */}
            <div className="flex min-h-[104px] flex-col justify-center">
            {file ? (
              <div className="flex items-center gap-3 rounded-xl border border-border bg-muted/40 p-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <FileText className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{bytesHuman(file.size)} · siap dikirim</p>
                </div>
                <button
                  type="button"
                  onClick={() => { setFile(null); if (fileRef.current) fileRef.current.value = ""; }}
                  aria-label="Hapus berkas"
                  className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); acceptFile(e.dataTransfer.files?.[0]); }}
                className={`flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 ${
                  dragOver ? "border-brand-400 bg-brand-50" : "border-border bg-muted/30 hover:border-brand-300 hover:bg-accent/40"
                }`}
              >
                <span className="flex size-11 items-center justify-center rounded-full bg-card text-brand-600 ring-1 ring-border">
                  <UploadCloud className="size-5" />
                </span>
                <span className="text-sm font-semibold text-foreground">Seret berkas ke sini, atau klik untuk pilih</span>
                <span className="text-xs text-muted-foreground">PDF, DOC, atau DOCX · maksimal {MAX_MB} MB</span>
              </button>
            )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="doctitle">Judul dokumen</Label>
            <Input id="doctitle" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="mis. Draft BAB IV v2" className="h-11" />
            <p className="text-xs text-muted-foreground">Terisi otomatis biar rapi. Ubah bila perlu.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="docnote">Catatan untuk tutor (opsional)</Label>
            <Textarea id="docnote" value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Bagian mana yang ingin difokuskan?" />
          </div>

          {error ? (
            <p id="upload-error" role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Info className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <IconUpload />}
              {pending ? "Mengunggah" : "Kirim ke tutor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
export function ReviewControls({ id, status }: { id: number; status: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (status === "reviewed") return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        type="button"
        size="sm"
        className="rounded-full"
        disabled={pending}
        onClick={() => start(async () => { const r = await setReviewStatus({ id, status: "reviewed" }); if (r.ok) { toast.success("Dokumen ditandai selesai direview."); } else { setError(r.error); toast.error(r.error); } })}
      >
        {pending ? <Loader2 className="animate-spin" /> : <IconCheck />} Tandai selesai direview
      </Button>
      {error ? <span className="text-xs text-destructive">{error}</span> : null}
    </div>
  );
}

type Annotation = {
  id: number;
  body: string;
  resolved: boolean;
  authorName: string;
  page: number | null;
  quote: string | null;
  createdAt: string;
};

export function AnnotationPanel({
  moduleId,
  annotations,
  canAnnotate,
  canReview = false,
  templates = [],
}: {
  moduleId: number;
  annotations: Annotation[];
  canAnnotate: boolean;
  canReview?: boolean;
  templates?: FeedbackTemplateItem[];
}) {
  const [items, setItems] = useState(annotations);
  const [body, setBody] = useState("");
  const [page, setPage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [items.length]);

  function add(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const res = await addAnnotation({ moduleId, body, page: page || undefined });
      if (res.ok) {
        setBody("");
        setPage("");
        setItems((xs) => [
          ...xs,
          { id: Date.now(), body, resolved: false, authorName: "Kamu", page: page ? Number(page) : null, quote: null, createdAt: new Date().toISOString() },
        ]);
      } else setError(res.error);
    });
  }

  function toggle(id: number) {
    setItems((xs) => xs.map((a) => (a.id === id ? { ...a, resolved: !a.resolved } : a)));
    start(async () => { await resolveAnnotation({ id }); });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div ref={listRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {items.length === 0 ? (
          <div className="flex min-h-[14rem] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-4 py-10 text-center">
            <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <IconPlus className="size-5" />
            </span>
            <p className="mt-3 text-sm font-semibold text-foreground">Belum ada komentar revisi</p>
            <p className="mt-1 max-w-[15rem] text-xs text-muted-foreground">
              {canAnnotate ? "Tambahkan komentar di kotak bawah - sebutkan nomor halaman agar mudah ditemukan." : "Komentar revisi dari tutor akan muncul di sini."}
            </p>
          </div>
        ) : (
          <ul className="space-y-3">
            {items.map((a) => (
              <li key={a.id} className={`rounded-2xl p-4 ring-1 ${a.resolved ? "bg-lime-50 ring-lime-600/15" : "bg-card ring-border"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {a.page ? <p className="text-[11px] font-semibold uppercase tracking-wide text-brand-600">Hal. {a.page}{a.quote ? ` · "${a.quote}"` : ""}</p> : null}
                    <p className="mt-1 text-sm text-ink">{a.body}</p>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">{a.authorName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggle(a.id)}
                    className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold ring-1 ${a.resolved ? "bg-card text-lime-700 ring-lime-600/20" : "bg-muted text-muted-foreground ring-border hover:bg-lime-50 hover:text-lime-700"}`}
                  >
                    {a.resolved ? "Selesai" : "Tandai selesai"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canAnnotate ? (
        <form onSubmit={add} className="shrink-0 space-y-2 border-t border-border bg-muted/30 p-3">
          {canReview ? (
            <TutorReviewToolbar
              templates={templates}
              onInsert={(text) => setBody((b) => (b.trim() ? `${b.trim()} ${text}` : text))}
            />
          ) : null}
          <div className="flex gap-2">
            <input value={page} onChange={(e) => setPage(e.target.value)} inputMode="numeric" placeholder="Hal." aria-label="Halaman" className="min-h-11 w-16 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Tulis komentar revisi…" className="min-h-11 min-w-0 flex-1 rounded-xl bg-card px-3 py-2 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400" />
            <button type="submit" disabled={pending || body.trim().length < 2} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50" aria-label="Kirim komentar">
              <IconPlus className="h-4 w-4" />
            </button>
          </div>
          {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}
