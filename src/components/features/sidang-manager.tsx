"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Plus, Trash2, Loader2, FileText, CalendarClock } from "lucide-react";
import {
  EXAMINER_ROLES,
  DEFENSE_STATUS_LABEL,
  DEFENSE_RESULT_LABEL,
  STAGE_LABEL,
  parseExaminers,
  type Examiner,
} from "@/lib/format";
import { upsertDefense, setDefenseResult } from "@/lib/actions";
import type { SidangRow } from "@/lib/queries";

// Ubah Date/ISO -> nilai input datetime-local (waktu lokal, tanpa detik).
function toLocalInput(v: Date | string | null): string {
  if (!v) return "";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function SidangManager({ rows }: { rows: SidangRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-10 text-center text-sm text-muted-foreground">
        Belum ada bimbingan yang mencapai tahap sidang.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
      {rows.map((r) => (
        <SidangCard key={r.bimbinganId} row={r} />
      ))}
    </ul>
  );
}

function SidangCard({ row }: { row: SidangRow }) {
  const d = row.defense;
  const [when, setWhen] = useState(toLocalInput(d?.scheduledAt ?? null));
  const [location, setLocation] = useState(d?.location ?? "");
  const [examiners, setExaminers] = useState<Examiner[]>(parseExaminers(d?.examiners ?? null));
  const [status, setStatus] = useState(d?.status ?? "scheduled");
  const [result, setResult] = useState(d?.result ?? "");
  const [notes, setNotes] = useState(d?.notes ?? "");
  const [saving, startSave] = useTransition();
  const [saving2, startResult] = useTransition();

  function addExaminer() {
    setExaminers((x) => [...x, { name: "", role: "Penguji" }]);
  }
  function updateExaminer(i: number, patch: Partial<Examiner>) {
    setExaminers((x) => x.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  }
  function removeExaminer(i: number) {
    setExaminers((x) => x.filter((_, j) => j !== i));
  }

  function saveSchedule() {
    const cleaned = examiners.filter((e) => e.name.trim());
    startSave(async () => {
      const res = await upsertDefense({
        bimbinganId: row.bimbinganId,
        defenseId: d?.id,
        scheduledAt: when || undefined,
        location: location || undefined,
        examiners: cleaned,
      });
      if (res.ok) toast.success(res.message ?? "Tersimpan.");
      else toast.error(res.error);
    });
  }

  function saveResult() {
    if (!d?.id) {
      toast.error("Simpan jadwal sidang dulu.");
      return;
    }
    startResult(async () => {
      const res = await setDefenseResult({
        defenseId: d.id,
        status,
        result: status === "done" ? result || undefined : undefined,
        notes: notes || undefined,
      });
      if (res.ok) toast.success(res.message ?? "Tersimpan.");
      else toast.error(res.error);
    });
  }

  return (
    <li className="rounded-3xl border border-border bg-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{row.clientName}</p>
          {row.thesisTitle && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{row.thesisTitle}</p>}
          <p className="mt-1 text-xs text-muted-foreground">
            {row.prodi ? `${row.prodi} · ` : ""}Tahap {STAGE_LABEL[row.stage] ?? row.stage}
            {row.tutorName ? ` · Pembimbing ${row.tutorName}` : ""}
          </p>
        </div>
        {d?.id && (
          <Link
            href={`/berita-acara/${d.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3.5 py-2 text-sm font-medium text-foreground hover:bg-muted"
          >
            <FileText className="h-4 w-4" /> Berita acara
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Jadwal sidang</span>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => setWhen(e.target.value)}
            className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-foreground">Ruang / tautan</span>
          <input
            type="text"
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Ruang Sidang 2 atau tautan daring"
            className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
          />
        </label>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">Panel penguji</span>
          <button
            type="button"
            onClick={addExaminer}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>
        {examiners.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Belum ada penguji. Tambahkan ketua, penguji, dan pembimbing.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {examiners.map((e, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={e.name}
                  onChange={(ev) => updateExaminer(i, { name: ev.target.value })}
                  placeholder="Nama & gelar"
                  className="min-w-0 flex-1 rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
                />
                <select
                  value={e.role}
                  onChange={(ev) => updateExaminer(i, { role: ev.target.value })}
                  className="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-400"
                >
                  {EXAMINER_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeExaminer(i)}
                  aria-label="Hapus penguji"
                  className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-rose-600"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4">
        <button
          type="button"
          onClick={saveSchedule}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
          Simpan jadwal & penguji
        </button>
      </div>

      <div className="mt-5 border-t border-border pt-4">
        <span className="text-sm font-medium text-foreground">Hasil sidang</span>
        <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-muted-foreground">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-brand-400"
            >
              {Object.entries(DEFENSE_STATUS_LABEL).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          {status === "done" && (
            <label className="text-sm">
              <span className="mb-1 block text-muted-foreground">Keputusan</span>
              <select
                value={result}
                onChange={(e) => setResult(e.target.value)}
                className="w-full rounded-xl border border-border bg-background px-3 py-2 outline-none focus:border-brand-400"
              >
                <option value="">Pilih keputusan</option>
                {Object.entries(DEFENSE_RESULT_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Catatan revisi / rekomendasi panel (opsional)"
          rows={2}
          className="mt-3 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
        />
        <button
          type="button"
          onClick={saveResult}
          disabled={saving2}
          className="mt-3 inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          {saving2 ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Simpan hasil
        </button>
      </div>
    </li>
  );
}
