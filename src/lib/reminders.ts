import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notifications";
import { buildReminderPayload } from "@/lib/notify";

// Pengingat fitur Reminder (P0). Dua kanal:
// - channel "inapp": diproses "lazy cron" (processDueReminders) saat pengguna memuat halaman →
//   jadi notifikasi in-app (+ email best-effort via hub).
// - channel "email": diproses scheduler terpusat (Cloudflare Worker `scheduler-hub` →
//   /api/cron/reminders) sehingga terkirim PROAKTIF walau pengguna sedang offline. Dipakai untuk
//   pengingat penting seperti sesi H-1 (lihat approve jadwal di actions.ts).
// Kedua kanal memakai payload generik yang SAMA ({title, body, actionUrl}) - lihat notify.ts.
//
// CATATAN - reminder SATU-KALI vs BERKALA (2026-08-05):
// createReminder() ini untuk reminder SATU-KALI yang dijadwalkan pada saat sebuah event terjadi
// (mis. sesi disetujui -> jadwalkan H-1). Cron /api/cron/reminders tinggal mengirim yang jatuh tempo.
//
// notifikasi.md §F "Ringkasan progres bimbingan (berkala)" BEDA: tak terikat satu event, tapi perlu
// dibangkitkan periodik (mis. mingguan) untuk SEMUA bimbingan aktif. Itu BELUM dibangun. Pola yang
// disarankan bila mau dibuat (tanpa mengubah mekanisme di atas):
//   1) endpoint baru mis. app/api/cron/weekly-summary/route.ts (verifikasi x-cron-secret),
//   2) scan bimbingan status "ongoing", rangkai ringkasan dari data faktual (ada helper
//      summarizeMilestones di queries.ts) + writing_stats,
//   3) kirim via notifyHub (category "L") dgn dedupeKey per-minggu, mis. thesis:ringkasan:{bimbinganId}:{ISOWeek},
//   4) tambah 1 baris cron mingguan di Worker scheduler-hub (CRON_TARGETS, mis. "0 8 * * mon").
// Isi + kadensi = keputusan produk; koordinasikan dgn hub agar tak dobel. Sengaja TIDAK dibangun di sini.

export async function createReminder(input: {
  ownerId: number;
  coreUserId?: number | null;
  bimbinganId?: number | null;
  remindAt: Date;
  title: string;
  body?: string;
  actionUrl?: string;
  channel?: "inapp" | "email"; // default "inapp"
}): Promise<void> {
  try {
    // Jangan buat pengingat untuk waktu yang sudah lewat.
    if (input.remindAt.getTime() <= Date.now()) return;
    await prisma.reminder.create({
      data: {
        ownerId: input.ownerId,
        coreUserId: input.coreUserId ?? null,
        bimbinganId: input.bimbinganId ?? null,
        channel: input.channel ?? "inapp",
        remindAt: input.remindAt,
        status: "scheduled",
        payload: buildReminderPayload({
          title: input.title,
          body: input.body,
          actionUrl: input.actionUrl ?? "/jadwal",
        }),
      },
    });
  } catch {
    /* pengingat opsional */
  }
}

// Proses pengingat in-app yang jatuh tempo untuk satu pengguna (dipanggil dari layout).
export async function processDueReminders(userId: number): Promise<void> {
  try {
    const due = await prisma.reminder.findMany({
      where: { ownerId: userId, channel: "inapp", status: "scheduled", remindAt: { lte: new Date() } },
      orderBy: { remindAt: "asc" },
      take: 20,
    });
    if (due.length === 0) return;
    for (const r of due) {
      let title = "Pengingat";
      let body: string | undefined;
      let actionUrl = "/jadwal";
      if (r.payload) {
        try {
          const p = JSON.parse(r.payload) as { title?: string; body?: string; actionUrl?: string };
          title = p.title ?? title;
          body = p.body ?? undefined;
          actionUrl = p.actionUrl ?? actionUrl;
        } catch {
          /* payload rusak - pakai default */
        }
      }
      await createNotification({ userId, coreUserId: r.coreUserId, type: "reminder", title, body, color: "warning", actionUrl, email: true });
      await prisma.reminder.update({ where: { id: r.id }, data: { status: "sent", sentAt: new Date() } });
    }
  } catch {
    /* best-effort */
  }
}
