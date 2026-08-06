"use client";

import { useState, useTransition } from "react";
import { Loader2, Mail, Phone, GraduationCap, CalendarCheck, NotebookPen } from "lucide-react";
import { getKlienDetail, type KlienDetail } from "@/lib/actions";
import { Avatar, Badge } from "@/components/kit";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { IconClock } from "@/components/icons";
import { tanggalWaktu, SCHEDULE_STATUS_LABEL, CHAPTER_SHORT, persen, waktuRelatif } from "@/lib/format";

// Modal profil klien (dipicu dari kartu "Klien saya"). Scrim + focus-trap + Escape (shadcn Dialog).
// Data diambil on-demand saat dibuka (hindari over-fetch di daftar). RBAC di server (getKlienDetail).
export function KlienDetailDialog({
  klienId,
  children,
}: {
  klienId: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<KlienDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function onOpenChange(o: boolean) {
    setOpen(o);
    if (o && !data) {
      setError(null);
      start(async () => {
        const res = await getKlienDetail({ klienId });
        if (res.ok) setData(res.data);
        else setError(res.error);
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <button
        type="button"
        onClick={() => onOpenChange(true)}
        className="w-full rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
      >
        {children}
      </button>

      <DialogContent className="max-h-[85vh] gap-0 overflow-hidden p-0 sm:max-w-lg">
        {pending ? (
          <div className="flex min-h-[20rem] items-center justify-center">
            <Loader2 className="size-6 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>Detail klien</DialogTitle>
              <DialogDescription className="text-destructive">{error}</DialogDescription>
            </DialogHeader>
          </div>
        ) : data ? (
          <div className="flex max-h-[85vh] flex-col">
            {/* Header profil */}
            <DialogHeader className="shrink-0 border-b border-border bg-gradient-to-br from-brand-50 to-card p-6">
              <div className="flex items-center gap-4">
                <Avatar name={data.name} url={data.avatarUrl} size={56} />
                <div className="min-w-0 flex-1">
                  <DialogTitle className="truncate text-lg">{data.name}</DialogTitle>
                  <DialogDescription className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-card px-2.5 py-0.5 text-xs font-medium capitalize text-muted-foreground ring-1 ring-border">
                      {data.serviceType}
                    </span>
                    <Badge value={data.status} label={data.status === "ongoing" ? "Sedang berjalan" : data.status} />
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
              {/* Informasi klien */}
              <section className="space-y-3">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Informasi klien</h3>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-start gap-2.5">
                    <GraduationCap className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <div className="min-w-0">
                      <dt className="text-xs text-muted-foreground">Judul skripsi</dt>
                      <dd className="font-medium text-foreground">{data.thesisTitle ?? "Belum diisi"}</dd>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <Mail className="size-4 shrink-0 text-muted-foreground" />
                    <a href={`mailto:${data.email}`} className="truncate font-medium text-brand-600 hover:underline">{data.email}</a>
                  </div>
                  {data.phone ? (
                    <div className="flex items-center gap-2.5">
                      <Phone className="size-4 shrink-0 text-muted-foreground" />
                      <a href={`tel:${data.phone}`} className="font-medium text-foreground hover:underline">{data.phone}</a>
                    </div>
                  ) : null}
                </dl>
              </section>

              {/* Ringkasan progres + pertemuan */}
              <section className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><CalendarCheck className="size-3.5" /> Pertemuan selesai</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{data.sessionCount}</p>
                </div>
                <div className="rounded-xl border border-border bg-muted/30 p-4">
                  <p className="text-xs text-muted-foreground">Progres milestone</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{persen(data.progress.pct)}</p>
                  <p className="text-xs text-muted-foreground">{data.progress.done}/{data.progress.total} selesai</p>
                </div>
              </section>

              {/* Progres per BAB */}
              {data.progress.total > 0 ? (
                <section className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Progres per BAB</h3>
                  <div className="space-y-1.5">
                    {["proposal", "bab1", "bab2", "bab3", "bab4", "bab5"].map((ch) => {
                      const c = data.perChapter.find((p) => p.chapter === ch);
                      const pct = c && c.total ? (c.done / c.total) * 100 : 0;
                      return (
                        <div key={ch} className="flex items-center gap-3">
                          <span className="w-14 shrink-0 text-xs font-medium text-muted-foreground">{CHAPTER_SHORT[ch]}</span>
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {data.lastActivity ? (
                    <p className="text-xs text-muted-foreground">Aktivitas terakhir {waktuRelatif(data.lastActivity)}</p>
                  ) : null}
                </section>
              ) : null}

              {/* Riwayat pertemuan & catatan */}
              <section className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Riwayat pertemuan &amp; catatan</h3>
                {data.sessions.length === 0 ? (
                  <p className="rounded-xl bg-muted/40 px-4 py-6 text-center text-sm text-muted-foreground">Belum ada pertemuan.</p>
                ) : (
                  <ul className="space-y-2">
                    {data.sessions.map((s) => (
                      <li key={s.id} className="rounded-xl border border-border bg-card p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              {s.sesiKe ? <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">Pertemuan {s.sesiKe}</span> : null}
                              <p className="truncate text-sm font-semibold text-foreground">{s.topic}</p>
                            </div>
                            <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><IconClock className="size-3" /> {tanggalWaktu(s.scheduledAt)}</p>
                          </div>
                          <Badge value={s.status} label={SCHEDULE_STATUS_LABEL[s.status]} />
                        </div>
                        {s.tutorNote ? (
                          <div className="mt-2 flex items-start gap-2 rounded-lg bg-muted/50 p-2.5">
                            <NotebookPen className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
                            <p className="text-xs text-ink-soft">{s.tutorNote}</p>
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
