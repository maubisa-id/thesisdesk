import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/kit";
import { TrustPoints } from "./auth-form";

// Kerangka halaman auth: panel brand (kiri, desktop) + kartu form (kanan). Mobile: satu kolom,
// aksi utama tak tersembunyi. Nada tenang (Calm Study) - menurunkan kecemasan, bukan menaikkan.
export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="grid min-h-[100dvh] lg:grid-cols-[1fr_1.05fr]">
      {/* Panel brand */}
      <aside className="relative hidden overflow-hidden bg-gradient-to-b from-brand-500 to-brand-700 p-10 text-white lg:flex lg:flex-col">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
        />
        <Link href="/" className="relative flex items-center gap-2" aria-label="Maubisa Lulus">
          <Logo variant="white" className="h-7" />
          <span className="font-display text-lg font-semibold tracking-tight text-white/90">Lulus</span>
        </Link>

        <div className="relative mt-auto max-w-md space-y-6">
          <p className="font-display text-3xl font-bold leading-tight tracking-tight">
            Teman bimbingan skripsimu - dari judul sampai sidang.
          </p>
          <TrustPoints />
          <blockquote className="rounded-3xl bg-white/10 p-5 text-sm leading-relaxed text-white/85 ring-1 ring-white/10">
            &ldquo;Akhirnya revisi nggak nyasar. Aku tahu harus ngapain tiap minggu, dan dosen
            pembimbing gampang ditanya.&rdquo;
            <footer className="mt-2 text-xs text-white/60">- Rina, mahasiswa tingkat akhir</footer>
          </blockquote>
        </div>
      </aside>

      {/* Kartu form */}
      <main className="flex items-center justify-center px-5 py-10 sm:px-8">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Link href="/" className="flex items-center gap-2 text-brand-700" aria-label="Maubisa Lulus">
              <Logo variant="color" className="h-7" />
              <span className="font-display text-lg font-semibold tracking-tight">Lulus</span>
            </Link>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">
            {eyebrow}
          </p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-ink">{title}</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  );
}
