"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser, type SessionUser } from "@/lib/session";
import { canAccessBimbingan, canDecideStage, ForbiddenError, assertAccess } from "@/lib/rbac";
import { hasThesisAccess } from "@/lib/entitlement";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { createReminder } from "@/lib/reminders";
import { saveUpload } from "@/lib/upload";
import { gcsPortalConfigured } from "@/lib/gcs";
import { portalCdnUrl } from "@/lib/portal-url";
import { createGoogleMeet, endGoogleMeet } from "@/lib/google-calendar";
import { summarizeMilestones } from "@/lib/queries";
import { nextStage, STAGE_LABEL } from "@/lib/format";

export type ActionResult = { ok: true; message?: string } | { ok: false; error: string };

async function requireUser(): Promise<SessionUser> {
  const u = await getSessionUser();
  if (!u) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
  return u;
}

function fail(e: unknown): ActionResult {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Input tidak valid." };
  return { ok: false, error: "Terjadi kendala. Coba lagi." };
}

// Pastikan user berhak atas sebuah bimbingan (cegah IDOR).
async function assertBimbingan(user: SessionUser, bimbinganId: number) {
  const b = await prisma.bimbingan.findUnique({
    where: { id: bimbinganId },
    select: { clientUserId: true, tutorUserId: true },
  });
  if (!b || !canAccessBimbingan(user, b)) throw new ForbiddenError();
  return b;
}

/* ---------- Milestones (Progres BAB) ---------- */

const milestoneStatusSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["todo", "in_progress", "review", "done", "blocked"]),
});

export async function setMilestoneStatus(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { id, status } = milestoneStatusSchema.parse(input);
    const m = await prisma.milestone.findUnique({ where: { id }, select: { bimbinganId: true, ownerId: true } });
    if (!m) throw new ForbiddenError("Milestone tidak ditemukan.");
    await assertBimbingan(user, m.bimbinganId);
    await prisma.milestone.update({
      where: { id },
      data: { status, completedAt: status === "done" ? new Date() : null },
    });
    await writeAudit({ actor: user, action: "milestone.update", targetType: "milestone", targetId: id, metadata: { status } });
    revalidatePath("/progres");
    revalidatePath("/");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const milestoneCreateSchema = z.object({
  bimbinganId: z.coerce.number().int().positive(),
  chapter: z.enum(["proposal", "bab1", "bab2", "bab3", "bab4", "bab5", "revisi", "sidang", "other"]),
  title: z.string().trim().min(3, "Judul milestone minimal 3 karakter.").max(200),
});

export async function createMilestone(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { bimbinganId, chapter, title } = milestoneCreateSchema.parse(input);
    await assertBimbingan(user, bimbinganId);
    const max = await prisma.milestone.aggregate({ where: { bimbinganId }, _max: { sort: true } });
    await prisma.milestone.create({
      data: { bimbinganId, ownerId: user.id, coreUserId: user.coreUserId, chapter, title, status: "todo", sort: (max._max.sort ?? 0) + 1 },
    });
    await writeAudit({ actor: user, action: "milestone.create", targetType: "bimbingan", targetId: bimbinganId });
    revalidatePath("/progres");
    return { ok: true, message: "Milestone ditambahkan." };
  } catch (e) {
    return fail(e);
  }
}

const milestoneDeleteSchema = z.object({ id: z.coerce.number().int().positive() });

export async function deleteMilestone(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { id } = milestoneDeleteSchema.parse(input);
    const m = await prisma.milestone.findUnique({ where: { id }, select: { bimbinganId: true } });
    if (!m) throw new ForbiddenError("Milestone tidak ditemukan.");
    await assertBimbingan(user, m.bimbinganId);
    await prisma.milestone.delete({ where: { id } });
    await writeAudit({ actor: user, action: "milestone.delete", targetType: "milestone", targetId: id });
    revalidatePath("/progres");
    revalidatePath("/");
    return { ok: true, message: "Milestone dihapus." };
  } catch (e) {
    return fail(e);
  }
}

// Template milestone BAB I-V (blueprint welcome-wizard, slice lokal): sekali klik saat papan kosong.
const CHAPTER_TEMPLATE: { chapter: string; title: string }[] = [
  { chapter: "proposal", title: "Proposal disetujui pembimbing" },
  { chapter: "bab1", title: "BAB I - Pendahuluan" },
  { chapter: "bab2", title: "BAB II - Tinjauan Pustaka" },
  { chapter: "bab3", title: "BAB III - Metodologi" },
  { chapter: "bab4", title: "BAB IV - Hasil & Pembahasan" },
  { chapter: "bab5", title: "BAB V - Kesimpulan & Saran" },
  { chapter: "sidang", title: "Latihan sidang & finalisasi slide" },
];

export async function generateChapterMilestones(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { bimbinganId } = z.object({ bimbinganId: z.coerce.number().int().positive() }).parse(input);
    await assertBimbingan(user, bimbinganId);
    const existing = await prisma.milestone.count({ where: { bimbinganId } });
    if (existing > 0) throw new ForbiddenError("Papan sudah punya milestone.");
    await prisma.milestone.createMany({
      data: CHAPTER_TEMPLATE.map((c, i) => ({
        bimbinganId,
        ownerId: user.id,
        coreUserId: user.coreUserId,
        chapter: c.chapter,
        title: c.title,
        status: "todo",
        sort: i,
      })),
    });
    await writeAudit({ actor: user, action: "milestone.generate_template", targetType: "bimbingan", targetId: bimbinganId });
    revalidatePath("/progres");
    revalidatePath("/");
    return { ok: true, message: "Template BAB I-V dibuat. Silakan sesuaikan." };
  } catch (e) {
    return fail(e);
  }
}

