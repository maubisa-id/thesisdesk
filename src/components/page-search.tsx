"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconSearch } from "@/components/icons";
import type { NavGroup } from "@/lib/nav";

// Pencarian halaman ala command-palette ringan (paritas "Cari halaman" account-center).
// Tekan "/" untuk fokus. Memfilter item navigasi peran aktif; Enter membuka hasil teratas.
export function PageSearch({ nav }: { nav: NavGroup[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const items = useMemo(
    () => nav.flatMap((g) => g.items.map((i) => ({ ...i, section: g.section }))),
    [nav],
  );
  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return items;
    return items.filter((i) => i.label.toLowerCase().includes(term) || i.section.toLowerCase().includes(term));
  }, [q, items]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT" && document.activeElement?.tagName !== "TEXTAREA") {
        e.preventDefault();
        inputRef.current?.focus();
      }
      if (e.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function go(href: string) {
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(href);
  }

  return (
    <div ref={wrapRef} className="relative hidden sm:block">
      <div className="flex items-center gap-2 rounded-full border border-border bg-muted/50 px-3 py-1.5 text-sm text-muted-foreground focus-within:border-brand-300 focus-within:bg-card">
        <IconSearch className="size-4 shrink-0" />
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, results.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && results[active]) {
              e.preventDefault();
              go(results[active].href);
            }
          }}
          placeholder="Cari halaman..."
          aria-label="Cari halaman"
          className="w-40 bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none lg:w-52"
        />
        <kbd className="hidden rounded border border-border bg-card px-1.5 text-[11px] font-medium text-muted-foreground lg:inline">/</kbd>
      </div>

      {open ? (
        <div className="absolute right-0 top-full z-40 mt-2 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1.5 shadow-lg">
          {results.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">Tidak ada halaman cocok.</p>
          ) : (
            <ul>
              {results.map((r, i) => (
                <li key={r.href}>
                  <button
                    type="button"
                    onMouseEnter={() => setActive(i)}
                    onClick={() => go(r.href)}
                    className={`flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                      i === active ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent/60"
                    }`}
                  >
                    <span className="font-medium text-foreground">{r.label}</span>
                    <span className="text-[11px] text-muted-foreground">{r.section}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
