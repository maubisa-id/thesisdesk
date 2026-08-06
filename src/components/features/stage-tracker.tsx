"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { ArrowUp, Check, Loader2, Clock } from "lucide-react";
import { STAGE_ORDER, STAGE_LABEL } from "@/lib/format";
import { requestStageAdvance } from "@/lib/actions";

// Stepper alur bertingkat proposal -> seminar -> sidang -> selesai.
// canRequest: mahasiswa boleh mengajukan naik tahap. pending: sudah ada pengajuan menunggu kaprodi.
export function StageTracker({
  bimbinganId,
  stage,
  pending,
  canRequest,
}: {
  bimbinganId: number;
  stage: string;
  pending: boolean;
  canRequest: boolean;
}) {
  const [busy, start] = useTransition();
  const currentIndex = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number]);
  const isLast = currentIndex >= STAGE_ORDER.length - 1;

  function ajukan() {
    start(async () => {
      const res = await requestStageAdvance({ bimbinganId });
      if (res.ok) toast.success(res.message ?? "Pengajuan dikirim.");
      else toast.error(res.error);
    });
  }

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Alur bimbingan
          </p>
          <h3 className="mt-1 text-lg font-semibold text-foreground">Tahap {STAGE_LABEL[stage] ?? stage}</h3>
        </div>
        {pending ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-3 py-1.5 text-sm font-medium text-amber-800">
            <Clock className="h-4 w-4" /> Menunggu kaprodi
          </span>
        ) : canRequest && !isLast ? (
          <button
            type="button"
            onClick={ajukan}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
            Ajukan naik tahap
          </button>
        ) : null}
      </div>

      <ol className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        {STAGE_ORDER.map((s, i) => {
          const done = i < currentIndex;
          const active = i === currentIndex;
          return (
            <li
              key={s}
              className={`flex items-center gap-2.5 rounded-2xl border px-3.5 py-3 ${
                active
                  ? "border-brand-300 bg-brand-50"
                  : done
                    ? "border-border bg-muted"
                    : "border-border bg-card"
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  active
                    ? "bg-brand-500 text-white"
                    : done
                      ? "bg-brand-100 text-brand-700"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </span>
              <span
                className={`text-sm font-medium ${active ? "text-brand-700" : done ? "text-foreground" : "text-muted-foreground"}`}
              >
                {STAGE_LABEL[s]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