const scheduleRequestSchema = z.object({
  topic: z.string().trim().min(3, "Isi topik sesi.").max(255),
  scheduledAt: z.string().min(1, "Pilih tanggal & jam."),
});

// Cegah DOUBLE-BOOK (blueprint-thesis §5.3 "H5 cegah double-book"): tolak bila tutor ATAU klien sudah
// punya sesi DISETUJUI di sekitar waktu itu. schedules hanya simpan scheduledAt (point-in-time), jadi
// "bentrok" = selisih <= 60 menit (asumsi durasi 1 sesi). Dicek di dua titik commit: ajukan & setujui.
const SESSION_WINDOW_MS = 60 * 60_000;
async function findScheduleConflict(opts: {
  tutorId: number;
  klienId: number;
  when: Date;
  excludeId?: number;
}): Promise<{ scheduledAt: Date } | null> {
  const { tutorId, klienId, when, excludeId } = opts;
  return prisma.schedule.findFirst({
    where: {
      status: "approved",
      ...(excludeId ? { id: { not: excludeId } } : {}),
      scheduledAt: {
        gte: new Date(when.getTime() - SESSION_WINDOW_MS),
        lte: new Date(when.getTime() + SESSION_WINDOW_MS),
      },
      OR: [{ tutorId }, { klienId }],
    },
    select: { scheduledAt: true },
  });
}

function formatWibTime(d: Date): string {
  return `${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(d)} WIB`;
}
function formatWibDate(d: Date): string {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "full", timeZone: "Asia/Jakarta" }).format(d);
}

export async function requestSchedule(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role !== "klien") throw new ForbiddenError("Hanya klien yang mengajukan sesi.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif.");
    const { topic, scheduledAt } = scheduleRequestSchema.parse(input);
    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw new ForbiddenError("Tanggal tidak valid.");
    if (when.getTime() < Date.now()) throw new ForbiddenError("Pilih waktu yang akan datang.");
    if (!user.tutorId) throw new ForbiddenError("Tutor belum ditugaskan. Hubungi admin.");
    const conflict = await findScheduleConflict({ tutorId: user.tutorId, klienId: user.id, when });
    if (conflict) {
      throw new ForbiddenError(`Sudah ada sesi disetujui di sekitar jam itu (${formatWibTime(conflict.scheduledAt)}). Pilih waktu lain, beri jarak minimal 1 jam.`);
    }
    await prisma.schedule.create({
      data: { tutorId: user.tutorId, klienId: user.id, topic, scheduledAt: when, status: "pending" },
    });
    await createNotification({
      userId: user.tutorId,
      type: "schedule_request",
      title: "Pengajuan bimbingan baru",
      body: `${user.name} mengajukan sesi: ${topic}`,
      color: "info",
      actionUrl: "/jadwal",
    });
    await writeAudit({ actor: user, action: "schedule.request", targetType: "schedule" });
    revalidatePath("/jadwal");
    return { ok: true, message: "Pengajuan terkirim ke tutor." };
  } catch (e) {
    return fail(e);
  }
}

const scheduleActSchema = z.object({
  id: z.coerce.number().int().positive(),
  action: z.enum(["approve", "reject", "selesai", "reschedule", "accept", "ask_other"]),
  gmeetLink: z.string().trim().optional(),
  newTime: z.string().trim().optional(),
});

// Nomor pertemuan berikutnya untuk pasangan tutor-klien (paritas sesi_ke Laravel lama).
async function nextSesiKe(tutorId: number, klienId: number): Promise<number> {
  const agg = await prisma.schedule.aggregate({
    where: { tutorId, klienId, sesiKe: { not: null } },
    _max: { sesiKe: true },
  });
  return (agg._max.sesiKe ?? 0) + 1;
}

