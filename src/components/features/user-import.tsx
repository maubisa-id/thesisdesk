"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Upload, Loader2, Download } from "lucide-react";
import { importUsers, type ImportRow } from "@/app/(app)/admin/pengguna/import-actions";

const SAMPLE = "name,email,role,prodi,angkatan\nBudi Santoso,budi@student.ac.id,klien,TI,2024\nSiti Aminah,siti@student.ac.id,klien,SI,2023";

export function UserImport() {
  const [open, setOpen] = useState(false);
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportRow[] | null>(null);
  const [pending, start] = useTransition();

  function submit() {
    if (csv.trim().length < 10) return toast.error("Tempel data CSV dulu.");
    start(async () => {
      const res = await importUsers(csv);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setRows(res.rows);
      toast.success(`${res.created} dibuat, ${res.skipped} dilewati, ${res.failed} gagal.`);
    });
  }

  function downloadCredentials() {
    if (!rows) return;
    const created = rows.filter((r) => r.status === "dibuat");
    const csvOut = "email,password_sementara\n" + created.map((r) => `${r.email},${r.tempPassword}`).join("\n");
    const blob = new Blob(["\uFEFF" + csvOut], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "kredensial-impor.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600">
        <Upload className="size-4" /> Impor CSV
      </button>
    );
  }

  return (
    <div className="w-full space-y-3 rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Impor pengguna dari CSV</h3>
        <button type="button" onClick={() => setOpen(false)} className="text-sm font-medium text-muted-foreground hover:text-foreground">Tutup</button>
      </div>
      <p className="text-xs text-muted-foreground">
        Header: <code className="rounded bg-muted px-1">name,email,role,prodi,angkatan</code>. Kolom prodi memakai kode/nama prodi. Akun dibuat dengan kata sandi sementara acak; unduh daftarnya lalu bagikan ke pengguna.
      </p>
      <textarea
        value={csv}
        onChange={(e) => setCsv(e.target.value)}
        rows={7}
        placeholder={SAMPLE}
        className="w-full resize-y rounded-xl bg-muted/40 px-3 py-2 font-mono text-xs ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={submit} disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />} Proses impor
        </button>
        <button type="button" onClick={() => setCsv(SAMPLE)} className="text-sm font-medium text-brand-600 hover:text-brand-700">Isi contoh</button>
        {rows && rows.some((r) => r.status === "dibuat") ? (
          <button type="button" onClick={downloadCredentials} className="inline-flex items-center gap-2 rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground hover:bg-accent">
            <Download className="size-4" /> Unduh kredensial
          </button>
        ) : null}
      </div>

      {rows ? (
        <ul className="max-h-56 space-y-1 overflow-y-auto rounded-xl bg-muted/40 p-2 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="flex items-center justify-between gap-2 px-2 py-1">
              <span className="min-w-0 flex-1 truncate">{r.email}</span>
              <span className={r.status === "dibuat" ? "text-emerald-700" : r.status === "dilewati" ? "text-amber-700" : "text-rose-700"}>
                {r.status}{r.note ? ` (${r.note})` : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
