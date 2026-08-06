"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Loader2 } from "lucide-react";
import { createFaculty, deleteFaculty, createProgram, deleteProgram } from "@/app/(app)/admin/prodi/actions";

type Program = { id: number; name: string; code: string | null; level: string; users: number };
type Faculty = { id: number; name: string; code: string | null; programs: Program[] };

const LEVELS = ["D3", "S1", "S2", "S3"] as const;

export function ProdiManager({ faculties }: { faculties: Faculty[] }) {
  const [pending, start] = useTransition();
  const [fName, setFName] = useState("");
  const [fCode, setFCode] = useState("");

  function addFaculty(e: React.FormEvent) {
    e.preventDefault();
    if (fName.trim().length < 2) return;
    start(async () => {
      const res = await createFaculty({ name: fName, code: fCode || undefined });
      if (res.ok) {
        toast.success("Fakultas ditambahkan.");
        setFName("");
        setFCode("");
      } else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={addFaculty} className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-soft">
        <label className="flex-1 min-w-[12rem] space-y-1">
          <span className="text-[13px] font-semibold text-ink-soft">Nama fakultas</span>
          <input value={fName} onChange={(e) => setFName(e.target.value)} placeholder="mis. Fakultas Teknik" className="w-full rounded-xl bg-muted/40 px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </label>
        <label className="w-28 space-y-1">
          <span className="text-[13px] font-semibold text-ink-soft">Kode</span>
          <input value={fCode} onChange={(e) => setFCode(e.target.value)} placeholder="FT" className="w-full rounded-xl bg-muted/40 px-3 py-2 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </label>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60">
          {pending ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Tambah fakultas
        </button>
      </form>

      {faculties.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          Belum ada fakultas. Tambahkan yang pertama di atas.
        </p>
      ) : (
        <ul className="space-y-4">
          {faculties.map((f) => (
            <FacultyCard key={f.id} faculty={f} pending={pending} start={start} />
          ))}
        </ul>
      )}
    </div>
  );
}

function FacultyCard({ faculty, pending, start }: { faculty: Faculty; pending: boolean; start: React.TransitionStartFunction }) {
  const [pName, setPName] = useState("");
  const [pCode, setPCode] = useState("");
  const [level, setLevel] = useState<(typeof LEVELS)[number]>("S1");

  function addProgram(e: React.FormEvent) {
    e.preventDefault();
    if (pName.trim().length < 2) return;
    start(async () => {
      const res = await createProgram({ facultyId: faculty.id, name: pName, code: pCode || undefined, level });
      if (res.ok) {
        toast.success("Prodi ditambahkan.");
        setPName("");
        setPCode("");
      } else toast.error(res.error);
    });
  }

  function removeFaculty() {
    if (!confirm(`Hapus ${faculty.name} beserta prodinya?`)) return;
    start(async () => {
      const res = await deleteFaculty({ id: faculty.id });
      if (!res.ok) toast.error(res.error);
    });
  }

  function removeProgram(id: number, name: string) {
    if (!confirm(`Hapus prodi ${name}?`)) return;
    start(async () => {
      const res = await deleteProgram({ id });
      if (!res.ok) toast.error(res.error);
    });
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">
            {faculty.name} {faculty.code ? <span className="text-muted-foreground">({faculty.code})</span> : null}
          </h3>
          <p className="text-xs text-muted-foreground">{faculty.programs.length} program studi</p>
        </div>
        <button type="button" onClick={removeFaculty} disabled={pending} aria-label={`Hapus ${faculty.name}`} className="rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
          <Trash2 className="size-4" />
        </button>
      </div>

      {faculty.programs.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {faculty.programs.map((p) => (
            <li key={p.id} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm">
              <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700">{p.level}</span>
              <span className="min-w-0 flex-1 truncate text-foreground">{p.name} {p.code ? <span className="text-muted-foreground">({p.code})</span> : null}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{p.users} orang</span>
              <button type="button" onClick={() => removeProgram(p.id, p.name)} disabled={pending} aria-label={`Hapus ${p.name}`} className="shrink-0 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50">
                <Trash2 className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <form onSubmit={addProgram} className="mt-3 flex flex-wrap items-end gap-2">
        <input value={pName} onChange={(e) => setPName(e.target.value)} placeholder="Nama prodi (mis. Teknik Informatika)" className="min-w-[10rem] flex-1 rounded-lg bg-muted/40 px-3 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <input value={pCode} onChange={(e) => setPCode(e.target.value)} placeholder="Kode" className="w-24 rounded-lg bg-muted/40 px-3 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400" />
        <select value={level} onChange={(e) => setLevel(e.target.value as (typeof LEVELS)[number])} className="rounded-lg bg-muted/40 px-3 py-1.5 text-sm ring-1 ring-border focus:outline-none focus:ring-2 focus:ring-brand-400">
          {LEVELS.map((l) => (
            <option key={l} value={l}>{l}</option>
          ))}
        </select>
        <button type="submit" disabled={pending} className="inline-flex items-center gap-1.5 rounded-full bg-muted px-3 py-1.5 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-60">
          <Plus className="size-3.5" /> Prodi
        </button>
      </form>
    </li>
  );
}