export async function actOnSchedule(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { id, action, gmeetLink, newTime } = scheduleActSchema.parse(input);
    const s = await prisma.schedule.findUnique({
      where: { id },
      select: { tutorId: true, klienId: true, topic: true, status: true, sesiKe: true, scheduledAt: true, gcalEventId: true, tutor: { select: { email: true } }, klien: { select: { name: true, email: true, coreUserId: true } } },
    });
    if (!s) throw new ForbiddenError("Sesi tidak ditemukan.");

    const isTutorAction = action === "approve" || action === "reject" || action === "selesai" || action === "reschedule";
    const isKlienAction = action === "accept" || action === "ask_other";
    if (isTutorAction && user.role !== "admin" && s.tutorId !== user.id) throw new ForbiddenError("Bukan sesimu.");
    if (isKlienAction && s.klienId !== user.id) throw new ForbiddenError("Bukan sesimu.");

    const meetLink = gmeetLink?.trim() || "https://meet.google.com/new";

    if (action === "reschedule") {
      if (!newTime) throw new ForbiddenError("Pilih waktu pengganti.");
      const when = new Date(newTime);
      if (Number.isNaN(when.getTime())) throw new ForbiddenError("Tanggal tidak valid.");
      if (when.getTime() < Date.now()) throw new ForbiddenError("Pilih waktu yang akan datang.");
      await prisma.schedule.update({ where: { id }, data: { scheduledAt: when, status: "menunggu_klien", gmeetLink: null } });
      await createNotification({
        userId: s.klienId,
        type: "schedule_reschedule",
        title: "Tutor mengusulkan waktu lain",
        body: `Sesi "${s.topic}" diusulkan dijadwalkan ulang. Setujui atau minta waktu lain.`,
        color: "warning",
        actionUrl: "/jadwal",
      });
    } else if (action === "approve" || action === "accept") {
      // Cegah double-book saat commit: tutor/klien tak boleh punya 2 sesi disetujui berdekatan.
      const clash = await findScheduleConflict({ tutorId: s.tutorId, klienId: s.klienId, when: s.scheduledAt, excludeId: id });
      if (clash) throw new ForbiddenError(`Ada sesi lain yang sudah disetujui di sekitar jam itu (${formatWibTime(clash.scheduledAt)}). Jadwalkan ulang dulu agar tak bentrok.`);
      const sesiKe = s.sesiKe ?? (await nextSesiKe(s.tutorId, s.klienId));
      // Cetak GMeet NYATA lewat akun sistem@contoh.id (port dari Laravel createGoogleMeet).
      // Best-effort: kalau integrasi belum dikonfigurasi/gagal -> pakai link manual/placeholder
      // (approve tetap jalan, mirror perilaku Laravel yang memberi tahu "link sedang diproses").
      const meet = await createGoogleMeet({
        topic: s.topic,
        scheduledAt: s.scheduledAt,
        tutorEmail: s.tutor?.email,
        klienEmail: s.klien.email,
      });
      const finalLink = meet?.meetLink ?? meetLink;
      await prisma.schedule.update({
        where: { id },
        data: { status: "approved", gmeetLink: finalLink, gcalEventId: meet?.eventId ?? undefined, sesiKe },
      });
      await createNotification({
        userId: action === "approve" ? s.klienId : s.tutorId,
        type: "schedule_approved",
        title: action === "approve" ? "Jadwal disetujui tutor" : "Klien menyetujui jadwal",
        body: `Sesi "${s.topic}" (Pertemuan ${sesiKe}) siap. Link Google Meet sudah tersedia.`,
        color: "success",
        actionUrl: "/jadwal",
        email: true,
        emailCategory: "T",
        // Template kaya hub (notifikasi.md): tanggal + jam + tombol "Join" ke link Meet NYATA,
        // bukan sekadar arahkan ke /jadwal. finalLink = hasil createGoogleMeet / fallback.
        emailTemplate: "thesis.jadwal_disetujui",
        emailData: {
          name: action === "approve" ? s.klien.name : undefined,
          judul: `${s.topic} (Pertemuan ${sesiKe})`,
          tanggal: formatWibDate(s.scheduledAt),
          waktu: formatWibTime(s.scheduledAt),
          actionUrl: finalLink,
        },
      });
      // Pengingat H-1 untuk klien via EMAIL (scheduler terpusat) → terkirim proaktif walau offline.
      await createReminder({
        ownerId: s.klienId,
        coreUserId: s.klien.coreUserId,
        remindAt: new Date(s.scheduledAt.getTime() - 24 * 60 * 60_000),
        title: "Sesi bimbingan besok",
        body: `Ingat, sesi "${s.topic}" dijadwalkan besok. Siapkan pertanyaan & bahanmu.`,
        actionUrl: "/jadwal",
        channel: "email",
      });
    } else if (action === "ask_other") {
      await prisma.schedule.update({ where: { id }, data: { status: "pending", gmeetLink: null } });
      await createNotification({
        userId: s.tutorId,
        type: "schedule_request",
        title: "Klien meminta waktu lain",
        body: `${s.klien.name} meminta waktu lain untuk sesi "${s.topic}".`,
        color: "info",
        actionUrl: "/jadwal",
      });
    } else {
      const status = action === "reject" ? "rejected" : "selesai";
      await prisma.schedule.update({ where: { id }, data: { status, gmeetLink: action === "reject" ? null : undefined } });
      if (action === "selesai") {
        // Amankan ruang GMeet (port dari Laravel deleteGoogleMeet): tandai [SELESAI] + keluarkan
        // tamu agar link tak bisa dipakai lagi. Best-effort, tak menghalangi penyelesaian sesi.
        if (s.gcalEventId) await endGoogleMeet(s.gcalEventId);
        await createNotification({
          userId: s.klienId,
          type: "schedule_done",
          title: "Sesi bimbingan selesai",
          body: `Sesi "${s.topic}" ditandai selesai. Cek catatan tutor di riwayat.`,
          color: "info",
          actionUrl: "/jadwal",
        });
      }
    }

    await writeAudit({ actor: user, action: `schedule.${action}`, targetType: "schedule", targetId: id });
    revalidatePath("/jadwal");
    return { ok: true, message: "Jadwal diperbarui." };
  } catch (e) {
    return fail(e);
  }
}

// Tutor mengisi Catatan Sesi (tutorNote) + Link Recording GMeet pada sebuah sesi.
const sessionNotesSchema = z.object({
  id: z.coerce.number().int().positive(),
  tutorNote: z.string().trim().max(2000).optional(),
  recordingLink: z.string().trim().max(500).optional(),
});

export async function setSessionNotes(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role === "klien") throw new ForbiddenError("Hanya tutor yang mengisi catatan sesi.");
    const { id, tutorNote, recordingLink } = sessionNotesSchema.parse(input);
    if (recordingLink && !/^https?:\/\//i.test(recordingLink)) {
      throw new ForbiddenError("Link recording harus diawali http:// atau https://.");
    }
    const s = await prisma.schedule.findUnique({ where: { id }, select: { tutorId: true, klienId: true, topic: true } });
    if (!s) throw new ForbiddenError("Sesi tidak ditemukan.");
    if (user.role !== "admin" && s.tutorId !== user.id) throw new ForbiddenError("Bukan sesimu.");
    await prisma.schedule.update({
      where: { id },
      data: { tutorNote: tutorNote || null, recordingLink: recordingLink || null },
    });
    await createNotification({
      userId: s.klienId,
      type: "schedule_approved",
      title: "Catatan bimbingan diperbarui",
      body: `Tutor menambahkan catatan/rekaman untuk sesi "${s.topic}".`,
      color: "info",
      actionUrl: "/jadwal",
    });
    await writeAudit({ actor: user, action: "schedule.notes", targetType: "schedule", targetId: id });
    revalidatePath("/jadwal");
    return { ok: true, message: "Catatan & rekaman sesi disimpan." };
  } catch (e) {
    return fail(e);
  }
}

