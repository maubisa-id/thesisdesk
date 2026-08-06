// Manajer sitasi (USP P1). Sumber referensi LEGAL (Crossref/OpenAlex) - bukan scraper berbayar.
// Formatter APA & IEEE dari field/CSL. Tanpa dependensi eksternal (pure).

export type Author = { family: string; given?: string };

export type CitationFields = {
  type?: string;
  title: string;
  authors?: Author[];
  year?: number | null;
  doi?: string | null;
  container?: string | null; // nama jurnal/penerbit
  volume?: string | null;
  issue?: string | null;
  pages?: string | null;
  publisher?: string | null;
  url?: string | null;
};

function initials(given?: string): string {
  if (!given) return "";
  return given
    .split(/\s+/)
    .filter(Boolean)
    .map((g) => `${g[0]!.toUpperCase()}.`)
    .join(" ");
}

// APA 7: "Nasution, A., & Wijaya, B. C."
export function authorsApa(authors: Author[] = []): string {
  const list = authors.map((a) => `${a.family}, ${initials(a.given)}`.trim());
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  if (list.length === 2) return `${list[0]}, & ${list[1]}`;
  return `${list.slice(0, -1).join(", ")}, & ${list[list.length - 1]}`;
}

// IEEE: "A. Nasution, B. C. Wijaya"
export function authorsIeee(authors: Author[] = []): string {
  const list = authors.map((a) => `${initials(a.given)} ${a.family}`.trim());
  if (list.length === 0) return "";
  if (list.length === 1) return list[0]!;
  return `${list.slice(0, -1).join(", ")} and ${list[list.length - 1]}`;
}

export function formatApa(f: CitationFields): string {
  const parts: string[] = [];
  const a = authorsApa(f.authors);
  if (a) parts.push(`${a} `);
  parts.push(`(${f.year ?? "t.t."}). `);
  parts.push(`${f.title.replace(/\.$/, "")}. `);
  if (f.container) {
    let c = `*${f.container}*`;
    if (f.volume) c += `, ${f.volume}`;
    if (f.issue) c += `(${f.issue})`;
    if (f.pages) c += `, ${f.pages}`;
    parts.push(`${c}. `);
  } else if (f.publisher) {
    parts.push(`${f.publisher}. `);
  }
  if (f.doi) parts.push(`https://doi.org/${f.doi}`);
  return parts.join("").trim();
}

export function formatIeee(f: CitationFields, index = 1): string {
  const parts: string[] = [`[${index}] `];
  const a = authorsIeee(f.authors);
  if (a) parts.push(`${a}, `);
  parts.push(`"${f.title.replace(/\.$/, "")}," `);
  if (f.container) {
    parts.push(`*${f.container}*`);
    if (f.volume) parts.push(`, vol. ${f.volume}`);
    if (f.issue) parts.push(`, no. ${f.issue}`);
    if (f.pages) parts.push(`, pp. ${f.pages}`);
    parts.push(", ");
  } else if (f.publisher) {
    parts.push(`${f.publisher}, `);
  }
  if (f.year) parts.push(`${f.year}. `);
  if (f.doi) parts.push(`doi: ${f.doi}.`);
  return parts.join("").trim();
}

// Parse input penulis bebas: "Nasution, Ahmad; Wijaya, Budi" ATAU satu per baris.
export function parseAuthors(input: string): Author[] {
  return input
    .split(/[;\n]/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      if (s.includes(",")) {
        const [family, given] = s.split(",").map((p) => p.trim());
        return { family: family!, given: given || undefined };
      }
      // "Ahmad Nasution" -> family = kata terakhir
      const parts = s.split(/\s+/);
      const family = parts.pop()!;
      return { family, given: parts.join(" ") || undefined };
    });
}

type CrossrefAuthor = { family?: string; given?: string };
type CrossrefWork = {
  message?: {
    title?: string[];
    author?: CrossrefAuthor[];
    "container-title"?: string[];
    volume?: string;
    issue?: string;
    page?: string;
    publisher?: string;
    DOI?: string;
    issued?: { "date-parts"?: number[][] };
    type?: string;
  };
};

