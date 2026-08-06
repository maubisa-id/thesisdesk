import "server-only";
import Redis from "ioredis";

// Klien Redis untuk CACHE + RATE-LIMIT (ADR-008). Redis di sini murni penyimpanan ephemeral:
// aman di-evict, tak perlu persistence/antrian. Ini menyederhanakan konfig (lihat runbook redis-config.md).
//
// ENV-GATED: kalau REDIS_URL kosong -> getRedis() = null, pemanggil pakai fallback (in-memory/DB) supaya
// dev lokal & lingkungan tanpa Redis tetap jalan.
//
// ENV:
//   REDIS_URL   redis://:PASSWORD@redis:6379   (service Redis Coolify, private)
//               DB opsional di akhir URL (mis. .../0). Default DB 0.

let client: Redis | null | undefined; // undefined = belum init; null = tak dikonfigurasi

function build(): Redis | null {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  try {
    const c = new Redis(url, {
      lazyConnect: false,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false, // gagal cepat kalau Redis down -> pemanggil fallback, bukan menggantung
      connectTimeout: 3000,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 200, 2000)),
    });
    c.on("error", (e) => {
      if (process.env.NODE_ENV !== "production") console.warn("[redis] ", e.message);
    });
    return c;
  } catch {
    return null;
  }
}

// Klien Redis bersama (cache + rate-limit). Null bila REDIS_URL kosong.
export function getRedis(): Redis | null {
  if (client === undefined) client = build();
  return client;
}

export function redisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL);
}

// Sliding-window rate limit atomik (INCR + EXPIRE). Kembalikan jumlah hit dalam jendela, atau null bila
// Redis tak tersedia (pemanggil fallback). Konsisten LINTAS instance (beda dari in-memory per-proses).
// Fail-open: error Redis -> null (pemanggil pakai fallback, tak pernah menggagalkan request).
export async function slidingHit(key: string, windowSec: number): Promise<number | null> {
  const r = getRedis();
  if (!r) return null;
  try {
    const n = await r.incr(key);
    if (n === 1) await r.expire(key, windowSec);
    return n;
  } catch {
    return null;
  }
}
