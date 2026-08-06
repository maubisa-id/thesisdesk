"use client";

import { useState } from "react";
import { toast } from "sonner";
import { IconCalendar } from "@/components/icons";

// Kartu "Langganan kalender": tombol webcal (buka app kalender) + salin URL feed ICS.
export function CalendarSubscribe({ url }: { url: string }) {
  const webcal = url.replace(/^https?:\/\//, "webcal://");
  const [show, setShow] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL kalender disalin.");
    } catch {
      toast.error("Gagal menyalin. Salin manual dari kolom URL.");
      setShow(true);
    }
  }

  return (
    <section className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <IconCalendar className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-foreground">Langganan kalender</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Tambahkan jadwal sesi ke Google Calendar, Outlook, atau Apple Calendar. Sesi baru muncul otomatis.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={webcal}
              className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-600"
            >
              Tambah ke kalender
            </a>
            <button
              type="button"
              onClick={copy}
              className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              Salin URL
            </button>
            <button
              type="button"
              onClick={() => setShow((s) => !s)}
              className="text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              {show ? "Sembunyikan URL" : "Lihat URL"}
            </button>
          </div>
          {show ? (
            <p className="mt-2 break-all rounded-lg bg-muted/50 px-3 py-2 font-mono text-xs text-muted-foreground">
              {url}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-muted-foreground">
            URL ini rahasia - siapa pun yang memilikinya bisa melihat jadwalmu, jadi jangan dibagikan.
          </p>
        </div>
      </div>
    </section>
  );
}
