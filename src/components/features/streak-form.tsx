"use client";

import { useState, useTransition } from "react";
import { logWriting } from "@/lib/actions";
import { IconFlame, IconCheck } from "@/components/icons";

export function LogWritingForm() {
  const [words, setWords] = useState("");
  const [minutes, setMinutes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [pending, start] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(false);
    start(async () => {
      const res = await logWriting({ words, minutes: minutes || 0 });
      if (res.ok) {
        setOk(true);
        setWords("");
        setMinutes("");
        setTimeout(() => window.location.reload(), 700);
      } else setError(res.error);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-3 rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border">
      <h3 className="font-display text-lg font-bold tracking-tight text-ink">Catat sesi menulis hari ini</h3>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label htmlFor="words" className="block text-[13px] font-semibold text-ink-soft">Jumlah kata</label>
          <input id="words" value={words} onChange={(e) => setWords(e.target.value)} inputMode="numeric" placeholder="mis. 500" className="w-full rounded-2xl bg-muted/40 px-4 py-2.5 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="minutes" className="block text-[13px] font-semibold text-ink-soft">Menit (opsional)</label>
          <input id="minutes" value={minutes} onChange={(e) => setMinutes(e.target.value)} inputMode="numeric" placeholder="mis. 45" className="w-full rounded-2xl bg-muted/40 px-4 py-2.5 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400" />
        </div>
      </div>
      {error ? <p role="alert" className="text-sm text-rose-600">{error}</p> : null}
      <button type="submit" disabled={pending} className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white shadow-brand hover:bg-brand-600 disabled:opacity-60">
        {ok ? <><IconCheck className="h-4 w-4" /> Tercatat!</> : <><IconFlame className="h-4 w-4" /> {pending ? "Menyimpan…" : "Catat sesi"}</>}
      </button>
    </form>
  );
}