// Notifikasi: tandai satu / semua terbaca.
export async function markNotificationRead(id: number): Promise<void> {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { id, userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/");
  } catch {
    /* best-effort */
  }
}

export async function markAllNotificationsRead(): Promise<void> {
  try {
    const user = await requireUser();
    await prisma.notification.updateMany({
      where: { userId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    revalidatePath("/");
  } catch {
    /* best-effort */
  }
}

/* ---------- Documents (review + anotasi) ---------- */

const reviewSchema = z.object({ id: z.coerce.number().int().positive(), status: z.enum(["in_review", "reviewed"]) });

export async function setReviewStatus(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role === "klien") throw new ForbiddenError("Hanya tutor yang menandai review.");
    const { id, status } = reviewSchema.parse(input);
    const m = await prisma.module.findUnique({ where: { id }, select: { receiverId: true, uploaderId: true, title: true, originalName: true } });
    if (!m) throw new ForbiddenError("Dokumen tidak ditemukan.");
    if (user.role !== "admin" && m.receiverId !== user.id) throw new ForbiddenError();
    await prisma.module.update({ where: { id }, data: { reviewStatus: status } });
    if (status === "reviewed") {
      await createNotification({
        userId: m.uploaderId,
        type: "doc_reviewed",
        title: "Dokumen selesai direview",
        body: `Tutor selesai mereview "${m.title ?? m.originalName ?? "dokumenmu"}". Cek komentar revisinya.`,
        color: "success",
        actionUrl: `/dokumen/${id}`,
        email: true,
      });
    }
    await writeAudit({ actor: user, action: "doc.review", targetType: "module", targetId: id, metadata: { status } });
    revalidatePath(`/dokumen/${id}`);
    revalidatePath("/dokumen");
    return { ok: true, message: status === "reviewed" ? "Ditandai selesai direview." : "Sedang direview." };
  } catch (e) {
    return fail(e);
  }
}

const annotationSchema = z.object({
  moduleId: z.coerce.number().int().positive(),
  body: z.string().trim().min(2, "Isi komentar dulu.").max(2000),
  page: z.coerce.number().int().min(1).optional(),
  quote: z.string().trim().max(300).optional(),
});

export async function addAnnotation(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { moduleId, body, page, quote } = annotationSchema.parse(input);
    const m = await prisma.module.findUnique({ where: { id: moduleId }, select: { uploaderId: true, receiverId: true, title: true, originalName: true } });
    if (!m) throw new ForbiddenError("Dokumen tidak ditemukan.");
    if (user.role !== "admin" && user.id !== m.uploaderId && user.id !== m.receiverId) throw new ForbiddenError();
    await prisma.documentAnnotation.create({
      data: { moduleId, authorUserId: user.id, body, anchor: page ? JSON.stringify({ page, quote }) : null },
    });
    // Beri tahu pihak lawan (bukan penulis komentar) bahwa ada komentar revisi baru.
    const recipient = user.id === m.uploaderId ? m.receiverId : m.uploaderId;
    if (recipient) {
      await createNotification({
        userId: recipient,
        type: "annotation_new",
        title: `Komentar revisi baru dari ${user.name}`,
        body: `${page ? `Hal. ${page}: ` : ""}${body.slice(0, 80)}`,
        color: "info",
        actionUrl: `/dokumen/${moduleId}`,
      });
    }
    await writeAudit({ actor: user, action: "annotation.create", targetType: "module", targetId: moduleId });
    revalidatePath(`/dokumen/${moduleId}`);
    return { ok: true, message: "Komentar ditambahkan." };
  } catch (e) {
    return fail(e);
  }
}

