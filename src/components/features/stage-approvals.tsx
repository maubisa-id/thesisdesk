"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X, Loader2, ArrowRight } from "lucide-react";
import { STAGE_LABEL, STAGE_APPROVAL_STATUS_LABEL, nextStage } from "@/lib/format";
import { tanggalWaktu } from "@/lib/format";
import { decideStageApproval } from "@/lib/actions";
import type { StageApprovalRow } from "@/lib/queries";

export function StageApprovals({
  pending,
  decided,
}: {
  pending: StageApprovalRow[];
  decided: StageApprovalRow[];
}) {
  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Menunggu keputusan ({pending.length})
        </h2>
        {pending.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border bg-card px-4 py-8 text-center text-sm text-muted-foreground">
            Tidak ada pengajuan yang menunggu.
          </p>
        ) : (
          <ul className="space-y-3">
            {pending.map((a) => (
              <PendingCard key={a.id} a={a} />
            ))}
          </ul>
        )}
      </section>

      {decided.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground">
            Riwayat keputusan
          </h2>
          <ul className="space-y-2">
            {decided.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{a.clientName}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {STAGE_LABEL[a.stage] ?? a.stage}
                    {a.note ? ` - ${a.note}` : ""}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                    a.status === "approved"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-rose-100 text-rose-800"
                  }`}
                >
                  {STAGE_APPROVAL_STATUS_LABEL[a.status] ?? a.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function PendingCard({ a }: { a: StageApprovalRow }) {
  const [note, setNote] = useState("");
  const [busy, start] = useTransition();
  const target = nextStage(a.stage);

  function decide(decision: "approved" | "rejected") {
    start(async () => {
      const res = await decideStageApproval({ approvalId: a.id, decision, note: note || undefined });
      if (res.ok) toast.success(res.message ?? "Tersimpan.");
      else toast.error(res.error);
    });
  }

  return (
    <li className="rounded-3xl border border-border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-foreground">{a.clientName}</p>
          {a.thesisTitle && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{a.thesisTitle}</p>}
          {a.prodi && <p className="mt-1 text-xs text-muted-foreground">{a.prodi}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-full bg-muted px-3 py-1.5 text-sm font-medium text-foreground">
          {STAGE_LABEL[a.stage] ?? a.stage}
          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
          {STAGE_LABEL[target ?? ""] ?? "-"}
        </div>
      </div>

      <p className="mt-2 text-xs text-muted-foreground">Diajukan {tanggalWaktu(a.createdAt)}</p>

      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        className="mt-3 w-full rounded-full border border-border bg-background px-4 py-2 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200"
      />

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={() => decide("approved")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Setujui
        </button>
        <button
          type="button"
          onClick={() => decide("rejected")}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted disabled:opacity-60"
        >
          <X className="h-4 w-4" />
          Tolak
        </button>
      </div>
    </li>
  );
}
