import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button as UIButton } from "@/components/ui/button";
import { Card as UICard, CardContent } from "@/components/ui/card";
import { Avatar as UIAvatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

/* App-facing kit: komposisi di atas primitives shadcn/ui (Base UI + Lucide).
   Mempertahankan API lama supaya halaman tak perlu diubah, tapi tampilan kini
   memakai token shadcn (bg-card, border-border, text-muted-foreground, dst). */

/* ---------- Brand ---------- */

// Logo Thesisdesk: ikon mark inline SVG (tanpa dependency file gambar - tajam di semua ukuran/
// tema, gampang diganti dengan merek Anda sendiri). `white` untuk latar gelap (sidebar/panel auth
// cobalt), `color` untuk latar terang. className mengatur tinggi (mis. "h-6"/"h-7"). Nama produk
// ditulis terpisah di pemanggil (lihat auth-shell.tsx/shell.tsx) supaya institusi bisa mengganti
// nama tanpa menyentuh ikon, atau sebaliknya.
export function Logo({ variant = "color", className }: { variant?: "color" | "white"; className?: string }) {
  const isWhite = variant === "white";
  return (
    <svg viewBox="0 0 32 32" aria-hidden className={cn("shrink-0 select-none", className)}>
      <rect width="32" height="32" rx="9" fill={isWhite ? "#ffffff" : "#0a48b7"} />
      <path
        d="M9 12.5h14M9 16.5h10M9 20.5h14"
        stroke={isWhite ? "#0a48b7" : "#ffffff"}
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/* ---------- Status badge (domain thesis) ---------- */

const STATUS_TONE: Record<string, string> = {
  active: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  done: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  selesai: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  approved: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  reviewed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  in_progress: "bg-primary/10 text-primary ring-primary/20",
  in_review: "bg-primary/10 text-primary ring-primary/20",
  running: "bg-primary/10 text-primary ring-primary/20",
  ongoing: "bg-primary/10 text-primary ring-primary/20",
  review: "bg-primary/10 text-primary ring-primary/20",
  pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
  menunggu_klien: "bg-amber-50 text-amber-700 ring-amber-600/20",
  uploaded: "bg-amber-50 text-amber-700 ring-amber-600/20",
  queued: "bg-amber-50 text-amber-700 ring-amber-600/20",
  paused: "bg-amber-50 text-amber-700 ring-amber-600/20",
  todo: "bg-muted text-muted-foreground ring-border",
  expired: "bg-muted text-muted-foreground ring-border",
  cancelled: "bg-muted text-muted-foreground ring-border",
  blocked: "bg-rose-50 text-rose-700 ring-rose-600/20",
  rejected: "bg-rose-50 text-rose-700 ring-rose-600/20",
  failed: "bg-rose-50 text-rose-700 ring-rose-600/20",
};

const STATUS_DOT: Record<string, string> = {
  active: "bg-emerald-500", done: "bg-emerald-500", selesai: "bg-emerald-500", approved: "bg-emerald-500", reviewed: "bg-emerald-500",
  in_progress: "bg-primary", in_review: "bg-primary", running: "bg-primary", ongoing: "bg-primary", review: "bg-primary",
  pending: "bg-amber-500", menunggu_klien: "bg-amber-500", uploaded: "bg-amber-500", queued: "bg-amber-500", paused: "bg-amber-500",
  todo: "bg-muted-foreground/50", expired: "bg-muted-foreground/50", cancelled: "bg-muted-foreground/50",
  blocked: "bg-rose-500", rejected: "bg-rose-500", failed: "bg-rose-500",
};

export function Badge({ value, label }: { value: string; label?: string }) {
  const tone = STATUS_TONE[value] ?? "bg-muted text-muted-foreground ring-border";
  const dot = STATUS_DOT[value] ?? "bg-muted-foreground/50";
  return (
    <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tone)}>
      <span className={cn("size-1.5 rounded-full", dot)} />
      {label ?? value}
    </span>
  );
}

/* ---------- Surfaces ---------- */

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <UICard className={cn("gap-0 py-0", className)}>{children}</UICard>;
}

export function Panel({ children, className, innerClassName }: { children: ReactNode; className?: string; innerClassName?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/70 bg-muted/40 p-1.5", className)}>
      <div className={cn("rounded-xl border border-border bg-card", innerClassName)}>{children}</div>
    </div>
  );
}

/* ---------- Typography ---------- */

export function Eyebrow({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </span>
  );
}