export async function resolveAnnotation(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(input);
    const a = await prisma.documentAnnotation.findUnique({ where: { id }, select: { moduleId: true, resolved: true } });
    if (!a) throw new ForbiddenError();
    // Anti-IDOR: hanya pihak dokumen (uploader/penerima) atau admin yang boleh ubah status resolve.
    const m = await prisma.module.findUnique({ where: { id: a.moduleId }, select: { uploaderId: true, receiverId: true } });
    if (!m || (user.role !== "admin" && user.id !== m.uploaderId && user.id !== m.receiverId)) throw new ForbiddenError();
    await prisma.documentAnnotation.update({ where: { id }, data: { resolved: !a.resolved } });
    revalidatePath(`/dokumen/${a.moduleId}`);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const uploadSchema = z.object({
  title: z.string().trim().min(3, "Isi judul dokumen.").max(200),
  note: z.string().trim().max(1000).optional(),
});

// Unggah dokumen. Lokal (dev): berkas asli disimpan ke public/uploads dan bisa dibuka langsung.
// Produksi: validasi magic-byte + simpan ke bucket privat, sajikan via signed URL (Fondasi §5.3).
// Menerima FormData (title, note, file). Klien -> tutornya.
export async function uploadDocument(formData: FormData): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role !== "klien") throw new ForbiddenError("Hanya klien yang mengunggah draft.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif.");
    const { title, note } = uploadSchema.parse({
      title: formData.get("title"),
      note: formData.get("note") ?? undefined,
    });
    if (!user.tutorId) throw new ForbiddenError("Tutor belum ditugaskan. Hubungi admin.");

    // Simpan berkas fisik bila ada (lokal). Bila tak ada berkas, tetap catat metadata.
    const raw = formData.get("file");
    const saved =
      raw instanceof File && raw.size > 0 ? await saveUpload(raw, `portal/${user.id}`, "doc") : null;

    // Versi: jika judul sama sudah ada, naikkan versinya (riwayat revisi, H6).
    const prev = await prisma.module.findFirst({
      where: { uploaderId: user.id, title },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    await prisma.module.create({
      data: {
        title,
        note: note || null,
        uploaderId: user.id,
        receiverId: user.tutorId,
        reviewStatus: "uploaded",
        version: (prev?.version ?? 0) + 1,
        originalName: saved?.originalName ?? `${title.replace(/\s+/g, "-").toLowerCase()}.pdf`,
        filePath: saved?.path ?? `portal/${user.id}/${Date.now()}.pdf`,
        fileSize: saved?.size ?? null,
        fileMime: saved?.mime ?? null,
      },
    });
    await createNotification({
      userId: user.tutorId,
      type: "doc_new",
      title: "Berkas baru masuk",
      body: `${user.name} mengirim berkas: ${title}`,
      color: "success",
      actionUrl: "/dokumen",
    });
    await writeAudit({ actor: user, action: "doc.upload", targetType: "module", metadata: { title, hasFile: Boolean(saved) } });
    revalidatePath("/dokumen");
    return { ok: true, message: saved ? "Dokumen terunggah & terkirim ke tutor." : "Dokumen terkirim ke tutor untuk direview." };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Chat ---------- */

const messageSchema = z
  .object({
    receiverId: z.coerce.number().int().positive(),
    content: z.string().trim().max(4000).default(""),
    attachment: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.content.length > 0 || Boolean(v.attachment), {
    message: "Pesan kosong.",
    path: ["content"],
  });

export async function sendMessage(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { receiverId, content, attachment } = messageSchema.parse(input);
    if (receiverId === user.id) throw new ForbiddenError("Tidak bisa mengirim ke diri sendiri.");
    // Validasi relasi: peserta harus terhubung lewat bimbingan (klien↔tutornya).
    const linked = await prisma.bimbingan.findFirst({
      where: {
        deletedAt: null,
        OR: [
          { clientUserId: user.id, tutorUserId: receiverId },
          { clientUserId: receiverId, tutorUserId: user.id },
        ],
      },
      select: { id: true },
    });
    if (!linked && user.role !== "admin") throw new ForbiddenError("Belum terhubung dengan penerima.");
    await prisma.message.create({
      data: { senderId: user.id, receiverId, content, roleSender: user.role, attachment: attachment || null },
    });
    // Perbarui presence pengirim (paritas last_seen_at Laravel lama).
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    // CATATAN (email, 2026-08-05): notifikasi ini SENGAJA in-app saja (email: true TIDAK diset).
    // notifikasi.md §F "Pesan baru dari pembimbing" mencantumkan Email/In-app, TAPI email per-pesan
    // berisiko spam + jebol kuota Gmail (2.000/hari, lihat integrasi-notifikasi). Kalau nanti email
    // diaktifkan, pakai pola hemat: kirim HANYA bila penerima offline (cek lastSeenAt > N menit) atau
    // digest "kamu punya pesan belum dibaca", jangan tiap pesan. Keputusan produk - koordinasi dgn hub.
    await createNotification({
      userId: receiverId,
      type: "message_new",
      title: `Pesan baru dari ${user.name}`,
      body: content ? content.slice(0, 80) : "Mengirim berkas",
      color: "info",
      actionUrl: "/chat",
    });
    revalidatePath("/chat");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function markConversationRead(otherId: number): Promise<void> {
  try {
    const user = await requireUser();
    await prisma.message.updateMany({
      where: { senderId: otherId, receiverId: user.id, readAt: null },
      data: { readAt: new Date() },
    });
    await prisma.user.update({ where: { id: user.id }, data: { lastSeenAt: new Date() } });
    revalidatePath("/chat");
  } catch {
    /* best-effort */
  }
}

// Unggah lampiran chat (lokal): simpan berkas, kembalikan path publik untuk dilampirkan ke pesan.
export async function uploadChatAttachment(
  formData: FormData,
): Promise<{ ok: true; path: string; name: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const raw = formData.get("file");
    if (!(raw instanceof File) || raw.size === 0) return { ok: false, error: "Berkas kosong." };
    const saved = await saveUpload(raw, `chat/${user.id}`, "chat");
    return { ok: true, path: saved.path, name: saved.originalName };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Gagal mengunggah berkas." };
  }
}

/* ---------- Tutor: detail klien (untuk modal profil) ---------- */

export type KlienDetail = {
  name: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  thesisTitle: string | null;
  serviceType: string;
  status: string;
  progress: { done: number; total: number; pct: number };
  perChapter: { chapter: string; total: number; done: number }[];
  sessionCount: number;
  lastActivity: string | null;
  sessions: { id: number; sesiKe: number | null; topic: string; scheduledAt: string; status: string; tutorNote: string | null }[];
};

export async function getKlienDetail(
  input: unknown,
): Promise<{ ok: true; data: KlienDetail } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const { klienId } = z.object({ klienId: z.coerce.number().int().positive() }).parse(input);

    // RBAC: hanya tutor pemilik bimbingan klien ini, atau admin (cegah IDOR antar-tutor).
    const bimbingan = await prisma.bimbingan.findFirst({
      where: {
        clientUserId: klienId,
        deletedAt: null,
        ...(user.role === "admin" ? {} : { tutorUserId: user.id }),
      },
      include: {
        client: { select: { name: true, email: true, phone: true, avatarUrl: true } },
        milestones: { select: { chapter: true, status: true, updatedAt: true } },
      },
    });
    if (!bimbingan) throw new ForbiddenError("Klien tidak ditemukan atau bukan bimbinganmu.");

    // Akses PII klien (nama, email, telepon) wajib terekam (Fondasi §5.1, ADR-004 PDP).
    await writeAudit({
      actor: user,
      action: "pii.read",
      targetType: "user",
      targetId: klienId,
      metadata: { via: "getKlienDetail", fields: ["name", "email", "phone"] },
    });

    const progress = summarizeMilestones(bimbingan.milestones);
    const sessions = await prisma.schedule.findMany({
      where: { klienId, ...(user.role === "admin" ? {} : { tutorId: user.id }) },
      orderBy: { scheduledAt: "desc" },
      take: 12,
      select: { id: true, sesiKe: true, topic: true, scheduledAt: true, status: true, tutorNote: true },
    });
    const sessionCount = await prisma.schedule.count({
      where: { klienId, status: "selesai", ...(user.role === "admin" ? {} : { tutorId: user.id }) },
    });
    const lastActivity = bimbingan.milestones.reduce<Date | null>(
      (acc, m) => (!acc || m.updatedAt > acc ? m.updatedAt : acc),
      null,
    );

    return {
      ok: true,
      data: {
        name: bimbingan.client.name,
        email: bimbingan.client.email,
        phone: bimbingan.client.phone,
        avatarUrl: bimbingan.client.avatarUrl,
        thesisTitle: bimbingan.thesisTitle,
        serviceType: bimbingan.serviceType,
        status: bimbingan.status,
        progress: { done: progress.done, total: progress.total, pct: progress.pct },
        perChapter: progress.perChapter,
        sessionCount,
        lastActivity: lastActivity ? lastActivity.toISOString() : null,
        sessions: sessions.map((s) => ({
          id: s.id,
          sesiKe: s.sesiKe,
          topic: s.topic,
          scheduledAt: s.scheduledAt.toISOString(),
          status: s.status,
          tutorNote: s.tutorNote,
        })),
      },
    };
  } catch (e) {
    const r = fail(e);
    return { ok: false, error: r.ok ? "Gagal memuat detail klien." : r.error };
  }
}

/* ---------- Penunjang Tutor: Pustaka template feedback (feedback_templates) ---------- */
// USP §Penunjang Tutor "H6 template feedback": snippet umpan balik siap-sisip saat anotasi/log.
// body = boilerplate non-PII (boleh {{placeholder}}). owner = tutor; scope shared = pustaka bersama.

const FBTPL_CATEGORIES = ["metodologi", "sitasi", "struktur", "bahasa", "data", "umum"] as const;

export type FeedbackTemplateItem = {
  id: number;
  title: string;
  body: string;
  category: string;
  scope: string;
  mine: boolean;
};

export async function listFeedbackTemplates(): Promise<
  { ok: true; items: FeedbackTemplateItem[] } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    if (user.role !== "tutor" && user.role !== "admin") throw new ForbiddenError("Hanya tutor.");
    // Tutor lihat pustaka bersama + miliknya sendiri (cegah bocor snippet antar-tutor).
    const rows = await prisma.feedbackTemplate.findMany({
      where: { deletedAt: null, OR: [{ scope: "shared" }, { ownerUserId: user.id }] },
      orderBy: [{ usageCount: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
      take: 100,
    });
    return {
      ok: true,
      items: rows.map((t) => ({ id: t.id, title: t.title, body: t.body, category: t.category, scope: t.scope, mine: t.ownerUserId === user.id })),
    };
  } catch (e) {
    const r = fail(e);
    return { ok: false, error: r.ok ? "Gagal memuat template." : r.error };
  }
}

const fbtplCreateSchema = z.object({
  title: z.string().trim().min(2, "Isi judul template.").max(160),
  body: z.string().trim().min(3, "Isi teks template.").max(2000),
  category: z.enum(FBTPL_CATEGORIES).default("umum"),
});

export async function createFeedbackTemplate(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role !== "tutor") throw new ForbiddenError("Hanya tutor yang bisa membuat template.");
    const p = fbtplCreateSchema.parse(input);
    await prisma.feedbackTemplate.create({
      data: { ownerUserId: user.id, title: p.title, body: p.body, category: p.category, scope: "private" },
    });
    await writeAudit({ actor: user, action: "feedback_template.create", targetType: "feedback_template" });
    revalidatePath("/dokumen");
    return { ok: true, message: "Template disimpan." };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteFeedbackTemplate(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(input);
    const t = await prisma.feedbackTemplate.findUnique({ where: { id }, select: { ownerUserId: true } });
    if (!t) throw new ForbiddenError("Template tidak ditemukan.");
    // Anti-IDOR: hanya pemilik (atau admin) yang boleh menghapus; pustaka bersama tak bisa dihapus tutor.
    if (t.ownerUserId !== user.id && user.role !== "admin") throw new ForbiddenError("Bukan template milikmu.");
    await prisma.feedbackTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
    revalidatePath("/dokumen");
    return { ok: true, message: "Template dihapus." };
  } catch (e) {
    return fail(e);
  }
}

