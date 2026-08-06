"use client";

import { useState, useTransition } from "react";
import { Unlock } from "lucide-react";
import {
  importCitationDoi,
  addCitationManual,
  deleteCitation,
  searchReferencesAction,
  saveCitationFromSearch,
  importReferences,
} from "@/lib/actions";
import type { ReferenceCandidate } from "@/lib/citation";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { IconQuote, IconCheck, IconSearch, IconExternal } from "@/components/icons";
import { cn } from "@/lib/utils";

// Formatter APA/IEEE menandai nama jurnal/venue dengan *italic* (markdown). Render jadi <em> asli
// untuk tampilan; saat menyalin, marker dibuang agar teks yang di-paste bersih (tanpa bintang).
function renderCitation(text: string) {
  return text.split("*").map((seg, i) => (i % 2 === 1 ? <em key={i}>{seg}</em> : <span key={i}>{seg}</span>));
}
function stripMarks(text: string): string {
  return text.replace(/\*/g, "");
}

export type CitationItem = {
  id: number;
  title: string;
  year: number | null;
  source: string;
  formattedApa: string | null;
  formattedIeee: string | null;
};

type AddTab = "cari" | "doi" | "impor" | "manual";

const SOURCE_LABEL: Record<string, string> = {
  openalex: "OpenAlex",
  doaj: "DOAJ",
  crossref: "Crossref",
  semanticscholar: "Semantic Scholar",
  arxiv: "arXiv",
  openlibrary: "OpenLibrary",
  core: "CORE",
  doi: "DOI",
  bibtex: "BibTeX",
  manual: "Manual",
};

