// Pembuat ICS (RFC 5545) native - nol dependency. Dipakai feed langganan kalender jadwal sesi.
export type IcsEvent = {
  uid: string;
  start: Date;
  end: Date;
  title: string;
  description?: string;
  url?: string;
};

// Escape nilai TEXT ICS: backslash, titik koma, koma, dan baris baru (RFC 5545 3.3.11).
function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/([;,])/g, "\\$1").replace(/\r?\n/g, "\\n");
}

// Waktu UTC bentuk YYYYMMDDTHHMMSSZ.
function stamp(d: Date): string {
  return d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
}

export function buildCalendar(name: string, events: IcsEvent[]): string {
  const now = stamp(new Date());
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Thesisdesk//Jadwal//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(name)}`,
  ];
  for (const e of events) {
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.uid}`,
      `DTSTAMP:${now}`,
      `DTSTART:${stamp(e.start)}`,
      `DTEND:${stamp(e.end)}`,
      `SUMMARY:${esc(e.title)}`,
    );
    if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
    if (e.url) lines.push(`URL:${esc(e.url)}`);
    lines.push("STATUS:CONFIRMED", "END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  // ICS wajib CRLF antar-baris.
  // ponytail: skip line-folding >75 oktet; ringkasan sesi pendek. Tambah folding bila parser ketat menolak.
  return lines.join("\r\n") + "\r\n";
}
