import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

// Bimbingan aktif milik klien (yang login). 1 klien bisa banyak bimbingan; ambil yang berjalan.
export async function getKlienBimbingan(userId: number) {
  return prisma.bimbingan.findFirst({
    where: { clientUserId: userId, deletedAt: null },
    orderBy: [{ status: "asc" }, { id: "desc" }],
    include: {
      tutor: { select: { id: true, name: true, avatarUrl: true, lastSeenAt: true, email: true } },
    },
  });
}

export type ProgressSummary = {
  total: number;
  done: number;
  pct: number;
  perChapter: { chapter: string; total: number; done: number }[];
};

export function summarizeMilestones(
  milestones: { chapter: string; status: string }[],
): ProgressSummary {
  const total = milestones.length;
  const done = milestones.filter((m) => m.status === "done").length;
  const byChapter = new Map<string, { total: number; done: number }>();
  for (const m of milestones) {
    const c = byChapter.get(m.chapter) ?? { total: 0, done: 0 };
    c.total += 1;
    if (m.status === "done") c.done += 1;
    byChapter.set(m.chapter, c);
  }
  return {
    total,
    done,
    pct: total ? (done / total) * 100 : 0,
    perChapter: Array.from(byChapter.entries()).map(([chapter, v]) => ({ chapter, ...v })),
  };
}

export async function getMilestones(bimbinganId: number) {
  return prisma.milestone.findMany({
    where: { bimbinganId },
    orderBy: [{ sort: "asc" }, { id: "asc" }],
  });
}

// Jadwal terdekat (akan datang) untuk user sesuai peran.
export async function getUpcomingSchedules(user: SessionUser, take = 5) {
  const where =
    user.role === "tutor"
      ? { tutorId: user.id }
      : user.role === "klien"
        ? { klienId: user.id }
        : {};
  return prisma.schedule.findMany({
    where: { ...where, status: { in: ["pending", "approved", "menunggu_klien"] } },
    orderBy: { scheduledAt: "asc" },
    take,
    include: {
      tutor: { select: { id: true, name: true } },
      klien: { select: { id: true, name: true } },
    },
  });
}

// Jumlah pesan belum dibaca untuk user.
export async function getUnreadCount(userId: number) {
  return prisma.message.count({ where: { receiverId: userId, readAt: null, deletedAt: null } });
}

// Semua bimbingan yang ditangani tutor + ringkasan progres & indikator "stuck".
export async function getTutorBimbingan(tutorId: number) {
  const list = await prisma.bimbingan.findMany({
    where: { tutorUserId: tutorId, deletedAt: null },
    orderBy: { id: "desc" },
    include: {
      client: { select: { id: true, name: true, avatarUrl: true, lastSeenAt: true } },
      milestones: { select: { chapter: true, status: true, updatedAt: true } },
    },
  });
  return list.map((b) => {
    const progress = summarizeMilestones(b.milestones);
    const lastActivity = b.milestones.reduce<Date | null>((acc, m) => {
      return !acc || m.updatedAt > acc ? m.updatedAt : acc;
    }, null);
    const stuckDays = lastActivity
      ? Math.floor((Date.now() - lastActivity.getTime()) / 86_400_000)
      : null;
    return { ...b, progress, stuckDays };
  });
}

// Lawan bicara chat untuk klien = tutornya; untuk tutor = daftar kliennya.
export async function getChatPartners(user: SessionUser) {
  if (user.role === "klien") {
    const b = await getKlienBimbingan(user.id);
    return b?.tutor ? [{ id: b.tutor.id, name: b.tutor.name, avatarUrl: b.tutor.avatarUrl, lastSeenAt: b.tutor.lastSeenAt }] : [];
  }
  if (user.role === "tutor") {
    const list = await prisma.bimbingan.findMany({
      where: { tutorUserId: user.id, deletedAt: null },
      include: { client: { select: { id: true, name: true, avatarUrl: true, lastSeenAt: true } } },
    });
    return list.map((b) => b.client);
  }
  return [];
}