// Pecah satu string nama ("Ahmad Nasution" ATAU "Nasution, Ahmad") jadi {family, given}.
function authorFromName(name?: string | null): Author | null {
  const s = (name ?? "").trim();
  if (!s) return null;
  if (s.includes(",")) {
    const [family, given] = s.split(",").map((p) => p.trim());
    return { family: family || s, given: given || undefined };
  }
  const parts = s.split(/\s+/);
  const family = parts.pop()!;
  return { family, given: parts.join(" ") || undefined };
}

function stripDoi(doi?: string | null): string | null {
  if (!doi) return null;
  return doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "") || null;
}

function joinPages(first?: string | null, last?: string | null): string | null {
  if (first && last) return `${first}-${last}`;
  return first || last || null;
}

// OpenAlex mengembalikan abstrak sebagai indeks terbalik {kata: [posisi...]}. Rekonstruksi jadi teks.
function abstractFromInverted(idx?: Record<string, number[]> | null, maxWords = 80): string | null {
  if (!idx || typeof idx !== "object") return null;
  const slots: string[] = [];
  for (const [word, positions] of Object.entries(idx)) {
    for (const p of positions) slots[p] = word;
  }
  const words = slots.filter(Boolean).slice(0, maxWords);
  if (words.length === 0) return null;
  const text = words.join(" ");
  return words.length >= maxWords ? `${text}…` : text;
}

/* ---------- Pencarian referensi (multi-sumber legal & gratis) ---------- */
// Prinsip: metadata terverifikasi dari sumber LEGAL & gratis. TAK PERNAH mengarang.
//  - OpenAlex   : cakupan sangat luas (250jt karya) + flag OA + tipe (termasuk disertasi).
//  - DOAJ       : jurnal open-access murni (semua hasil OA).
//  - Crossref   : pelengkap DOI (jurnal/prosiding/buku).
//  - Semantic Scholar : 200jt+ makalah, abstrak bagus, PDF open-access (opsional API key).
//  - arXiv      : preprint (CS/matematika/fisika), selalu gratis.
//  - OpenLibrary: BUKU (judul/ISBN/penulis).
//  - CORE       : agregator open-access + REPOSITORI KAMPUS (skripsi/tesis/tugas akhir) - butuh key gratis.

export type SearchProvider =
  | "openalex"
  | "doaj"
  | "crossref"
  | "semanticscholar"
  | "arxiv"
  | "openlibrary"
  | "core";

export type ReferenceCandidate = CitationFields & {
  provider: SearchProvider;
  openAccess: boolean;
  oaUrl?: string | null;
  landingUrl?: string | null;
  abstract?: string | null;
};

const CONTACT = "thesis.maubisa.id (mailto:halo@maubisa.id)";

type OaWork = {
  id?: string;
  title?: string | null;
  display_name?: string | null;
  publication_year?: number | null;
  doi?: string | null;
  type?: string | null;
  authorships?: { author?: { display_name?: string | null } | null }[];
  primary_location?: {
    source?: { display_name?: string | null } | null;
    landing_page_url?: string | null;
  } | null;
  open_access?: { is_oa?: boolean | null; oa_url?: string | null } | null;
  biblio?: { volume?: string | null; issue?: string | null; first_page?: string | null; last_page?: string | null } | null;
  abstract_inverted_index?: Record<string, number[]> | null;
};

