import Link from "next/link";
import { IconCap } from "@/components/icons";

export default function NotFound() {
  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600 ring-1 ring-brand-600/15">
        <IconCap className="h-7 w-7" />
      </span>
      <p className="mt-6 font-display text-4xl font-bold tracking-tight text-ink">404</p>
      <p className="mt-2 text-sm text-muted-foreground">Halaman yang kamu cari tidak ditemukan.</p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-brand hover:bg-brand-600"
      >
        Kembali ke dashboard
      </Link>
    </div>
  );
}
