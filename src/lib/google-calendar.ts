import "server-only";
import { calendar } from "@/lib/integrations";

// Mesin GMeet: port 1:1 dari Laravel Schedule::createGoogleMeet / deleteGoogleMeet.
// Autentikasi sebagai akun sistem@maubisa.id (OAuth refresh token), buat event Google Calendar
// dengan conferenceData(hangoutsMeet) -> hangoutLink NYATA + eventId. Panggilan REST langsung
// (tanpa dependency googleapis). Semua best-effort: kalau belum dikonfigurasi / gagal -> return
// null, JANGAN melempar ke alur approve (mirror try/catch Laravel: approve tetap jalan, link nyusul).

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CAL_BASE = "https://www.googleapis.com/calendar/v3/calendars";

export type MeetResult = { meetLink: string; eventId: string };

function rfc3339(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

// Tukar refresh_token -> access_token (grant refresh_token, sama seperti fetchAccessTokenWithRefreshToken).
async function getAccessToken(): Promise<string | null> {
  if (!calendar.configured) return null;
  try {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: calendar.clientId!,
        client_secret: calendar.clientSecret!,
        refresh_token: calendar.refreshToken!,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) {
      console.error("[gcal] gagal refresh access token:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const json = (await res.json()) as { access_token?: string };
    return json.access_token ?? null;
  } catch (e) {
    console.error("[gcal] error ambil access token:", (e as Error).message);
    return null;
  }
}

// Buat event Calendar + Google Meet. Return {meetLink, eventId} atau null (best-effort).
export async function createGoogleMeet(input: {
  topic: string;
  scheduledAt: Date;
  tutorEmail?: string | null;
  klienEmail?: string | null;
}): Promise<MeetResult | null> {
  const token = await getAccessToken();
  if (!token) return null;
  try {
    const start = input.scheduledAt;
    const end = new Date(start.getTime() + 60 * 60_000); // durasi 1 jam (sama seperti addHour())
    const attendees = [input.tutorEmail, input.klienEmail]
      .filter((e): e is string => Boolean(e))
      .map((email) => ({ email }));

    const body = {
      summary: `Bimbingan Maubisa: ${input.topic}`,
      description: "Sesi bimbingan otomatis by Sistem.",
      start: { dateTime: rfc3339(start), timeZone: calendar.timezone },
      end: { dateTime: rfc3339(end), timeZone: calendar.timezone },
      attendees,
      conferenceData: {
        createRequest: {
          requestId: `meet_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
    };

    const url = `${CAL_BASE}/${encodeURIComponent(calendar.calendarId!)}/events?conferenceDataVersion=1`;
    const res = await fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      console.error("[gcal] gagal insert event:", res.status, (await res.text()).slice(0, 200));
      return null;
    }
    const ev = (await res.json()) as { id?: string; hangoutLink?: string };
    if (!ev.hangoutLink || !ev.id) {
      console.error("[gcal] event dibuat tapi tanpa hangoutLink/id.");
      return null;
    }
    return { meetLink: ev.hangoutLink, eventId: ev.id };
  } catch (e) {
    console.error("[gcal] error buat GMeet:", (e as Error).message);
    return null;
  }
}

// Amankan ruang saat sesi selesai (mirror deleteGoogleMeet): tandai [SELESAI], keluarkan tamu,
// akhiri sekarang. Conference (link) sengaja DIBIARKAN agar nama video tetap rapi. Best-effort.
export async function endGoogleMeet(eventId: string): Promise<boolean> {
  const token = await getAccessToken();
  if (!token || !eventId) return false;
  try {
    const base = `${CAL_BASE}/${encodeURIComponent(calendar.calendarId!)}/events/${encodeURIComponent(eventId)}`;
    const getRes = await fetch(base, { headers: { authorization: `Bearer ${token}` } });
    if (!getRes.ok) return false;
    const ev = (await getRes.json()) as { summary?: string };
    const summary = ev.summary ?? "";
    const patch = {
      summary: summary.includes("[SELESAI]") ? summary : `[SELESAI] ${summary}`,
      attendees: [] as { email: string }[],
      end: { dateTime: rfc3339(new Date()), timeZone: calendar.timezone },
    };
    const patchRes = await fetch(base, {
      method: "PATCH",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(patch),
    });
    return patchRes.ok;
  } catch (e) {
    console.error("[gcal] error amankan GMeet:", (e as Error).message);
    return false;
  }
}
