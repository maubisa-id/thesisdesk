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

// Pengajuan naik tahap dalam scope pemutus: admin=semua, kaprodi=prodinya (fail-closed bila prodi null).
// Dikembalikan datar (siap render), diurutkan terbaru. Pemisahan pending/decided dilakukan pemanggil.
export async function getStageApprovals(user: SessionUser) {
  // Filter via relasi bimbingan: tenant (institutionId) + scope prodi kaprodi. Admin: hanya tenant.
  const bimFilter: Record<string, unknown> = {};
  if (user.institutionId != null) bimFilter.institutionId = user.institutionId;
  if (user.role !== "admin") bimFilter.client = { is: { studyProgramId: user.studyProgramId ?? -1 } };
  const scope = Object.keys(bimFilter).length ? { bimbingan: { is: bimFilter } } : {};
  const rows = await prisma.stageApproval.findMany({
    where: scope,
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      id: true,
      stage: true,
      status: true,
      note: true,
      createdAt: true,
      decidedAt: true,
      bimbingan: {
        select: {
          stage: true,
          thesisTitle: true,
          client: {
            select: { name: true, studyProgram: { select: { name: true, code: true } } },
          },
        },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    stage: r.stage,
    status: r.status,
    note: r.note,
    createdAt: r.createdAt,
    decidedAt: r.decidedAt,
    currentStage: r.bimbingan.stage,
    thesisTitle: r.bimbingan.thesisTitle,
    clientName: r.bimbingan.client.name,
    prodi: r.bimbingan.client.studyProgram
      ? `${r.bimbingan.client.studyProgram.name} (${r.bimbingan.client.studyProgram.code})`
      : null,
  }));
}

export type StageApprovalRow = Awaited<ReturnType<typeof getStageApprovals>>[number];

// Daftar sidang dalam scope (admin=semua, kaprodi=prodinya). Bimbingan tahap sidang/selesai
// atau yang sudah punya jadwal sidang. Menyertakan defense terbaru (bila ada).
export async function getSidangList(user: SessionUser) {
  const scope: Record<string, unknown> = {};
  if (user.institutionId != null) scope.institutionId = user.institutionId;
  if (user.role !== "admin") scope.client = { is: { studyProgramId: user.studyProgramId ?? -1 } };
  const rows = await prisma.bimbingan.findMany({
    where: {
      deletedAt: null,
      ...scope,
      OR: [{ stage: "sidang" }, { stage: "selesai" }, { defenses: { some: {} } }],
    },
    orderBy: { id: "desc" },
    take: 100,
    select: {
      id: true,
      thesisTitle: true,
      stage: true,
      client: { select: { name: true, studyProgram: { select: { name: true, code: true } } } },
      tutor: { select: { name: true } },
      defenses: {
        orderBy: { id: "desc" },
        take: 1,
        select: { id: true, scheduledAt: true, location: true, status: true, result: true, examiners: true, notes: true },
      },
    },
  });
  return rows.map((b) => ({
    bimbinganId: b.id,
    thesisTitle: b.thesisTitle,
    stage: b.stage,
    clientName: b.client.name,
    tutorName: b.tutor?.name ?? null,
    prodi: b.client.studyProgram ? `${b.client.studyProgram.name} (${b.client.studyProgram.code})` : null,
    defense: b.defenses[0] ?? null,
  }));
}

export type SidangRow = Awaited<ReturnType<typeof getSidangList>>[number];

// Detail sidang untuk berita acara / lembar pengesahan. RBAC dicek di pemanggil (page).
export async function getDefenseDetail(defenseId: number) {
  return prisma.defense.findUnique({
    where: { id: defenseId },
    select: {
      id: true,
      scheduledAt: true,
      location: true,
      status: true,
      result: true,
      examiners: true,
      notes: true,
      bimbingan: {
        select: {
          clientUserId: true,
          tutorUserId: true,
          thesisTitle: true,
          serviceType: true,
          client: {
            select: {
              name: true,
              studyProgramId: true,
              studyProgram: { select: { name: true, code: true, level: true, faculty: { select: { name: true } } } },
            },
          },
          tutor: { select: { name: true } },
        },
      },
    },
  });
}