// Subjudul halaman dihilangkan (redundant dengan judul di header shell). Komponen ini kini hanya
// menampilkan slot aksi (mis. "Ajukan sesi", "Unggah dokumen") rata kanan bila ada.
export function SectionTitle({ eyebrow, title, desc, action }: { eyebrow?: string; title?: string; desc?: string; action?: ReactNode }) {
  const hasText = Boolean(eyebrow || title || desc);
  if (!hasText && !action) return null;
  if (!hasText) return <div className="flex justify-end">{action}</div>;
  return (
    <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
      <div className="min-w-0 space-y-1.5">
        {eyebrow ? (
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">
            <span aria-hidden className="h-px w-6 bg-brand-400/60" />
            {eyebrow}
          </p>
        ) : null}
        {title ? <h1 className="font-display text-fluid-title font-bold tracking-tight text-foreground">{title}</h1> : null}
        {desc ? <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">{desc}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------- Dashboard header (signature "Kertas & Garis") ---------- */

// Header dashboard bertema kertas notebook akademik. Mengganti hero blur-blob generik.
// Cabinet Grotesk display + eyebrow ber-tracking + slot `aside` (mis. ProgressRing/stat).
export function DashboardHeader({
  eyebrow,
  title,
  desc,
  icon,
  aside,
}: {
  eyebrow?: string;
  title: ReactNode;
  desc?: ReactNode;
  icon?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="dash-header rounded-3xl border border-border p-6 shadow-[0_1px_2px_rgba(11,15,23,0.04)] sm:p-8">
      <div className="relative flex flex-wrap items-start justify-between gap-5 sm:pl-4">
        <div className="min-w-0 max-w-2xl space-y-2.5">
          {eyebrow ? (
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-600">{eyebrow}</p>
          ) : null}
          <h1 className="text-fluid-hero font-display font-bold tracking-tight text-foreground">{title}</h1>
          {desc ? <p className="text-sm leading-relaxed text-muted-foreground">{desc}</p> : null}
        </div>
        {aside ? (
          <div className="shrink-0">{aside}</div>
        ) : icon ? (
          <span className="hidden size-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 sm:flex">
            {icon}
          </span>
        ) : null}
      </div>
    </header>
  );
}

// Judul seksi konsisten (Cabinet display + aksi opsional). DRY untuk header kartu dashboard.
export function SectionHeading({ title, sub, action }: { title: string; sub?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="font-display text-lg font-bold tracking-tight text-foreground">{title}</h2>
        {sub ? <p className="mt-0.5 text-sm text-muted-foreground">{sub}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/* ---------- Data bits ---------- */

export function InfoRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-medium text-foreground">{children}</div>
    </div>
  );
}

export function StatCard({ icon, label, value, hint, accent = "text-primary", attention = false }: { icon: ReactNode; label: string; value: ReactNode; hint?: ReactNode; accent?: string; attention?: boolean }) {
  return (
    <UICard className={cn("h-full gap-0 py-0 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-md", attention && "ring-1 ring-primary/25")}>
      <CardContent className="flex h-full flex-col p-5">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", attention ? "bg-primary/10 text-primary" : cn("bg-muted", accent))}>{icon}</span>
        <div className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className={cn("mt-1 text-2xl font-bold tracking-tight tabular-nums", attention ? "text-primary" : "text-foreground")}>{value}</div>
        <div className="mt-1 min-h-4 text-xs text-muted-foreground">{hint ?? ""}</div>
      </CardContent>
    </UICard>
  );
}

/* ---------- Progress ring ---------- */

export function ProgressRing({ value, size = 84, stroke = 9, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, value));
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-primary/15" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} className="text-primary transition-[stroke-dashoffset] duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center">{children}</span>
    </div>
  );
}

/* ---------- Avatar ---------- */

export function Avatar({ name, url, size = 40 }: { name: string; url?: string | null; size?: number }) {
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return (
    <UIAvatar style={{ width: size, height: size }}>
      {url ? <AvatarImage src={url} alt={name} /> : null}
      <AvatarFallback className="bg-primary/10 font-semibold text-primary" style={{ fontSize: Math.max(11, Math.round(size * 0.4)) }}>{initials}</AvatarFallback>
    </UIAvatar>
  );
}

/* ---------- Buttons ---------- */

export function ButtonLink({ href, children, variant = "primary", icon = true, external = false }: { href: string; children: ReactNode; variant?: "primary" | "ghost"; icon?: boolean; external?: boolean }) {
  // Button-in-button: ikon trailing dibungkus chip lingkaran (pola CTA premium), dengan gerak
  // magnetik halus saat hover. Chip beradaptasi ke varian (putih transparan di primary, cobalt di ghost).
  const chipTone = variant === "primary" ? "bg-white/20" : "bg-primary/10";
  const inner = (
    <>
      <span>{children}</span>
      {icon ? (
        <span className={cn("ml-0.5 inline-flex size-6 items-center justify-center rounded-full transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover/button:translate-x-0.5 group-hover/button:-translate-y-px", chipTone)}>
          <ArrowRight className="size-3.5" />
        </span>
      ) : null}
    </>
  );
  const btnVariant = variant === "primary" ? "default" : "outline";
  const link = external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" />
  ) : (
    <Link href={href} />
  );
  return (
    <UIButton render={link} variant={btnVariant} size="lg" className="press rounded-full pr-2">
      {inner}
    </UIButton>
  );
}

export function Button({ children, variant = "primary", icon = false }: { children: ReactNode; variant?: "primary" | "ghost"; icon?: boolean }) {
  return (
    <UIButton variant={variant === "primary" ? "default" : "outline"} size="lg" className="rounded-full">
      <span>{children}</span>
      {icon ? <ArrowRight /> : null}
    </UIButton>
  );
}

/* ---------- Misc ---------- */

export function Reveal({ children, delay = 0, className }: { children: ReactNode; delay?: number; className?: string }) {
  return (
    <div className={cn("animate-rise", className)} style={{ animationDelay: `${delay}ms` }}>{children}</div>
  );
}

export function EmptyState({ icon, title, desc, action }: { icon: ReactNode; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/30 px-6 py-14 text-center">
      <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">{icon}</span>
      <p className="mt-4 text-sm font-semibold text-foreground">{title}</p>
      {desc ? <p className="mt-1 max-w-sm text-sm text-muted-foreground">{desc}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