// Dipanggil saat tutor menyisipkan snippet -> urutkan yang populer ke atas. Best-effort.
export async function bumpFeedbackTemplate(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    if (user.role !== "tutor") return { ok: true };
    const { id } = z.object({ id: z.coerce.number().int().positive() }).parse(input);
    await prisma.feedbackTemplate.updateMany({
      where: { id, deletedAt: null, OR: [{ scope: "shared" }, { ownerUserId: user.id }] },
      data: { usageCount: { increment: 1 } },
    });
    return { ok: true };
  } catch {
    return { ok: true };
  }
}

/* ---------- Portal: URL dokumen PRIVAT (cdn.contoh.id via Worker ber-token / lokal dev) ---------- */
// Mint tautan berbatas waktu ke dokumen di bucket privat. Entitlement dicek DI SINI (saat mint),
// sehingga token cdn.contoh.id hanya diberikan ke pihak berhak. Lihat portal-url.ts + Worker.
export async function getPortalDocUrl(input: unknown): Promise<ActionResult & { url?: string }> {
  try {
    const user = await requireUser();
    const { moduleId } = z.object({ moduleId: z.coerce.number().int().positive() }).parse(input);
    const m = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { uploaderId: true, receiverId: true, filePath: true, deletedAt: true },
    });
    if (!m || m.deletedAt) throw new ForbiddenError("Dokumen tidak ditemukan.");
    // Anti-IDOR: pemilik (klien), tutor penerima, atau admin.
    if (user.role !== "admin" && user.id !== m.uploaderId && user.id !== m.receiverId) throw new ForbiddenError();
    if (!m.filePath) return { ok: false, error: "Berkas belum tersedia." };

    // PROD (GCS): tautan cdn.contoh.id ber-token (TTL 30 mnt). DEV: path lokal apa adanya.
    if (gcsPortalConfigured()) {
      const url = portalCdnUrl(m.filePath);
      if (!url) return { ok: false, error: "PORTAL_CDN_BASE/PORTAL_URL_SECRET belum diset di server." };
      await writeAudit({ actor: user, action: "doc.view", targetType: "module", targetId: moduleId });
      return { ok: true, url };
    }
    return { ok: true, url: m.filePath };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Alur bertingkat (proposal -> seminar -> sidang) + approval kaprodi ---------- */

