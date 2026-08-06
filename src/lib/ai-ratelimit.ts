import "server-only";
import { prisma } from "@/lib/prisma";
import { ForbiddenError } from "@/lib/rbac";
import { slidingHit, redisConfigured } from "@/lib/redis";

// Rate-limit pembuatan job AI per pengguna (best-practices-maubisa.md §C: "rate-limit login/AI/checkout").
// PRODUKSI multi-instance: Redis sliding-window (ADR-008) -> konsisten lintas instance. FALLBACK (Redis
// tak dikonfigurasi/naik-turun): hitung baris `ai_jobs` milik pengguna dalam jendela 60 detik + jarak
// minimum antar-permintaan. Kontrak `assertAiRateLimit(ownerId)` tetap sama.

const WINDOW_MS = 60_000;
const WINDOW_SEC = 60;
const MAX_PER_WINDOW = 12; // ~1 permintaan tiap 5 detik
const MIN_INTERVAL_MS = 2_500; // jeda minimum antar-permintaan (fallback DB)

export async function assertAiRateLimit(ownerId: number): Promise<void> {
  // Jalur cepat: Redis (atomik, lintas instance). Bila null -> Redis mati/tak diset -> fallback DB.
  if (redisConfigured()) {
    const n = await slidingHit(`ai:rl:${ownerId}`, WINDOW_SEC);
    if (n !== null) {
      if (n > MAX_PER_WINDOW) {
        throw new ForbiddenError("Terlalu banyak permintaan AI dalam semenit. Tunggu sebentar, lalu coba lagi.");
      }
      return;
    }
    // n === null -> Redis error: jangan blokir, jatuh ke pemeriksaan DB di bawah (fail-open aman).
  }

  const since = new Date(Date.now() - WINDOW_MS);
  const recent = await prisma.aiJob.findMany({
    where: { ownerId, createdAt: { gte: since } },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
    take: MAX_PER_WINDOW,
  });
  if (recent.length >= MAX_PER_WINDOW) {
    throw new ForbiddenError("Terlalu banyak permintaan AI dalam semenit. Tunggu sebentar, lalu coba lagi.");
  }
  const last = recent[0]?.createdAt;
  if (last && Date.now() - last.getTime() < MIN_INTERVAL_MS) {
    throw new ForbiddenError("Beri jeda beberapa detik antar-permintaan AI, ya.");
  }
}
