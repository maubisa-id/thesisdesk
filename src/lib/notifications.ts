import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { notifyHub, GENERIC_TEMPLATE, dedupeKey, absoluteAppUrl, type NotifyCategory } from "@/lib/notify";

// Buat notifikasi in-app (best-effort: kegagalan tak boleh menjatuhkan aksi utama).
// Opsi `email: true` juga mengirimkan email - LEWAT HUB (akun.maubisa.id/api/notify), karena thesis
// tidak punya SMTP sendiri (hub-and-spoke, ADR-013). Hub yang gate preferensi/consent + kirim Gmail.
export async function createNotification(input: {
  userId: number;
  coreUserId?: number | null;
  type: string;
  title: string;
  body?: string;
  color?: "success" | "info" | "warning" | "danger";
  actionUrl?: string;
  email?: boolean;
  emailCategory?: NotifyCategory; // default "L" (lifecycle). Pakai "T" untuk yang wajib terkirim.
  emailTemplate?: string; // opsional: id template hub kaya (mis. "thesis.jadwal_disetujui"). Default generik.
  emailData?: Record<string, unknown>; // opsional: data untuk template kaya (mis. {judul,tanggal,waktu,actionUrl}).
}): Promise<void> {
  let notifId: number | null = null;
  try {
    const created = await prisma.notification.create({
      data: {
        userId: input.userId,
        coreUserId: input.coreUserId ?? null,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        color: input.color ?? "info",
        actionUrl: input.actionUrl ?? null,
      },
    });
    notifId = created.id;
  } catch {
    /* notifikasi opsional */
  }

  // Kanal email opsional - diteruskan ke hub. Best-effort, tak memblok aksi utama.
  if (input.email) {
    try {
      // Penerima: utamakan coreUserId (hub resolve identitas). Fallback: email lokal user thesis.
      let to: { coreUserId: number } | { email: string } | null =
        input.coreUserId != null ? { coreUserId: input.coreUserId } : null;
      if (!to) {
        const u = await prisma.user.findUnique({
          where: { id: input.userId },
          select: { email: true, coreUserId: true },
        });
        if (u?.coreUserId != null) to = { coreUserId: u.coreUserId };
        else if (u?.email) to = { email: u.email };
      }

      if (to) {
        // Template kaya (mis. jadwal disetujui + link Meet) bila emailTemplate/emailData diberikan;
        // kalau tidak, jatuh ke template generik (judul + isi + 1 CTA).
        const template = input.emailTemplate ?? GENERIC_TEMPLATE;
        const data = input.emailData ?? {
          title: input.title,
          body: input.body ?? null,
          actionUrl: absoluteAppUrl(input.actionUrl) ?? null,
        };
        await notifyHub({
          template,
          to,
          category: input.emailCategory ?? "L",
          data,
          // dedupe stabil bila baris notifikasi berhasil dibuat; jika tidak, pakai kunci waktu.
          dedupeKey: notifId != null ? dedupeKey.notif(notifId) : `thesis:notif:adhoc:${input.userId}:${Date.now()}`,
        });
      }
    } catch {
      /* email opsional */
    }
  }
}

export const getNotifications = cache(async (userId: number, take = 15) => {
  try {
    return await prisma.notification.findMany({
      where: { userId },
      orderBy: { id: "desc" },
      take,
    });
  } catch {
    return [];
  }
});

export const getUnreadNotifCount = cache(async (userId: number) => {
  try {
    return await prisma.notification.count({ where: { userId, readAt: null } });
  } catch {
    return 0;
  }
});