// Cari via OpenAlex (gratis, tanpa kunci). openAccessOnly menambahkan filter is_oa:true.
export async function searchOpenAlex(query: string, openAccessOnly = false): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({ search: q, per_page: "8", mailto: "halo@maubisa.id" });
  if (openAccessOnly) params.set("filter", "open_access.is_oa:true");
  try {
    const res = await fetch(`https://api.openalex.org/works?${params.toString()}`, {
      headers: { "User-Agent": CONTACT },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: OaWork[] };
    return (json.results ?? [])
      .map((w): ReferenceCandidate | null => {
        const title = (w.title ?? w.display_name ?? "").trim();
        if (!title) return null;
        const authors = (w.authorships ?? [])
          .map((a) => authorFromName(a.author?.display_name))
          .filter((a): a is Author => Boolean(a));
        return {
          provider: "openalex",
          type: w.type ?? "article",
          title,
          authors,
          year: w.publication_year ?? null,
          doi: stripDoi(w.doi),
          container: w.primary_location?.source?.display_name ?? null,
          volume: w.biblio?.volume ?? null,
          issue: w.biblio?.issue ?? null,
          pages: joinPages(w.biblio?.first_page, w.biblio?.last_page),
          openAccess: Boolean(w.open_access?.is_oa),
          oaUrl: w.open_access?.oa_url ?? null,
          landingUrl: w.primary_location?.landing_page_url ?? null,
          abstract: abstractFromInverted(w.abstract_inverted_index),
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

type DoajArticle = {
  bibjson?: {
    title?: string;
    author?: { name?: string }[];
    year?: string;
    journal?: { title?: string; volume?: string; number?: string; publisher?: string };
    identifier?: { type?: string; id?: string }[];
    link?: { type?: string; url?: string }[];
    abstract?: string;
    start_page?: string;
    end_page?: string;
  };
};

// Cari via DOAJ (Directory of Open Access Journals). Semua hasil = jurnal open-access murni.
export async function searchDoaj(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  try {
    const res = await fetch(
      `https://doaj.org/api/v2/search/articles/${encodeURIComponent(q)}?pageSize=6`,
      { headers: { "User-Agent": CONTACT }, signal: AbortSignal.timeout(7000), cache: "no-store" },
    );
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: DoajArticle[] };
    return (json.results ?? [])
      .map((r): ReferenceCandidate | null => {
        const b = r.bibjson;
        const title = (b?.title ?? "").trim();
        if (!b || !title) return null;
        const doiId = b.identifier?.find((i) => (i.type ?? "").toLowerCase() === "doi")?.id;
        const fulltext = b.link?.find((l) => (l.type ?? "").toLowerCase() === "fulltext")?.url;
        const authors = (b.author ?? [])
          .map((a) => authorFromName(a.name))
          .filter((a): a is Author => Boolean(a));
        return {
          provider: "doaj",
          type: "article",
          title,
          authors,
          year: b.year ? Number.parseInt(b.year, 10) || null : null,
          doi: stripDoi(doiId),
          container: b.journal?.title ?? null,
          volume: b.journal?.volume ?? null,
          issue: b.journal?.number ?? null,
          pages: joinPages(b.start_page, b.end_page),
          publisher: b.journal?.publisher ?? null,
          openAccess: true,
          oaUrl: fulltext ?? null,
          landingUrl: fulltext ?? null,
          abstract: b.abstract ? b.abstract.slice(0, 600) : null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

type CrossrefItem = {
  title?: string[];
  author?: CrossrefAuthor[];
  "container-title"?: string[];
  volume?: string;
  issue?: string;
  page?: string;
  publisher?: string;
  DOI?: string;
  issued?: { "date-parts"?: number[][] };
  type?: string;
};

// Cari via Crossref (pelengkap; status OA tak selalu tersedia → openAccess=false).
export async function searchCrossref(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    query: q,
    rows: "5",
    select: "title,author,issued,container-title,DOI,volume,issue,page,publisher,type",
  });
  try {
    const res = await fetch(`https://api.crossref.org/works?${params.toString()}`, {
      headers: { "User-Agent": CONTACT },
      signal: AbortSignal.timeout(7000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { message?: { items?: CrossrefItem[] } };
    return (json.message?.items ?? [])
      .map((m): ReferenceCandidate | null => {
        const title = m.title?.[0]?.trim();
        if (!title) return null;
        return {
          provider: "crossref",
          type: m.type ?? "article",
          title,
          authors: (m.author ?? [])
            .filter((a) => a.family)
            .map((a) => ({ family: a.family!, given: a.given })),
          year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
          doi: stripDoi(m.DOI),
          container: m["container-title"]?.[0] ?? null,
          volume: m.volume ?? null,
          issue: m.issue ?? null,
          pages: m.page ?? null,
          publisher: m.publisher ?? null,
          openAccess: false,
          oaUrl: null,
          landingUrl: m.DOI ? `https://doi.org/${m.DOI}` : null,
          abstract: null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

function dedupeKey(c: ReferenceCandidate): string {
  if (c.doi) return `doi:${c.doi.toLowerCase()}`;
  return `t:${c.title.toLowerCase().replace(/\s+/g, " ").trim()}`;
}

type S2Paper = {
  title?: string | null;
  year?: number | null;
  venue?: string | null;
  abstract?: string | null;
  authors?: { name?: string | null }[];
  externalIds?: { DOI?: string | null } | null;
  openAccessPdf?: { url?: string | null } | null;
  publicationTypes?: string[] | null;
  url?: string | null;
};

// Semantic Scholar Graph API. Keyless boleh (rentan 429) → sisipkan header key bila SEMANTIC_SCHOLAR_KEY ada.
export async function searchSemanticScholar(query: string, openAccessOnly = false): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const fields = "title,year,authors,venue,externalIds,openAccessPdf,abstract,publicationTypes,url";
  const url = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=6&fields=${fields}`;
  const headers: Record<string, string> = { "User-Agent": CONTACT };
  if (process.env.SEMANTIC_SCHOLAR_KEY) headers["x-api-key"] = process.env.SEMANTIC_SCHOLAR_KEY;
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return []; // termasuk 429 tanpa key → diam-diam dilewati
    const json = (await res.json()) as { data?: S2Paper[] };
    return (json.data ?? [])
      .map((p): ReferenceCandidate | null => {
        const title = (p.title ?? "").trim();
        if (!title) return null;
        const oaUrl = p.openAccessPdf?.url ?? null;
        const isOa = Boolean(oaUrl);
        if (openAccessOnly && !isOa) return null;
        return {
          provider: "semanticscholar",
          type: (p.publicationTypes ?? []).map((t) => t.toLowerCase()).includes("book") ? "book" : "article",
          title,
          authors: (p.authors ?? []).map((a) => authorFromName(a.name)).filter((a): a is Author => Boolean(a)),
          year: p.year ?? null,
          doi: stripDoi(p.externalIds?.DOI),
          container: p.venue ?? null,
          openAccess: isOa,
          oaUrl,
          landingUrl: p.url ?? null,
          abstract: p.abstract ? p.abstract.slice(0, 600) : null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

function xmlTag(block: string, tag: string): string | null {
  const m = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`));
  return m ? m[1]!.replace(/\s+/g, " ").trim() : null;
}

// arXiv API (Atom XML). Preprint gratis; selalu open-access. Parse ringan tanpa dependensi.
export async function searchArxiv(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `http://export.arxiv.org/api/query?search_query=${encodeURIComponent("all:" + q)}&start=0&max_results=5`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": CONTACT }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return [];
    const xml = await res.text();
    const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? [];
    return entries
      .map((e): ReferenceCandidate | null => {
        const title = xmlTag(e, "title");
        if (!title) return null;
        const absId = xmlTag(e, "id"); // http://arxiv.org/abs/XXXX
        const published = xmlTag(e, "published");
        const year = published ? Number.parseInt(published.slice(0, 4), 10) || null : null;
        const doi = xmlTag(e, "arxiv:doi");
        const names = (e.match(/<name>([\s\S]*?)<\/name>/g) ?? []).map((s) => s.replace(/<\/?name>/g, "").trim());
        const pdf = absId ? absId.replace("/abs/", "/pdf/") : null;
        return {
          provider: "arxiv",
          type: "article",
          title,
          authors: names.map((n) => authorFromName(n)).filter((a): a is Author => Boolean(a)),
          year,
          doi: stripDoi(doi),
          container: "arXiv preprint",
          openAccess: true,
          oaUrl: pdf,
          landingUrl: absId,
          abstract: (xmlTag(e, "summary") ?? "").slice(0, 600) || null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

type OlDoc = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  isbn?: string[];
  key?: string;
  publisher?: string[];
};

// OpenLibrary - pencarian BUKU (metadata). Tanpa kunci. openAccess=false (metadata, bukan teks penuh).
export async function searchOpenLibrary(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(q)}&limit=5&fields=title,author_name,first_publish_year,isbn,key,publisher`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": CONTACT }, signal: AbortSignal.timeout(8000), cache: "no-store" });
    if (!res.ok) return [];
    const json = (await res.json()) as { docs?: OlDoc[] };
    return (json.docs ?? [])
      .map((d): ReferenceCandidate | null => {
        const title = (d.title ?? "").trim();
        if (!title) return null;
        return {
          provider: "openlibrary",
          type: "book",
          title,
          authors: (d.author_name ?? []).map((n) => authorFromName(n)).filter((a): a is Author => Boolean(a)),
          year: d.first_publish_year ?? null,
          doi: null,
          publisher: d.publisher?.[0] ?? null,
          container: d.isbn?.[0] ? `ISBN ${d.isbn[0]}` : null,
          openAccess: false,
          oaUrl: null,
          landingUrl: d.key ? `https://openlibrary.org${d.key}` : null,
          abstract: null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

type CoreWork = {
  title?: string | null;
  authors?: { name?: string | null }[] | null;
  yearPublished?: number | null;
  publishedDate?: string | null;
  doi?: string | null;
  downloadUrl?: string | null;
  publisher?: string | null;
  abstract?: string | null;
  documentType?: string | null;
};

// CORE - agregator open-access + repositori kampus (kuat untuk SKRIPSI/TESIS/tugas akhir).
// Butuh API key gratis (core.ac.uk/services/api). Kosong -> dilewati (fitur lain tetap jalan).
export async function searchCore(query: string): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  const key = process.env.CORE_API_KEY;
  if (q.length < 3 || !key) return [];
  try {
    const res = await fetch("https://api.core.ac.uk/v3/search/works", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "content-type": "application/json", "User-Agent": CONTACT },
      body: JSON.stringify({ q, limit: 6 }),
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { results?: CoreWork[] };
    return (json.results ?? [])
      .map((w): ReferenceCandidate | null => {
        const title = (w.title ?? "").trim();
        if (!title) return null;
        const dt = (w.documentType ?? "").toLowerCase();
        const type = dt.includes("thesis") || dt.includes("dissertation") ? "thesis" : dt.includes("book") ? "book" : "article";
        const year = w.yearPublished ?? (w.publishedDate ? Number.parseInt(w.publishedDate.slice(0, 4), 10) || null : null);
        return {
          provider: "core",
          type,
          title,
          authors: (w.authors ?? []).map((a) => authorFromName(a?.name)).filter((a): a is Author => Boolean(a)),
          year,
          doi: stripDoi(w.doi),
          publisher: w.publisher ?? null,
          container: w.publisher ?? null,
          openAccess: true,
          oaUrl: w.downloadUrl ?? null,
          landingUrl: w.downloadUrl ?? null,
          abstract: w.abstract ? w.abstract.slice(0, 600) : null,
        };
      })
      .filter((c): c is ReferenceCandidate => Boolean(c));
  } catch {
    return [];
  }
}

// Gabungan pencarian lintas sumber legal & gratis. Dedupe by DOI/judul, prioritas open-access.
// Graceful: tiap provider yang gagal/timeout diabaikan (Promise.allSettled). openAccessOnly menyaring
// ke hasil OA saja (buku OpenLibrary & Crossref non-OA otomatis tersaring).
export async function searchReferences(
  query: string,
  openAccessOnly = false,
): Promise<ReferenceCandidate[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const tasks: Promise<ReferenceCandidate[]>[] = [
    searchOpenAlex(q, openAccessOnly),
    searchDoaj(q),
    searchSemanticScholar(q, openAccessOnly),
    searchArxiv(q),
    searchCore(q), // env-gated: aktif hanya bila CORE_API_KEY diset
  ];
  if (!openAccessOnly) {
    tasks.push(searchCrossref(q));
    tasks.push(searchOpenLibrary(q)); // buku = metadata (non-OA), hanya saat tak difilter OA
  }
  const settled = await Promise.allSettled(tasks);
  const all: ReferenceCandidate[] = [];
  for (const s of settled) if (s.status === "fulfilled") all.push(...s.value);

  const seen = new Map<string, ReferenceCandidate>();
  for (const c of all) {
    const key = dedupeKey(c);
    const prev = seen.get(key);
    // Simpan varian OA / yang punya oaUrl bila ada duplikat.
    if (!prev || (!prev.openAccess && c.openAccess) || (!prev.oaUrl && c.oaUrl)) seen.set(key, c);
  }
  const merged = [...seen.values()].filter((c) => (openAccessOnly ? c.openAccess : true));
  merged.sort((a, b) => Number(b.openAccess) - Number(a.openAccess) || (b.year ?? 0) - (a.year ?? 0));
  return merged.slice(0, 16);
}

/* ---------- Import BibTeX / RIS ---------- */

const BIBTEX_TYPE_MAP: Record<string, string> = {
  article: "article",
  book: "book",
  inbook: "chapter",
  incollection: "chapter",
  inproceedings: "proceedings",
  conference: "proceedings",
  phdthesis: "thesis",
  mastersthesis: "thesis",
  misc: "other",
  online: "web",
};

function bibtexFields(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  let i = 0;
  while (i < body.length) {
    const eq = body.indexOf("=", i);
    if (eq === -1) break;
    const key = body.slice(i, eq).replace(/[,{}\s]/g, "").toLowerCase();
    let j = eq + 1;
    while (j < body.length && /\s/.test(body[j]!)) j++;
    let value = "";
    if (body[j] === "{") {
      let depth = 0;
      for (; j < body.length; j++) {
        const ch = body[j]!;
        if (ch === "{") depth++;
        else if (ch === "}") {
          depth--;
          if (depth === 0) { j++; break; }
          continue;
        }
        if (depth >= 1 && !(ch === "{" && depth === 1)) value += ch;
      }
    } else if (body[j] === '"') {
      j++;
      for (; j < body.length && body[j] !== '"'; j++) value += body[j];
      j++;
    } else {
      for (; j < body.length && body[j] !== "," && body[j] !== "\n"; j++) value += body[j];
    }
    if (key) out[key] = value.replace(/\s+/g, " ").trim();
    const comma = body.indexOf(",", j);
    i = comma === -1 ? body.length : comma + 1;
  }
  return out;
}

// Parse satu atau banyak entri BibTeX menjadi CitationFields. Toleran, pure.
export function parseBibtex(text: string): CitationFields[] {
  const out: CitationFields[] = [];
  const entries = text.split(/(?=@\w+\s*\{)/g).map((s) => s.trim()).filter((s) => s.startsWith("@"));
  for (const entry of entries) {
    const head = /^@(\w+)\s*\{[^,]*,/.exec(entry);
    if (!head) continue;
    const rawType = head[1]!.toLowerCase();
    const body = entry.slice(head[0].length, entry.lastIndexOf("}"));
    const f = bibtexFields(body);
    const title = (f.title ?? "").replace(/[{}]/g, "").trim();
    if (!title) continue;
    const authors = f.author
      ? f.author.split(/\s+and\s+/i).map((n) => authorFromName(n)).filter((a): a is Author => Boolean(a))
      : [];
    out.push({
      type: BIBTEX_TYPE_MAP[rawType] ?? "other",
      title,
      authors,
      year: f.year ? Number.parseInt(f.year, 10) || null : null,
      doi: stripDoi(f.doi),
      container: f.journal || f.booktitle || null,
      volume: f.volume || null,
      issue: f.number || null,
      pages: f.pages ? f.pages.replace(/--/g, "-") : null,
      publisher: f.publisher || null,
    });
  }
  return out;
}

const RIS_TYPE_MAP: Record<string, string> = {
  JOUR: "article",
  BOOK: "book",
  CHAP: "chapter",
  CONF: "proceedings",
  THES: "thesis",
  ELEC: "web",
};

// Parse RIS (tag  - value). Multi-entri dipisah oleh "ER  -". Pure.
export function parseRis(text: string): CitationFields[] {
  const out: CitationFields[] = [];
  const blocks = text.split(/^ER\s{2}-.*$/im);
  for (const block of blocks) {
    const lines = block.split(/\r?\n/);
    const authors: Author[] = [];
    const map: Record<string, string> = {};
    let type = "";
    let firstPage = "";
    let lastPage = "";
    for (const line of lines) {
      const m = /^([A-Z0-9]{2})\s{2}-\s?(.*)$/.exec(line.trim());
      if (!m) continue;
      const tag = m[1]!;
      const val = m[2]!.trim();
      if (!val) continue;
      if (tag === "TY") type = val;
      else if (tag === "AU" || tag === "A1") { const a = authorFromName(val); if (a) authors.push(a); }
      else if (tag === "SP") firstPage = val;
      else if (tag === "EP") lastPage = val;
      else map[tag] = val;
    }
    const title = map.TI || map.T1 || "";
    if (!title) continue;
    out.push({
      type: RIS_TYPE_MAP[type] ?? "other",
      title,
      authors,
      year: (map.PY || map.Y1 || "").match(/\d{4}/) ? Number.parseInt((map.PY || map.Y1)!, 10) || null : null,
      doi: stripDoi(map.DO),
      container: map.JO || map.JF || map.T2 || null,
      volume: map.VL || null,
      issue: map.IS || null,
      pages: joinPages(firstPage, lastPage),
      publisher: map.PB || null,
    });
  }
  return out;
}

// Deteksi format lalu route ke parser yang sesuai.
export function parseReferenceImport(text: string): CitationFields[] {
  const t = text.trim();
  if (!t) return [];
  if (/@\w+\s*\{/.test(t)) return parseBibtex(t);
  if (/^[A-Z0-9]{2}\s{2}-/m.test(t)) return parseRis(t);
  return [];
}

// Impor metadata dari DOI via Crossref (gratis, tanpa PII). Graceful: kembalikan null bila
// jaringan tak tersedia / DOI tak ditemukan (dev lokal offline → user isi manual).
export async function importFromDoi(doi: string): Promise<CitationFields | null> {
  const clean = doi.trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  if (!clean) return null;
  try {
    const res = await fetch(`https://api.crossref.org/works/${encodeURIComponent(clean)}`, {
      headers: { "User-Agent": "thesis.maubisa.id (mailto:halo@maubisa.id)" },
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as CrossrefWork;
    const m = json.message;
    if (!m?.title?.[0]) return null;
    return {
      type: m.type ?? "article",
      title: m.title[0],
      authors: (m.author ?? [])
        .filter((a) => a.family)
        .map((a) => ({ family: a.family!, given: a.given })),
      year: m.issued?.["date-parts"]?.[0]?.[0] ?? null,
      doi: m.DOI ?? clean,
      container: m["container-title"]?.[0] ?? null,
      volume: m.volume ?? null,
      issue: m.issue ?? null,
      pages: m.page ?? null,
      publisher: m.publisher ?? null,
    };
  } catch {
    return null;
  }
}
