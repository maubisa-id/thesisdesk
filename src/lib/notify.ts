// Klien notifikasi thesis -> HUB (akun.maubisa.id/api/notify). Kontrak: ADR-013 +
// directus-maubisa/docs/produk/integrasi-notifikasi.md.
//
// PRINSIP hub-and-spoke: thesis TIDAK punya SMTP. Untuk kirim email, thesis cukup POST 1 kali
// ke hub (ber-secret). Hub yang gate (preferensi/consent), dedupe, lalu kirim via Gmail.
// Fungsi ini NON-BLOCKING: kegagalan notify tidak boleh menjatuhkan aksi utama pemanggil.

export type NotifyCategory = "T" | "L" | "P"; // T=wajib · L=lifecycle(default-on) · P=promo(opt-in)

export type NotifyTo = { coreUserId: number } | { email: string };

export type NotifyInput = {
  template: string; // id template terpusat di hub, mis. "thesis.notifikasi"
  to: NotifyTo;
  category: NotifyCategory;
  data?: Record<string, unknown>;
  dedupeKey: string; // idempotensi -> email_log UNIQUE di hub
};

export type NotifyResult = {
  ok: boolean; // true bila hub menerima (queued/sent/skipped), false bila error jaringan/secret/payload
  status: number; // HTTP status hub (0 = tak terjangkau)
  skipped?: "opted_out" | "duplicate";
  error?: string;
};

// Template generik hub untuk notifikasi/pengingat domain thesis (judul + isi + 1 CTA).
// Hub memetakan id ini ke notificationEmail(). Reminder & notifikasi in-app memakai ini.
export const GENERIC_TEMPLATE = "thesis.notifikasi";

// Base URL hub. Prioritas NOTIFY_URL (server-to-server), fallback ke NEXT_PUBLIC_ACCOUNT_URL.
function hubBaseUrl(): string {
  return (
    process.env.NOTIFY_URL ||
    process.env.NEXT_PUBLIC_ACCOUNT_URL ||
    "https://akun.maubisa.id"
  ).replace(/\/+$/, "");
}

// Jadikan path relatif ("/jadwal") menjadi URL absolut agar bisa dipakai sebagai link di email.
// Basis = NEXT_PUBLIC_APP_URL (origin thesis). URL yang sudah absolut dibiarkan.
export function absoluteAppUrl(pathOrUrl?: string | null): string | undefined {
  if (!pathOrUrl) return undefined;
  if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const base = (process.env.NEXT_PUBLIC_APP_URL || "https://thesis.maubisa.id").replace(/\/+$/, "");
  return `${base}/${pathOrUrl.replace(/^\/+/, "")}`;
}

// Kirim satu notifikasi ke hub. Timeout pendek supaya tak menahan request/worker.
// Melempar HANYA bila dipanggil dengan throwOnError=true.
export async function notifyHub(
  input: NotifyInput,
  opts: { timeoutMs?: number; throwOnError?: boolean } = {},
): Promise<NotifyResult> {
  const secret = process.env.NOTIFY_SECRET;
  if (!secret) {
    const r: NotifyResult = { ok: false, status: 0, error: "NOTIFY_SECRET belum di-set" };
    if (opts.throwOnError) throw new Error(r.error);
    console.warn("[notify] NOTIFY_SECRET belum di-set - lewati kirim ke hub");
    return r;
  }

  try {
    const res = await fetch(`${hubBaseUrl()}/api/notify`, {
      method: "POST",
      headers: {
        "x-notify-secret": secret,
        "content-type": "application/json",
      },
      body: JSON.stringify(input),
      signal: AbortSignal.timeout(opts.timeoutMs ?? 4000),
      cache: "no-store",
    });

    // Hub balas 200 {skipped} untuk opt-out/duplicate (bukan error), 202 {queued}, 200 {sent}.
    let skipped: NotifyResult["skipped"];
    try {
      const body = (await res.json()) as { skipped?: string };
      if (body?.skipped === "opted_out" || body?.skipped === "duplicate") {
        skipped = body.skipped;
      }
    } catch {
      /* body kosong/non-JSON - abaikan */
    }

    const ok = res.ok; // 2xx
    const result: NotifyResult = { ok, status: res.status, skipped };
    if (!ok) {
      result.error = `hub balas ${res.status}`;
      if (opts.throwOnError) throw new Error(result.error);
    }
    return result;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    if (opts.throwOnError) throw e instanceof Error ? e : new Error(error);
    console.warn(`[notify] gagal kirim (${input.template}): ${error}`);
    return { ok: false, status: 0, error };
  }
}

// dedupeKey standar per domain thesis (konsisten tabel §4 doc integrasi).
export const dedupeKey = {
  reminder: (id: number | string) => `thesis:reminder:${id}`,
  notif: (id: number | string) => `thesis:notif:${id}`,
  message: (id: number | string) => `thesis:msg:${id}`,
  schedule: (id: number | string) => `thesis:jadwal:${id}`,
};

// ── Payload Reminder (disimpan di kolom Reminder.payload sebagai JSON) ──
// Bentuk generik yang SAMA dipakai reminder in-app (processDueReminders) maupun email (cron).
// Cron membaca ini lalu memetakannya ke hub - jadi cron generik, tak perlu tahu jenis reminder.
export type ReminderPayload = {
  title: string;
  body?: string;
  actionUrl?: string;
  template?: string; // opsional: override template hub (default GENERIC_TEMPLATE)
  category?: NotifyCategory; // opsional: default "L"
};

export function buildReminderPayload(p: ReminderPayload): string {
  return JSON.stringify(p);
}

// Parse payload Reminder dengan aman. null bila kosong/rusak (pemanggil menandai 'failed').
export function parseReminderPayload(raw: string | null | undefined): ReminderPayload | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Partial<ReminderPayload>;
    if (!p || typeof p.title !== "string" || !p.title) return null;
    const category: NotifyCategory =
      p.category === "T" || p.category === "P" ? p.category : "L";
    return {
      title: p.title,
      body: typeof p.body === "string" ? p.body : undefined,
      actionUrl: typeof p.actionUrl === "string" ? p.actionUrl : undefined,
      template: typeof p.template === "string" && p.template ? p.template : undefined,
      category,
    };
  } catch {
    return null;
  }
}

// Petakan payload generik -> NotifyInput hub (template generik + data judul/isi/CTA absolut).
export function reminderToNotify(
  id: number | string,
  to: NotifyTo,
  payload: ReminderPayload,
): NotifyInput {
  return {
    template: payload.template ?? GENERIC_TEMPLATE,
    to,
    category: payload.category ?? "L",
    data: {
      title: payload.title,
      body: payload.body ?? null,
      actionUrl: absoluteAppUrl(payload.actionUrl) ?? null,
    },
    dedupeKey: dedupeKey.reminder(id),
  };
}
