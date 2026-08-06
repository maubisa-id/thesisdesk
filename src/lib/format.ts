// Format lokal Indonesia (WIB) + peta label domain kampus (bukan jargon teknis, H2).

const TZ = "Asia/Jakarta";

// Baca waktu sekarang lewat wrapper (server components: hindari pemanggilan Date.now langsung
// di badan komponen yang dilarang aturan react-hooks/purity).
export function nowMs(): number {
  return Date.now();
}

export function tanggal(d?: Date | string | null): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function tanggalPanjang(d?: Date | string | null): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  }).format(date);
}

export function waktu(d?: Date | string | null): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  }).format(date);
}

export function tanggalWaktu(d?: Date | string | null): string {
  if (!d) return "-";
  return `${tanggal(d)} · ${waktu(d)} WIB`;
}

// Bagian tanggal untuk rail timeline (tanggal, bulan singkat, jam).
export function tanggalRail(d?: Date | string | null): { day: string; month: string; time: string } {
  if (!d) return { day: "-", month: "", time: "" };
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return { day: "-", month: "", time: "" };
  const day = new Intl.DateTimeFormat("id-ID", { day: "numeric", timeZone: TZ }).format(date);
  const month = new Intl.DateTimeFormat("id-ID", { month: "short", timeZone: TZ }).format(date);
  return { day, month, time: waktu(date) };
}

// Selisih hari dari sekarang (positif = akan datang, negatif = lewat).
export function sisaHari(d?: Date | string | null): number | null {
  if (!d) return null;
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return null;
  const ms = date.getTime() - Date.now();
  return Math.ceil(ms / 86_400_000);
}

export function waktuRelatif(d?: Date | string | null): string {
  if (!d) return "-";
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "-";
  const diff = date.getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("id-ID", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["year", 31_536_000_000],
    ["month", 2_592_000_000],
    ["day", 86_400_000],
    ["hour", 3_600_000],
    ["minute", 60_000],
  ];
  for (const [unit, unitMs] of units) {
    if (abs >= unitMs || unit === "minute") {
      return rtf.format(Math.round(diff / unitMs), unit);
    }
  }
  return "baru saja";
}

export function inisial(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// Presence "online" (paritas isOnline Laravel lama: aktif < 5 menit terakhir).
export function isOnline(lastSeenAt: Date | string | null | undefined, now = Date.now()): boolean {
  if (!lastSeenAt) return false;
  const at = lastSeenAt instanceof Date ? lastSeenAt : new Date(lastSeenAt);
  if (Number.isNaN(at.getTime())) return false;
  return now - at.getTime() < 5 * 60_000;
}

export function presenceLabel(lastSeenAt: Date | string | null | undefined): string {
  if (isOnline(lastSeenAt)) return "Online";
  if (!lastSeenAt) return "Tidak sedang aktif";
  return `Aktif ${waktuRelatif(lastSeenAt)}`;
}

// Salam menurut jam WIB untuk kehangatan sapaan dashboard.
export function salamWaktu(now = Date.now()): string {
  const jam = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }).format(new Date(now)),
  );
  if (jam >= 4 && jam < 11) return "Selamat pagi";
  if (jam >= 11 && jam < 15) return "Selamat siang";
  if (jam >= 15 && jam < 18) return "Selamat sore";
  return "Selamat malam";
}

export function persen(n: number): string {
  return `${Math.round(n)}%`;
}

// ── Peta label domain (H2: bahasa natural, istilah kampus) ──

export const CHAPTER_LABEL: Record<string, string> = {
  proposal: "Proposal",
  bab1: "BAB I · Pendahuluan",
  bab2: "BAB II · Tinjauan Pustaka",
  bab3: "BAB III · Metodologi",
  bab4: "BAB IV · Hasil & Pembahasan",
  bab5: "BAB V · Penutup",
  revisi: "Revisi",
  sidang: "Sidang",
  other: "Lainnya",
};

export const CHAPTER_SHORT: Record<string, string> = {
  proposal: "Proposal",
  bab1: "BAB I",
  bab2: "BAB II",
  bab3: "BAB III",
  bab4: "BAB IV",
  bab5: "BAB V",
  revisi: "Revisi",
  sidang: "Sidang",
  other: "Lainnya",
};

export const MILESTONE_STATUS_LABEL: Record<string, string> = {
  todo: "Belum mulai",
  in_progress: "Dikerjakan",
  review: "Direview",
  done: "Selesai",
  blocked: "Terhambat",
};

export const SCHEDULE_STATUS_LABEL: Record<string, string> = {
  pending: "Menunggu tutor",
  approved: "Disetujui",
  menunggu_klien: "Menunggu kamu",
  selesai: "Selesai",
  rejected: "Ditolak",
};

// Gerbang waktu tautan Google Meet (paritas Laravel lama): tautan aktif mulai 15 menit
// sebelum jadwal sampai 90 menit setelahnya. Di luar jendela itu tombol dinonaktifkan.
export type MeetJoinState = "too_early" | "open" | "closed";

export function meetJoinState(scheduledAt: Date | string | null | undefined, now = Date.now()): MeetJoinState {
  if (!scheduledAt) return "too_early";
  const at = scheduledAt instanceof Date ? scheduledAt : new Date(scheduledAt);
  if (Number.isNaN(at.getTime())) return "too_early";
  const opens = at.getTime() - 15 * 60_000;
  const closes = at.getTime() + 90 * 60_000;
  if (now < opens) return "too_early";
  if (now > closes) return "closed";
  return "open";
}

export const MEET_JOIN_LABEL: Record<MeetJoinState, string> = {
  too_early: "Belum waktunya",
  open: "Gabung Google Meet",
  closed: "Waktu sesi berakhir",
};

// Status rekaman GMeet pada sesi selesai (paritas FetchRecordingsCommand Laravel lama):
// - URL http(s)  -> rekaman siap ditonton
// - "tidak_ada"  -> divonis hangus (tutor lupa rekam / lewat 2 jam)
// - kosong/null  -> masih diproses (cron belum menarik lampiran dari kalender)
export type RecordingState = "ready" | "unavailable" | "processing";

export function recordingState(link: string | null | undefined): RecordingState {
  if (!link) return "processing";
  if (link === "tidak_ada") return "unavailable";
  if (/^https?:\/\//i.test(link)) return "ready";
  return "processing";
}

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  uploaded: "Menunggu review",
  in_review: "Sedang direview",
  reviewed: "Sudah direview",
};

export const AI_KIND_LABEL: Record<string, string> = {
  outline: "Kerangka BAB",
  eyd_check: "Perapian EYD",
  paraphrase: "Parafrase",
  abstract: "Abstrak",
  defense_questions: "Simulasi sidang",
  methodology: "Pemandu metodologi",
  lit_review: "Ringkas literatur",
  slides: "Draf slide",
  similarity_assist: "Saran turunkan similarity",
};

export const AI_STATUS_LABEL: Record<string, string> = {
  queued: "Antre",
  running: "Diproses",
  done: "Selesai",
  failed: "Gagal",
  cancelled: "Dibatalkan",
};

export function bytesHuman(n?: number | null): string {
  if (!n || n <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}
