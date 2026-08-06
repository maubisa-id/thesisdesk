import { Fragment, type ReactNode } from "react";

// Renderer markdown ringan & AMAN untuk output AI (scaffolding). Mengubah penanda umum
// (# heading, - / * bullet, > kutipan, **tebal**, *miring*) menjadi elemen React. TIDAK pernah
// dangerouslySetInnerHTML: React meng-escape teks otomatis, jadi output AI aman dari XSS.
// Sengaja minimal (bukan parser CommonMark penuh) - cukup untuk kerangka BAB, abstrak, panduan.

function renderInline(text: string, keyBase: string): ReactNode[] {
  // Pisah **tebal** lebih dulu, lalu *miring* di dalam tiap segmen non-tebal.
  const out: ReactNode[] = [];
  text.split(/(\*\*[^*]+\*\*)/g).forEach((chunk, bi) => {
    if (chunk.startsWith("**") && chunk.endsWith("**") && chunk.length > 4) {
      out.push(<strong key={`${keyBase}-b${bi}`}>{chunk.slice(2, -2)}</strong>);
      return;
    }
    chunk.split(/(\*[^*]+\*)/g).forEach((seg, si) => {
      if (seg.startsWith("*") && seg.endsWith("*") && seg.length > 2) {
        out.push(<em key={`${keyBase}-i${bi}-${si}`}>{seg.slice(1, -1)}</em>);
      } else if (seg) {
        out.push(<Fragment key={`${keyBase}-t${bi}-${si}`}>{seg}</Fragment>);
      }
    });
  });
  return out;
}

export function MarkdownLite({ text, className }: { text: string; className?: string }) {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];

  const flushList = (key: string) => {
    if (list.length === 0) return;
    const items = list.slice();
    list = [];
    blocks.push(
      <ul key={key} className="my-2 list-disc space-y-1 pl-5">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
  };

  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const key = `l${i}`;
    if (/^\s*[-*]\s+/.test(line)) {
      list.push(line.replace(/^\s*[-*]\s+/, ""));
      return;
    }
    flushList(`${key}-ul`);
    if (line.trim() === "") return;
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const cls = level === 1 ? "mt-3 mb-1 text-base font-bold text-ink" : level === 2 ? "mt-3 mb-1 text-sm font-bold text-ink" : "mt-2 mb-0.5 text-sm font-semibold text-ink-soft";
      blocks.push(<p key={key} className={cls}>{renderInline(h[2], key)}</p>);
      return;
    }
    if (/^\s*>\s?/.test(line)) {
      blocks.push(
        <p key={key} className="my-2 border-l-2 border-brand-300 pl-3 text-ink-soft">
          {renderInline(line.replace(/^\s*>\s?/, ""), key)}
        </p>,
      );
      return;
    }
    blocks.push(<p key={key} className="my-1.5">{renderInline(line, key)}</p>);
  });
  flushList("tail-ul");

  return <div className={className}>{blocks}</div>;
}