export function SitasiClient({ citations }: { citations: CitationItem[] }) {
  const [items, setItems] = useState(citations);
  const [style, setStyle] = useState<"apa" | "ieee">("apa");
  const [tab, setTab] = useState<AddTab>("cari");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [copied, setCopied] = useState(false);

  function flash(setter: (v: string | null) => void, msg: string) {
    setter(msg);
  }

  function copyAll() {
    const text = items
      .map((c) => stripMarks((style === "apa" ? c.formattedApa : c.formattedIeee) ?? c.title))
      .join("\n\n");
    navigator.clipboard?.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-6">
      {/* Panel "Tambah referensi" bertab */}
      <div className="overflow-hidden rounded-3xl bg-card shadow-soft ring-1 ring-border">
        <div className="flex flex-wrap gap-1 border-b border-black/[0.06] p-2">
          {(
            [
              ["cari", "Cari jurnal"],
              ["doi", "Impor DOI"],
              ["impor", "BibTeX / RIS"],
              ["manual", "Manual"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setTab(k);
                setError(null);
                setOk(null);
              }}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-colors ${
                tab === k ? "bg-brand-50 text-brand-700 ring-1 ring-brand-200" : "text-muted-foreground hover:bg-muted/50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-4 sm:p-5">
          {ok ? <p className="mb-3 rounded-xl bg-lime-50 px-4 py-2.5 text-sm text-lime-700">{ok}</p> : null}
          {error ? (
            <p role="alert" className="mb-3 rounded-xl bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
              {error}
            </p>
          ) : null}

          {tab === "cari" ? (
            <SearchTab
              pending={pending}
              start={start}
              onError={(m) => flash(setError, m)}
              onOk={(m) => flash(setOk, m)}
              onSavedCount={(n) => setOk(`${n} referensi disimpan. Muat ulang untuk melihat di daftar pustaka.`)}
            />
          ) : null}

          {tab === "doi" ? (
            <DoiTab pending={pending} start={start} onError={(m) => flash(setError, m)} onOk={(m) => flash(setOk, m)} />
          ) : null}

          {tab === "impor" ? (
            <ImportTab
              pending={pending}
              start={start}
              onError={(m) => flash(setError, m)}
              onOk={(m) => flash(setOk, m)}
            />
          ) : null}

          {tab === "manual" ? (
            <ManualTab
              pending={pending}
              start={start}
              onError={(m) => flash(setError, m)}
              onOk={(m) => flash(setOk, m)}
            />
          ) : null}
        </div>
      </div>

      {/* Daftar pustaka */}
      <div className="rounded-3xl bg-card p-6 shadow-soft ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">
            Daftar Pustaka <span className="text-muted-foreground">({items.length})</span>
          </h3>
          <div className="flex items-center gap-2">
            <div className="flex rounded-full bg-muted p-0.5">
              {(["apa", "ieee"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setStyle(s)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold uppercase ${
                    style === s ? "bg-card text-brand-700 shadow-soft" : "text-muted-foreground"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            {items.length > 0 ? (
              <button
                type="button"
                onClick={copyAll}
                className="inline-flex items-center gap-1.5 rounded-full bg-card px-4 py-1.5 text-xs font-semibold text-ink-soft ring-1 ring-border hover:bg-muted/50"
              >
                {copied ? (
                  <>
                    <IconCheck className="h-3.5 w-3.5 text-lime-600" /> Tersalin
                  </>
                ) : (
                  "Salin semua"
                )}
              </button>
            ) : null}
          </div>
        </div>

        {items.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-border py-12 text-center">
            <IconQuote className="h-8 w-8 text-muted-foreground/70" />
            <p className="mt-3 text-sm text-muted-foreground">Belum ada sitasi. Cari jurnal, impor DOI/BibTeX, atau tambah manual.</p>
          </div>
        ) : (
          <ol className="mt-5 space-y-3">
            {items.map((c, i) => (
              <li key={c.id} className="group flex items-start gap-3 rounded-2xl bg-muted/40 p-4 ring-1 ring-border">
                <span className="mt-0.5 text-xs font-semibold text-muted-foreground">[{i + 1}]</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-relaxed text-ink">
                    {renderCitation((style === "apa" ? c.formattedApa : c.formattedIeee) ?? c.title)}
                  </p>
                  {SOURCE_LABEL[c.source] ? (
                    <span className="mt-1.5 inline-block rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                      {SOURCE_LABEL[c.source]}
                    </span>
                  ) : null}
                </div>
                <ConfirmDialog
                  trigger={
                    <button
                      type="button"
                      aria-label="Hapus sitasi"
                      className="shrink-0 rounded-full px-2 py-1 text-xs font-medium text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    >
                      Hapus
                    </button>
                  }
                  title="Hapus sitasi ini?"
                  description="Sitasi akan dihapus dari daftar pustakamu. Tindakan ini tidak bisa dibatalkan."
                  confirmLabel="Hapus"
                  variant="destructive"
                  successMessage="Sitasi dihapus."
                  onConfirm={async () => {
                    const res = await deleteCitation({ id: c.id });
                    if (res.ok) setItems((xs) => xs.filter((x) => x.id !== c.id));
                    return res;
                  }}
                />
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  );
}

type TabProps = {
  pending: boolean;
  start: (fn: () => void | Promise<void>) => void;
  onError: (m: string) => void;
  onOk: (m: string) => void;
};

// ── Tab: Cari jurnal (OpenAlex + DOAJ + Crossref) ──
function SearchTab({
  pending,
  start,
  onError,
  onSavedCount,
}: TabProps & { onSavedCount: (n: number) => void }) {
  const [query, setQuery] = useState("");
  const [oaOnly, setOaOnly] = useState(false);
  const [results, setResults] = useState<ReferenceCandidate[] | null>(null);
  const [savedIdx, setSavedIdx] = useState<Set<number>>(new Set());
  const [savedCount, setSavedCount] = useState(0);

  function run(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    setResults(null);
    setSavedIdx(new Set());
    start(async () => {
      const res = await searchReferencesAction({ query, openAccessOnly: oaOnly });
      if (res.ok) {
        setResults(res.results);
        if (res.results.length === 0) onError("Tidak ada hasil. Coba kata kunci lain atau matikan filter open access.");
      } else onError(res.error);
    });
  }

  function save(c: ReferenceCandidate, idx: number) {
    start(async () => {
      const res = await saveCitationFromSearch({
        provider: c.provider,
        type: c.type,
        title: c.title,
        authors: c.authors ?? [],
        year: c.year ?? null,
        doi: c.doi ?? null,
        container: c.container ?? null,
        volume: c.volume ?? null,
        issue: c.issue ?? null,
        pages: c.pages ?? null,
        publisher: c.publisher ?? null,
        abstract: c.abstract ?? null,
      });
      if (res.ok) {
        setSavedIdx((s) => new Set(s).add(idx));
        setSavedCount((n) => {
          const next = n + 1;
          onSavedCount(next);
          return next;
        });
      } else onError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <form onSubmit={run} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="ref-q" className="block text-sm font-semibold text-foreground">
            Cari judul / topik jurnal
          </label>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <IconSearch className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                id="ref-q"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="mis. deep learning untuk deteksi hoaks bahasa Indonesia"
                className="h-11 w-full rounded-2xl bg-muted/40 pl-10 pr-4 text-sm text-foreground ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
            </div>
            <button
              type="submit"
              disabled={pending || query.trim().length < 3}
              className="press inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-500 px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
            >
              {pending ? "Mencari" : <><IconSearch className="h-4 w-4" /> Cari</>}
            </button>
          </div>
        </div>

        {/* Filter open-access: switch dalam Common Region (Fitts: seluruh baris jadi target besar;
            Von Restorff: "open access" di-highlight; role=switch => a11y jelas on/off). */}
        <button
          type="button"
          role="switch"
          aria-checked={oaOnly}
          onClick={() => setOaOnly((v) => !v)}
          className={cn(
            "group flex w-full items-center gap-3 rounded-2xl border p-2.5 pr-3.5 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
            oaOnly ? "border-emerald-300 bg-emerald-50/60" : "border-border bg-muted/30 hover:bg-muted/50",
          )}
        >
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-xl transition-colors",
              oaOnly ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground",
            )}
          >
            <Unlock className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-medium text-foreground">
              Hanya <span className="font-semibold text-emerald-700">open access</span>
            </span>
            <span className="block text-xs text-muted-foreground">Jurnal yang gratis dibaca dan legal diunduh.</span>
          </span>
          <span
            aria-hidden
            className={cn(
              "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors",
              oaOnly ? "bg-emerald-500" : "bg-border",
            )}
          >
            <span
              className={cn(
                "inline-block size-5 rounded-full bg-card shadow-sm transition-transform duration-200 ease-[cubic-bezier(0.32,0.72,0,1)]",
                oaOnly ? "translate-x-5" : "translate-x-0.5",
              )}
            />
          </span>
        </button>
      </form>

      {results && results.length > 0 ? (
        <ul className="space-y-2.5">
          {results.map((c, idx) => {
            const saved = savedIdx.has(idx);
            const authorLine = (c.authors ?? []).slice(0, 3).map((a) => `${a.given ? `${a.given} ` : ""}${a.family}`).join(", ");
            return (
              <li key={idx} className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug text-foreground">{c.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {authorLine ? `${authorLine}${(c.authors?.length ?? 0) > 3 ? ", dkk." : ""} · ` : ""}
                      {c.year ?? "t.t."}
                      {c.container ? ` · ${c.container}` : ""}
                    </p>
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {c.openAccess ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
                          Open Access
                        </span>
                      ) : null}
                      <span className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-border">
                        {SOURCE_LABEL[c.provider] ?? c.provider}
                      </span>
                      {c.oaUrl || c.landingUrl ? (
                        <a
                          href={c.oaUrl ?? c.landingUrl ?? "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-8 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-brand-600 hover:text-brand-700"
                        >
                          <IconExternal className="h-3 w-3" /> {c.oaUrl ? "Baca PDF" : "Sumber"}
                        </a>
                      ) : null}
                    </div>
                    {c.abstract ? <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{c.abstract}</p> : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => save(c, idx)}
                    disabled={pending || saved}
                    className={cn(
                      "press inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-xs font-semibold ring-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600",
                      saved
                        ? "bg-lime-50 text-lime-700 ring-lime-200"
                        : "bg-card text-brand-600 ring-border hover:bg-brand-50 disabled:opacity-50",
                    )}
                  >
                    {saved ? (
                      <>
                        <IconCheck className="h-3.5 w-3.5" /> Tersimpan
                      </>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {savedCount > 0 ? (
        <button type="button" onClick={() => window.location.reload()} className="text-sm font-semibold text-brand-600 hover:text-brand-700">
          Muat ulang daftar pustaka →
        </button>
      ) : null}

      <p className="text-xs leading-relaxed text-muted-foreground">
        Sumber legal &amp; gratis: OpenAlex &amp; Semantic Scholar (jurnal, cakupan luas), DOAJ (open-access murni),
        arXiv (preprint), OpenLibrary (buku), Crossref (DOI), CORE (repositori kampus: skripsi/tesis).
        Metadata terverifikasi. Kami tidak pernah mengarang penulis/tahun/judul.
      </p>
    </div>
  );
}

// ── Tab: Impor DOI (Crossref) ──
function DoiTab({ pending, start, onError, onOk }: TabProps) {
  const [doi, setDoi] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    onOk("");
    start(async () => {
      const res = await importCitationDoi({ doi });
      if (res.ok) {
        setDoi("");
        window.location.reload();
      } else onError(res.error);
    });
  }
  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2">
      <div className="min-w-0 flex-1 space-y-1.5">
        <label htmlFor="doi" className="block text-[13px] font-semibold text-ink-soft">
          Impor dari DOI (Crossref)
        </label>
        <input
          id="doi"
          value={doi}
          onChange={(e) => setDoi(e.target.value)}
          placeholder="10.1234/contoh.doi"
          className="w-full rounded-2xl bg-muted/40 px-4 py-2.5 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
        />
      </div>
      <button
        type="submit"
        disabled={pending || doi.trim().length < 3}
        className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Mengimpor…" : "Impor"}
      </button>
    </form>
  );
}

// ── Tab: Impor BibTeX / RIS ──
function ImportTab({ pending, start, onError, onOk }: TabProps) {
  const [text, setText] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    onOk("");
    start(async () => {
      const res = await importReferences({ text });
      if (res.ok) {
        setText("");
        window.location.reload();
      } else onError(res.error);
    });
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <label htmlFor="bib" className="block text-[13px] font-semibold text-ink-soft">
        Tempel entri BibTeX atau RIS (boleh banyak sekaligus)
      </label>
      <textarea
        id="bib"
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={7}
        placeholder={"@article{key2024,\n  title={Judul artikel},\n  author={Nasution, Ahmad and Wijaya, Budi},\n  journal={Jurnal Informatika},\n  year={2024},\n  doi={10.1234/contoh}\n}"}
        className="w-full resize-y rounded-2xl bg-muted/40 px-4 py-3 font-mono text-xs leading-relaxed ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
      <button
        type="submit"
        disabled={pending || text.trim().length < 5}
        className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-50"
      >
        {pending ? "Mengimpor…" : "Impor entri"}
      </button>
    </form>
  );
}

// ── Tab: Tambah manual ──
function ManualTab({ pending, start, onError, onOk }: TabProps) {
  const [mTitle, setMTitle] = useState("");
  const [mAuthors, setMAuthors] = useState("");
  const [mYear, setMYear] = useState("");
  const [mContainer, setMContainer] = useState("");
  function submit(e: React.FormEvent) {
    e.preventDefault();
    onError("");
    onOk("");
    start(async () => {
      const res = await addCitationManual({
        title: mTitle,
        authors: mAuthors,
        year: mYear || undefined,
        container: mContainer || undefined,
      });
      if (res.ok) {
        window.location.reload();
      } else onError(res.error);
    });
  }
  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <Input label="Judul" value={mTitle} onChange={setMTitle} placeholder="Judul artikel/buku" full />
      <Input label="Penulis (Keluarga, Depan; …)" value={mAuthors} onChange={setMAuthors} placeholder="Nasution, Ahmad; Wijaya, Budi" full />
      <Input label="Tahun" value={mYear} onChange={setMYear} placeholder="2024" />
      <Input label="Jurnal/Penerbit" value={mContainer} onChange={setMContainer} placeholder="Jurnal Informatika" />
      <div className="sm:col-span-2">
        <button
          type="submit"
          disabled={pending || mTitle.trim().length < 3 || mAuthors.trim().length < 2}
          className="rounded-full bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-600 disabled:opacity-60"
        >
          Simpan sitasi
        </button>
      </div>
    </form>
  );
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  full,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  full?: boolean;
}) {
  return (
    <div className={`space-y-1.5 ${full ? "sm:col-span-2" : ""}`}>
      <label className="block text-[13px] font-semibold text-ink-soft">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl bg-muted/40 px-4 py-2.5 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
      />
    </div>
  );
}
