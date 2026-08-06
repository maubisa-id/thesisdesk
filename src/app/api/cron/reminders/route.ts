import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  notifyHub,
  reminderToNotify,
  parseReminderPayload,
  type NotifyTo,
} from "@/lib/notify";

// Endpoint TIME-BASED reminder (ADR-013 §7/§8.2). Dipukul (GET) oleh scheduler tipis Cloudflare
// Worker `scheduler-hub` (repo hub: workers/scheduler-hub) tiap ~15 menit dengan header
// x-cron-secret. Kontrak SAMA dengan hub /api/cron/reminders (GET) supaya satu Worker bisa menembak
// hub + thesis dari satu CRON_TARGETS. (Alternatif: Coolify Scheduled Task / GitHub Actions cron.)
//
// Alur (Pola B "outbox", §8.2): verifikasi x-cron-secret -> scan `reminders` jatuh tempo &
// channel=email -> teruskan ke hub (/api/notify) -> tandai status. HUB yang benar-benar mengirim
// email (thesis tak punya SMTP).
//
// Idempoten: dedupeKey (thesis:reminder:{id}) + status='sent'. Aman bila cron jalan dobel:
// hub menolak duplikat (200 skipped), dan baris yang sudah 'sent' tak akan discan lagi.

export const dynamic = "force-dynamic"; // jangan di-cache; selalu evaluasi waktu terkini.
export const runtime = "nodejs"; // butuh Prisma + node:crypto (bukan Edge).

const BATCH = 200; // batas per-tick supaya request cron pendek & CPU rendah.

function secretOk(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false; // fail-closed: tanpa secret, tolak.
  const got = req.headers.get("x-cron-secret") ?? "";
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function runReminders(): Promise<{
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
}> {
  const now = new Date();
  const due = await prisma.reminder.findMany({
    where: { status: "scheduled", channel: "email", remindAt: { lte: now } },
    orderBy: { remindAt: "asc" },
    take: BATCH,
    include: { owner: { select: { email: true, coreUserId: true } } },
  });

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of due) {
    const payload = parseReminderPayload(r.payload);

    // Payload rusak/kosong tak akan pernah berhasil -> tandai 'failed' (jangan blok antrean).
    if (!payload) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "failed" },
      });
      failed++;
      continue;
    }

    // Penerima: utamakan coreUserId (hub resolve identitas), fallback email owner.
    const coreUserId = r.coreUserId ?? r.owner?.coreUserId ?? null;
    const to: NotifyTo | null = coreUserId
      ? { coreUserId }
      : r.owner?.email
        ? { email: r.owner.email }
        : null;

    if (!to) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "failed" },
      });
      failed++;
      continue;
    }

    // throwOnError=false: error jaringan -> biarkan 'scheduled' agar dicoba lagi tick berikutnya.
    const res = await notifyHub(reminderToNotify(r.id, to, payload));

    if (res.ok) {
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "sent", sentAt: new Date() },
      });
      if (res.skipped) skipped++;
      else sent++;
    } else if (res.status >= 400 && res.status < 500) {
      // 4xx = payload/secret salah (bukan transien). Tandai failed supaya tak retry selamanya.
      await prisma.reminder.update({
        where: { id: r.id },
        data: { status: "failed" },
      });
      failed++;
    } else {
      // 5xx / jaringan (status 0) = transien -> biarkan 'scheduled' untuk retry.
      failed++;
    }
  }

  return { processed: due.length, sent, skipped, failed };
}

// GET (bukan POST): worker kanonik `scheduler-hub` menembak endpoint ini dengan GET +
// x-cron-secret (lihat workers/scheduler-hub/src/index.ts di repo hub). Tanpa body.
export async function GET(req: Request) {
  if (!secretOk(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runReminders();
    return NextResponse.json({ ok: true, ...summary });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`[cron/reminders] gagal: ${error}`);
    return NextResponse.json({ ok: false, error }, { status: 500 });
  }
}
