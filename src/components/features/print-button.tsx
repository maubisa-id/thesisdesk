"use client";

import { Printer } from "lucide-react";

// Tombol cetak (browser print -> simpan PDF). Disembunyikan saat mencetak.
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="print:hidden inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600"
    >
      <Printer className="h-4 w-4" /> Cetak / Simpan PDF
    </button>
  );
}
