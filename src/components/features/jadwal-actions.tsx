"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2, NotebookPen, CalendarClock, MessageSquareText, Clock3, Info } from "lucide-react";
import { requestSchedule, actOnSchedule, setSessionNotes } from "@/lib/actions";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
import { IconPlus, IconCheck, IconClose, IconVideo, IconCalendar } from "@/components/icons";

// Nilai minimum datetime-local: 1 jam dari sekarang, dibulatkan (waktu lokal browser).
function minDateTimeLocal(): string {
  const d = new Date(Date.now() + 60 * 60_000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const TOPIC_SUGGESTIONS = ["Review BAB IV", "Konsultasi metodologi", "Bimbingan revisi", "Persiapan sidang"];

// Ajukan sesi = tugas kritis (input butuh keputusan) → Modal berscrim, BUKAN form inline.
// Alasan psikologis (Cognitive Interruption): saat mengisi jadwal, klien perlu fokus penuh;
// backdrop gelap mengunci perhatian & mencegah interaksi ganda dengan konten di belakang.
export function RequestScheduleForm() {
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await requestSchedule({ topic, scheduledAt: when });
        if (res.ok) {
          toast.success(res.message ?? "Pengajuan terkirim ke tutor.");
          setTopic("");
          setWhen("");
          setOpen(false);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Koneksi terputus. Pengajuan belum terkirim, jadi tidak ada yang berubah. Coba lagi.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button className="rounded-full">
            <IconPlus /> Ajukan sesi
          </Button>
        }
      />
      <DialogContent showCloseButton={!pending} className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarClock className="size-5" />
          </div>
          <DialogTitle>Ajukan sesi bimbingan</DialogTitle>
          <DialogDescription>Pilih topik dan waktu yang kamu inginkan. Tutor akan menyetujui atau mengusulkan waktu lain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="topic">Topik sesi</Label>
            <div className="relative">
              <MessageSquareText className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="topic" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="mis. Review BAB IV, interpretasi data" autoFocus className="h-11 pl-9" aria-invalid={error ? true : undefined} aria-describedby={error ? "req-error" : undefined} />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {TOPIC_SUGGESTIONS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTopic(t)}
                  className="rounded-full border border-border bg-muted/40 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="when">Tanggal & jam</Label>
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="when" type="datetime-local" min={minDateTimeLocal()} value={when} onChange={(e) => setWhen(e.target.value)} className="h-11 pl-9" aria-invalid={error ? true : undefined} aria-describedby={error ? "when-help req-error" : "when-help"} />
            </div>
            <p id="when-help" className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock3 className="size-3.5" /> Durasi sesi umumnya 45-60 menit. Pilih minimal 1 jam dari sekarang.
            </p>
          </div>
          {error ? (
            <p id="req-error" role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Info className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Mengirim" : "Kirim pengajuan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Setujui / Tolak sesi = keputusan kritis (buat GMeet + notifikasi mahasiswa) → ConfirmDialog
// berscrim + focus-trap. Alasan psikologis: keputusan yang punya konsekuensi butuh momen fokus
// (bukan satu klik cepat yang mudah salah). ConfirmDialog juga menangani koneksi terputus.
export function TutorScheduleActions({ id, status }: { id: number; status: string }) {
  if (status === "selesai" || status === "rejected") return null;

  return (
    <>
      {status === "pending" ? (
        <>
          <ConfirmDialog
            trigger={
              <Button size="sm" className="rounded-full">
                <IconVideo /> Setujui & buat Meet
              </Button>
            }
            title="Setujui sesi ini?"
            description="Link Google Meet dibuat otomatis dan mahasiswa diberi tahu bahwa sesi disetujui."
            confirmLabel="Ya, setujui"
            successMessage="Sesi disetujui, link Meet dibuat."
            onConfirm={() => actOnSchedule({ id, action: "approve" })}
          />
          <RescheduleDialog id={id} />
          <ConfirmDialog
            trigger={
              <Button size="sm" variant="outline" className="rounded-full text-destructive hover:text-destructive">
                <IconClose /> Tolak
              </Button>
            }
            title="Tolak pengajuan sesi?"
            description="Mahasiswa akan melihat sesi ini ditolak. Sarankan waktu lain lewat chat bila perlu."
            confirmLabel="Tolak sesi"
            variant="destructive"
            successMessage="Sesi ditolak."
            onConfirm={() => actOnSchedule({ id, action: "reject" })}
          />
        </>
      ) : null}
      {status === "approved" ? (
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline" className="rounded-full">
              <IconCheck /> Tandai selesai
            </Button>
          }
          title="Tandai sesi selesai?"
          description="Sesi akan masuk ke riwayat bimbingan mahasiswa."
          confirmLabel="Ya, selesai"
          successMessage="Sesi ditandai selesai."
          onConfirm={() => actOnSchedule({ id, action: "selesai" })}
        />
      ) : null}
    </>
  );
}

// Catatan Sesi + Link Recording GMeet (TUGAS 2) - tutor mengisi hasil sesi. Dialog berscrim.
// Alasan psikologis: mengisi catatan/rekaman = input butuh keputusan → fokus penuh via modal.
export function SessionNotesDialog({
  id,
  currentNote,
  currentRecording,
}: {
  id: number;
  currentNote: string | null;
  currentRecording: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(currentNote ?? "");
  const [recording, setRecording] = useState(currentRecording ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await setSessionNotes({ id, tutorNote: note, recordingLink: recording });
        if (res.ok) {
          toast.success(res.message ?? "Catatan sesi disimpan.");
          setOpen(false);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Koneksi terputus. Catatan belum tersimpan. Coba lagi.");
      }
    });
  }

  const has = Boolean(currentNote || currentRecording);

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="rounded-full">
            <NotebookPen /> {has ? "Ubah catatan & rekaman" : "Catatan & rekaman"}
          </Button>
        }
      />
      <DialogContent showCloseButton={!pending} className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <NotebookPen className="size-5" />
          </div>
          <DialogTitle>Catatan &amp; rekaman sesi</DialogTitle>
          <DialogDescription>Ringkas hasil sesi dan tempel link rekaman Google Meet. Mahasiswa melihatnya di riwayat bimbingan.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor="tnote">Catatan tutor</Label>
            <Textarea id="tnote" value={note} onChange={(e) => setNote(e.target.value)} rows={4} placeholder="mis. Perbaiki landasan teori, perbanyak rujukan 5 tahun terakhir." autoFocus />
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Info className="size-3.5" /> Tulis poin revisi & langkah berikutnya agar mahasiswa mudah menindaklanjuti.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="trec">Link recording GMeet (opsional)</Label>
            <div className="relative">
              <IconVideo className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id="trec" type="url" inputMode="url" value={recording} onChange={(e) => setRecording(e.target.value)} placeholder="https://drive.google.com/..." className="h-11 pl-9" />
            </div>
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Info className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : <IconCheck />}
              {pending ? "Menyimpan" : "Simpan catatan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Tutor mengusulkan waktu pengganti -> status jadi "menunggu_klien". Dialog berscrim + focus-trap.
// Alasan psikologis (Cognitive Interruption): mengubah jadwal orang lain butuh keputusan sadar,
// jadi konteks di belakang diredupkan agar tutor fokus memilih waktu, bukan aksi refleks.
export function RescheduleDialog({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [when, setWhen] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      try {
        const res = await actOnSchedule({ id, action: "reschedule", newTime: when });
        if (res.ok) {
          toast.success("Usulan waktu baru dikirim ke mahasiswa.");
          setWhen("");
          setOpen(false);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Koneksi terputus. Usulan belum terkirim, jadwal tidak berubah. Coba lagi.");
      }
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return;
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <DialogTrigger
        render={
          <Button size="sm" variant="outline" className="rounded-full">
            <CalendarClock /> Usulkan waktu lain
          </Button>
        }
      />
      <DialogContent showCloseButton={!pending} className="sm:max-w-md">
        <DialogHeader>
          <div className="mb-1 flex size-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <CalendarClock className="size-5" />
          </div>
          <DialogTitle>Usulkan waktu pengganti</DialogTitle>
          <DialogDescription>Mahasiswa akan diminta menyetujui waktu baru ini atau meminta waktu lain.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-5" noValidate>
          <div className="space-y-2">
            <Label htmlFor={`rwhen-${id}`}>Waktu baru</Label>
            <div className="relative">
              <IconCalendar className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input id={`rwhen-${id}`} type="datetime-local" min={minDateTimeLocal()} value={when} onChange={(e) => setWhen(e.target.value)} autoFocus className="h-11 pl-9" />
            </div>
          </div>
          {error ? (
            <p role="alert" className="flex items-start gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <Info className="mt-0.5 size-4 shrink-0" /> {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>Batal</Button>
            <Button type="submit" disabled={pending}>
              {pending ? <Loader2 className="animate-spin" /> : null}
              {pending ? "Mengirim" : "Kirim usulan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// Sisi klien saat tutor mengusulkan waktu lain (status "menunggu_klien"): terima atau minta waktu lain.
// Keduanya keputusan kritis -> ConfirmDialog berscrim, bukan tombol telanjang yang mudah salah klik.
export function KlienScheduleActions({ id, status }: { id: number; status: string }) {
  if (status !== "menunggu_klien") return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <ConfirmDialog
        trigger={
          <Button size="sm" className="rounded-full">
            <IconCheck /> Terima jadwal
          </Button>
        }
        title="Terima waktu yang diusulkan?"
        description="Sesi akan disetujui dan link Google Meet dibuat otomatis."
        confirmLabel="Ya, terima"
        successMessage="Jadwal disetujui, link Meet dibuat."
        onConfirm={() => actOnSchedule({ id, action: "accept" })}
      />
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="outline" className="rounded-full">
            <CalendarClock /> Minta waktu lain
          </Button>
        }
        title="Minta waktu lain?"
        description="Pengajuan dikembalikan ke tutor agar mengusulkan jadwal yang lebih pas."
        confirmLabel="Kirim permintaan"
        successMessage="Permintaan waktu lain terkirim ke tutor."
        onConfirm={() => actOnSchedule({ id, action: "ask_other" })}
      />
    </div>
  );
}
