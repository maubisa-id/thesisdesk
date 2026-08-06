import { describe, it, expect } from "vitest";
import { buildCalendar } from "@/lib/ics";

describe("buildCalendar (ICS RFC 5545)", () => {
  const ics = buildCalendar("Jadwal - Budi", [
    {
      uid: "sesi-1@thesisdesk",
      start: new Date("2026-08-10T03:00:00.000Z"),
      end: new Date("2026-08-10T04:00:00.000Z"),
      title: "Bimbingan: BAB 3; metode",
      description: "Meet: https://x",
      url: "https://x",
    },
  ]);

  it("punya pembungkus VCALENDAR + VERSION", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("VERSION:2.0");
  });

  it("DTSTART/DTEND dalam UTC format benar", () => {
    expect(ics).toContain("DTSTART:20260810T030000Z");
    expect(ics).toContain("DTEND:20260810T040000Z");
  });

  it("meng-escape karakter khusus (titik koma)", () => {
    expect(ics).toContain("SUMMARY:Bimbingan: BAB 3\\; metode");
  });

  it("memakai CRLF antar-baris", () => {
    expect(ics).toContain("\r\n");
  });
});
