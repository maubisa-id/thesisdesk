"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Bell, CircleCheck, CalendarPlus, CalendarClock, FileText, FileCheck, MessageSquare, MessageSquarePlus, AlarmClock, Info, Check } from "lucide-react";
import { markNotificationRead, markAllNotificationsRead } from "@/lib/actions";
import { cn } from "@/lib/utils";
import { waktuRelatif } from "@/lib/format";

export type NotifItem = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  color: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

const TYPE_ICON: Record<string, typeof Bell> = {
  schedule_approved: CircleCheck,
  schedule_request: CalendarPlus,
  schedule_reschedule: CalendarClock,
  schedule_done: CircleCheck,
  doc_new: FileText,
  doc_reviewed: FileCheck,
  annotation_new: MessageSquarePlus,
  message_new: MessageSquare,
  reminder: AlarmClock,
  defense: Info,
  system: Info,
};

const COLOR_CLASS: Record<string, string> = {
  success: "bg-emerald-50 text-emerald-600",
  info: "bg-primary/10 text-primary",
  warning: "bg-amber-50 text-amber-600",
  danger: "bg-destructive/10 text-destructive",
};

// Daftar notifikasi HALAMAN penuh (menggantikan dropdown lonceng di header). Diakses dari nav bawah.
// Mengelompokkan "Belum dibaca" dulu (recognition + prioritas), lalu sisanya.
export function NotifikasiList({ initial }: { initial: NotifItem[] }) {
  const router = useRouter();
  const [items, setItems] = useState(initial);
  const [, start] = useTransition();
  const unread = items.filter((n) => !n.readAt).length;

  function openItem(n: NotifItem) {
    if (!n.readAt) {
      setItems((xs) => xs.map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)));
      start(() => markNotificationRead(n.id));
    }
    if (n.actionUrl) router.push(n.actionUrl);
  }

  function markAll() {
    setItems((xs) => xs.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })));
    start(() => markAllNotificationsRead());
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
          <Bell className="size-6" />
        </span>
        <p className="mt-2 text-sm font-semibold text-foreground">Belum ada notifikasi</p>
        <p className="max-w-sm text-sm text-muted-foreground">Kabar dari tutor, jadwal, dokumen, dan pesan akan muncul di sini.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {unread > 0 ? <><span className="font-semibold text-foreground">{unread}</span> belum dibaca</> : "Semua sudah dibaca"}
        </p>
        {unread > 0 ? (
          <button
            type="button"
            onClick={markAll}
            className="press inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3.5 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          >
            <Check className="size-4" /> Tandai semua terbaca
          </button>
        ) : null}
      </div>

      <ul className="overflow-hidden rounded-2xl border border-border bg-card">
        {items.map((n, i) => {
          const Icon = TYPE_ICON[n.type] ?? Info;
          return (
            <li key={n.id} className={cn(i > 0 && "border-t border-border")}>
              <button
                type="button"
                onClick={() => openItem(n)}
                className={cn(
                  "flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none",
                  !n.readAt && "bg-primary/[0.04]",
                )}
              >
                <span className={cn("mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full", COLOR_CLASS[n.color] ?? COLOR_CLASS.info)}>
                  <Icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={cn("truncate text-sm", n.readAt ? "font-medium text-foreground" : "font-semibold text-foreground")}>{n.title}</span>
                    {!n.readAt ? <span aria-label="Belum dibaca" className="size-2 shrink-0 rounded-full bg-primary" /> : null}
                  </span>
                  {n.body ? <span className="mt-0.5 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">{n.body}</span> : null}
                  <span className="mt-1 block text-[11px] text-muted-foreground/70">{waktuRelatif(n.createdAt)}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
