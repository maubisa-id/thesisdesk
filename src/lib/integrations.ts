import "server-only";

// Titik-baca terpusat untuk integrasi warisan thesis.maubisa.id (Laravel) yang dibawa ke stack
// baru: Google Calendar/Meet, object storage GCS (S3-compatible), dan Redis (Coolify). Semua
// OPSIONAL: bila env kosong, `configured=false` dan fitur jatuh ke fallback lokal (upload ke
// public/uploads, gmeet_link manual, tanpa cache Redis) sehingga dev lokal tetap nol-setup.
// Rahasia HANYA dari process.env (secret Coolify / .env lokal), tidak pernah di-hardcode.

function env(key: string): string | undefined {
  const v = process.env[key];
  return v && v.trim() ? v.trim() : undefined;
}

// ── Google Calendar + Meet (auto-GMeet saat sesi disetujui) ──
// Mekanisme SAMA seperti Laravel lama (Schedule::createGoogleMeet): OAuth sebagai akun
// sistem@maubisa.id. Di Laravel token disimpan di storage/app/google-calendar/token.json;
// di sini refresh_token-nya dipindah ke env GOOGLE_CALENDAR_REFRESH_TOKEN (durable, tak perlu
// re-auth). client_id/secret = kredensial OAuth yang sama dari oauth-credentials.json.
export const calendar = {
  calendarId: env("GOOGLE_CALENDAR_ID"),
  clientId: env("GOOGLE_CLIENT_ID"),
  clientSecret: env("GOOGLE_CLIENT_SECRET"),
  refreshToken: env("GOOGLE_CALENDAR_REFRESH_TOKEN"),
  timezone: env("TZ") ?? "Asia/Jakarta",
  get configured(): boolean {
    return Boolean(this.calendarId && this.clientId && this.clientSecret && this.refreshToken);
  },
} as const;

// ── Object storage dokumen (GCS via S3-compatible) ──
export const storage = {
  bucket: env("GCS_BUCKET"),
  projectId: env("GCS_PROJECT_ID"),
  endpoint: env("S3_ENDPOINT") ?? "https://storage.googleapis.com",
  accessKeyId: env("S3_ACCESS_KEY_ID"),
  secretAccessKey: env("S3_SECRET_ACCESS_KEY"),
  region: env("S3_REGION") ?? "auto",
  get configured(): boolean {
    return Boolean(this.bucket && this.accessKeyId && this.secretAccessKey);
  },
} as const;

// ── Redis (cache entitlement + antrian) ──
export const redis = {
  url: env("REDIS_URL"),
  get configured(): boolean {
    return Boolean(this.url);
  },
} as const;