// Mahasiswa/tutor mengajukan naik tahap. Membuat StageApproval pending untuk diputus kaprodi.
export async function requestStageAdvance(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { bimbinganId } = z
      .object({ bimbinganId: z.coerce.number().int().positive() })
      .parse(input);
    const b = await prisma.bimbingan.findUnique({
      where: { id: bimbinganId },
      select: {
        clientUserId: true,
        tutorUserId: true,
        stage: true,
        thesisTitle: true,
        client: { select: { studyProgramId: true, name: true } },
      },
    });
    if (!b || !canAccessBimbingan(user, b)) throw new ForbiddenError();
    if (nextStage(b.stage) == null) return { ok: false, error: "Sudah di tahap akhir." };

    const pending = await prisma.stageApproval.findFirst({
      where: { bimbinganId, status: "pending" },
      select: { id: true },
    });
    if (pending) return { ok: false, error: "Sudah ada pengajuan yang menunggu keputusan kaprodi." };

    await prisma.stageApproval.create({
      data: { bimbinganId, stage: b.stage, requestedByUserId: user.id },
    });
    await writeAudit({
      actor: user,
      action: "stage.request",
      targetType: "bimbingan",
      targetId: bimbinganId,
      metadata: { stage: b.stage },
    });

    // Beri tahu kaprodi di prodi mahasiswa (jika ada). Best-effort.
    if (b.client.studyProgramId != null) {
      const kaprodis = await prisma.user.findMany({
        where: { role: "kaprodi", studyProgramId: b.client.studyProgramId, deletedAt: null },
        select: { id: true, coreUserId: true },
      });
      for (const k of kaprodis) {
        await createNotification({
          userId: k.id,
          coreUserId: k.coreUserId,
          type: "stage_request",
          title: "Pengajuan naik tahap",
          body: `${b.client.name}: ${STAGE_LABEL[b.stage] ?? b.stage} -> ${STAGE_LABEL[nextStage(b.stage) ?? ""] ?? ""}`,
          color: "info",
          actionUrl: "/persetujuan",
        });
      }
    }
    revalidatePath("/");
    revalidatePath("/persetujuan");
    return { ok: true, message: "Pengajuan naik tahap dikirim ke kaprodi." };
  } catch (e) {
    return fail(e);
  }
}

const decideStageSchema = z.object({
  approvalId: z.coerce.number().int().positive(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional(),
});

// Kaprodi/admin memutuskan pengajuan. Disetujui -> bimbingan naik ke tahap berikutnya.
export async function decideStageApproval(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { approvalId, decision, note } = decideStageSchema.parse(input);
    const ap = await prisma.stageApproval.findUnique({
      where: { id: approvalId },
      select: {
        id: true,
        status: true,
        stage: true,
        bimbinganId: true,
        requestedByUserId: true,
        bimbingan: {
          select: {
            stage: true,
            clientUserId: true,
            client: { select: { studyProgramId: true, coreUserId: true } },
          },
        },
      },
    });
    if (!ap) throw new ForbiddenError("Pengajuan tidak ditemukan.");
    if (ap.status !== "pending") return { ok: false, error: "Pengajuan sudah diputuskan." };
    assertAccess(canDecideStage(user, ap.bimbingan.client.studyProgramId), "Bukan kaprodi prodi ini.");

    const target = nextStage(ap.stage);
    await prisma.$transaction(async (tx) => {
      await tx.stageApproval.update({
        where: { id: approvalId },
        data: { status: decision, decidedByUserId: user.id, decidedAt: new Date(), note: note ?? null },
      });
      // Hanya naikkan tahap bila disetujui DAN bimbingan masih di tahap yang diajukan (hindari lompat ganda).
      if (decision === "approved" && target && ap.bimbingan.stage === ap.stage) {
        await tx.bimbingan.update({ where: { id: ap.bimbinganId }, data: { stage: target } });
      }
    });
    await writeAudit({
      actor: user,
      action: decision === "approved" ? "stage.approve" : "stage.reject",
      targetType: "bimbingan",
      targetId: ap.bimbinganId,
      metadata: { stage: ap.stage, to: decision === "approved" ? target : null },
    });

    const label =
      decision === "approved"
        ? `Naik ke tahap ${STAGE_LABEL[target ?? ""] ?? target}.`
        : `Pengajuan ${STAGE_LABEL[ap.stage] ?? ap.stage} ditolak.`;
    await createNotification({
      userId: ap.bimbingan.clientUserId,
      coreUserId: ap.bimbingan.client.coreUserId,
      type: "stage_decision",
      title: decision === "approved" ? "Naik tahap disetujui" : "Pengajuan ditolak",
      body: note ? `${label} Catatan: ${note}` : label,
      color: decision === "approved" ? "success" : "warning",
      actionUrl: "/progres",
    });
    revalidatePath("/");
    revalidatePath("/persetujuan");
    revalidatePath("/progres");
    return { ok: true, message: label };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Sidang akhir (defense): jadwal + panel penguji + hasil ---------- */

// Hanya kaprodi (scope prodi) atau admin yang mengelola sidang. Muat prodi klien untuk cek scope.
async function assertDefenseManager(user: SessionUser, bimbinganId: number) {
  const b = await prisma.bimbingan.findUnique({
    where: { id: bimbinganId },
    select: { id: true, client: { select: { studyProgramId: true } } },
  });
  if (!b) throw new ForbiddenError("Bimbingan tidak ditemukan.");
  assertAccess(canDecideStage(user, b.client.studyProgramId), "Hanya kaprodi/admin prodi ini.");
  return b;
}

const examinerSchema = z.object({
  name: z.string().trim().min(1, "Nama penguji wajib diisi.").max(120),
  role: z.string().trim().min(1).max(40),
});

const upsertDefenseSchema = z.object({
  bimbinganId: z.coerce.number().int().positive(),
  defenseId: z.coerce.number().int().positive().optional(),
  scheduledAt: z.string().trim().optional(),
  location: z.string().trim().max(200).optional(),
  examiners: z.array(examinerSchema).max(10).optional(),
});

export async function upsertDefense(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { bimbinganId, defenseId, scheduledAt, location, examiners } = upsertDefenseSchema.parse(input);
    await assertDefenseManager(user, bimbinganId);

    let when: Date | null = null;
    if (scheduledAt) {
      const d = new Date(scheduledAt);
      if (Number.isNaN(d.getTime())) return { ok: false, error: "Tanggal sidang tidak valid." };
      when = d;
    }
    const data = {
      scheduledAt: when,
      location: location || null,
      examiners: examiners && examiners.length ? JSON.stringify(examiners) : null,
    };

    let id = defenseId;
    if (id) {
      const ex = await prisma.defense.findUnique({ where: { id }, select: { bimbinganId: true } });
      if (!ex || ex.bimbinganId !== bimbinganId) throw new ForbiddenError("Sidang tidak ditemukan.");
      await prisma.defense.update({ where: { id }, data });
    } else {
      const created = await prisma.defense.create({ data: { ...data, bimbinganId, createdByUserId: user.id } });
      id = created.id;
    }
    await writeAudit({ actor: user, action: "defense.upsert", targetType: "defense", targetId: id, metadata: { bimbinganId } });
    revalidatePath("/sidang");
    return { ok: true, message: "Jadwal sidang tersimpan." };
  } catch (e) {
    return fail(e);
  }
}

const defenseResultSchema = z.object({
  defenseId: z.coerce.number().int().positive(),
  status: z.enum(["scheduled", "done", "cancelled"]),
  result: z.enum(["lulus", "lulus_revisi", "tidak_lulus"]).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export async function setDefenseResult(input: unknown): Promise<ActionResult> {
  try {
    const user = await requireUser();
    const { defenseId, status, result, notes } = defenseResultSchema.parse(input);
    const d = await prisma.defense.findUnique({
      where: { id: defenseId },
      select: { bimbinganId: true, bimbingan: { select: { clientUserId: true, client: { select: { coreUserId: true } } } } },
    });
    if (!d) throw new ForbiddenError("Sidang tidak ditemukan.");
    await assertDefenseManager(user, d.bimbinganId);

    await prisma.defense.update({
      where: { id: defenseId },
      data: { status, result: status === "done" ? (result ?? null) : null, notes: notes ?? null },
    });
    await writeAudit({
      actor: user,
      action: "defense.result",
      targetType: "defense",
      targetId: defenseId,
      metadata: { status, result: result ?? null },
    });

    if (status === "done" && result) {
      await createNotification({
        userId: d.bimbingan.clientUserId,
        coreUserId: d.bimbingan.client.coreUserId,
        type: "defense_result",
        title: "Hasil sidang",
        body: `Sidang akhirmu dinyatakan: ${result === "lulus" ? "Lulus" : result === "lulus_revisi" ? "Lulus dengan revisi" : "Tidak lulus"}.`,
        color: result === "tidak_lulus" ? "warning" : "success",
        actionUrl: "/progres",
      });
    }
    revalidatePath("/sidang");
    return { ok: true, message: "Hasil sidang tersimpan." };
  } catch (e) {
    return fail(e);
  }
}