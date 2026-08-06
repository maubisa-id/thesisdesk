/* Seed thesis-next (SQLite lokal). Membuat akun Better Auth (email+password) + data domain
 * realistis: admin, 2 tutor, 3 klien dengan bimbingan, milestone, jadwal, dokumen+anotasi,
 * chat, reminder, entitlement, template feedback, dan jejak audit.
 *
 * Jalankan: npm run seed   (butuh DB sudah di-push: npm run db:setup)
 * Login demo (semua kata sandi: "password123"):
 *   admin@maubisa.id · andi.tutor@maubisa.id · sinta.tutor@maubisa.id
 *   rina@student.ac.id · dinda@student.ac.id · bagus@student.ac.id
 */
import { PrismaClient } from "@prisma/client";
import { auth } from "../src/lib/auth";

const prisma = new PrismaClient();
const PASSWORD = "password123";

const day = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * day);
const daysAhead = (n: number) => new Date(Date.now() + n * day);
const at = (base: Date, h: number, m = 0) => {
  const d = new Date(base);
  d.setHours(h, m, 0, 0);
  return d;
};

async function wipe() {
  // Urutan aman (anak dulu). SQLite FK cascade juga aktif, tapi eksplisit lebih jelas.
  await prisma.institution.deleteMany();
  await prisma.faculty.deleteMany();
  await prisma.feedbackTemplate.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.reminder.deleteMany();
  await prisma.documentAnnotation.deleteMany();
  await prisma.bimbinganLog.deleteMany();
  await prisma.milestone.deleteMany();
  await prisma.module.deleteMany();
  await prisma.message.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.bimbingan.deleteMany();
  await prisma.entitlement.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.authTwoFactor.deleteMany();
  await prisma.authSession.deleteMany();
  await prisma.authAccount.deleteMany();
  await prisma.authVerification.deleteMany();
  await prisma.authUser.deleteMany();
}

// Buat akun via Better Auth (menghasilkan AuthUser + credential + baris users lewat databaseHook).
async function createAccount(name: string, email: string) {
  try {
    await auth.api.signUpEmail({ body: { name, email, password: PASSWORD } });
  } catch (e) {
    console.warn(`  signup ${email} gagal (mungkin sudah ada): ${(e as Error).message}`);
  }
  const u = await prisma.user.findUnique({ where: { email } });
  if (!u) throw new Error(`User ${email} tidak terbentuk`);
  return u;
}

async function main() {
  console.log("• Membersihkan data lama…");
  await wipe();

  // Institusi demo (singleton) -> setup wizard dilewati saat demo sudah ter-seed.
  await prisma.institution.create({ data: { name: "Kampus Demo" } });

  // Struktur akademik contoh (Fakultas -> Prodi).
  const ft = await prisma.faculty.create({ data: { name: "Fakultas Teknik", code: "FT" } });
  await prisma.studyProgram.createMany({
    data: [
      { facultyId: ft.id, name: "Teknik Informatika", code: "TI", level: "S1" },
      { facultyId: ft.id, name: "Sistem Informasi", code: "SI", level: "S1" },
    ],
  });

  console.log("• Membuat akun (Better Auth)…");
  const admin = await createAccount("Admin Maubisa", "admin@maubisa.id");
  const andi = await createAccount("Andi Prasetyo", "andi.tutor@maubisa.id");
  const sinta = await createAccount("Sinta Rahmawati", "sinta.tutor@maubisa.id");
  const rina = await createAccount("Rina Kusuma", "rina@student.ac.id");
  const dinda = await createAccount("Dinda Ayu", "dinda@student.ac.id");
  const bagus = await createAccount("Bagus Santoso", "bagus@student.ac.id");

  console.log("• Menyetel peran, coreUserId, tutor…");
  await prisma.user.update({ where: { id: admin.id }, data: { role: "admin", coreUserId: 1001, phone: "6281100000001" } });
  await prisma.user.update({ where: { id: andi.id }, data: { role: "tutor", coreUserId: 1002, phone: "6281100000002", lastSeenAt: daysAgo(0) } });
  await prisma.user.update({ where: { id: sinta.id }, data: { role: "tutor", coreUserId: 1003, phone: "6281100000003", lastSeenAt: daysAgo(0) } });
  await prisma.user.update({ where: { id: rina.id }, data: { role: "klien", coreUserId: 2001, phone: "6281200000001", tutorId: andi.id, lastSeenAt: daysAgo(0) } });
  await prisma.user.update({ where: { id: dinda.id }, data: { role: "klien", coreUserId: 2002, phone: "6281200000002", tutorId: sinta.id, lastSeenAt: daysAgo(1) } });
  await prisma.user.update({ where: { id: bagus.id }, data: { role: "klien", coreUserId: 2003, phone: "6281200000003", tutorId: andi.id, lastSeenAt: daysAgo(9) } });

  // RBAC platform (ADR-005)
  await prisma.userRole.createMany({
    data: [
      { userId: admin.id, role: "admin", scope: "global", grantedBy: admin.id },
      { userId: andi.id, role: "mentor", scope: "thesis", grantedBy: admin.id },
      { userId: sinta.id, role: "mentor", scope: "thesis", grantedBy: admin.id },
    ],
  });

  // Entitlement thesis aktif untuk semua klien (mirror core). Default-deny: tanpa ini → terkunci.
  for (const [u, core] of [[rina, 2001], [dinda, 2002], [bagus, 2003]] as const) {
    await prisma.entitlement.create({
      data: {
        userId: u.id,
        coreUserId: core,
        scope: "thesis",
        productCode: "bimbingan-skripsi",
        status: "active",
        source: "manual",
        startsAt: daysAgo(60),
        expiresAt: daysAhead(120),
      },
    });
  }

  console.log("• Membuat bimbingan…");
  const bimRina = await prisma.bimbingan.create({
    data: {
      clientUserId: rina.id, coreUserId: 2001, tutorUserId: andi.id, serviceType: "skripsi",
      thesisTitle: "Pengaruh Gamifikasi terhadap Motivasi Belajar Mahasiswa",
      status: "ongoing", catatan: "Fokus percepatan BAB IV-V menuju sidang.", createdAt: daysAgo(60),
    },
  });
  const bimDinda = await prisma.bimbingan.create({
    data: {
      clientUserId: dinda.id, coreUserId: 2002, tutorUserId: sinta.id, serviceType: "skripsi",
      thesisTitle: "Analisis Sentimen Ulasan E-Commerce dengan Metode Naive Bayes",
      status: "ongoing", createdAt: daysAgo(45),
    },
  });
  const bimBagus = await prisma.bimbingan.create({
    data: {
      clientUserId: bagus.id, coreUserId: 2003, tutorUserId: andi.id, serviceType: "skripsi",
      thesisTitle: "Sistem Informasi Manajemen Inventaris Berbasis Web",
      status: "ongoing", createdAt: daysAgo(30),
    },
  });

  console.log("• Membuat milestone…");
  type M = { chapter: string; title: string; status: string; due: number };
  async function seedMilestones(bimId: number, ownerId: number, core: number, items: M[]) {
    let sort = 0;
    for (const it of items) {
      await prisma.milestone.create({
        data: {
          bimbinganId: bimId, ownerId, coreUserId: core, chapter: it.chapter, title: it.title,
          status: it.status, sort: sort++, dueDate: daysAhead(it.due),
          completedAt: it.status === "done" ? daysAgo(Math.floor(Math.random() * 20) + 1) : null,
          updatedAt: it.status === "todo" ? daysAgo(10) : daysAgo(Math.floor(Math.random() * 4)),
        },
      });
    }
  }
  await seedMilestones(bimRina.id, rina.id, 2001, [
    { chapter: "proposal", title: "Proposal disetujui pembimbing", status: "done", due: -30 },
    { chapter: "bab1", title: "BAB I - Pendahuluan final", status: "done", due: -20 },
    { chapter: "bab2", title: "BAB II - Tinjauan Pustaka (≥15 rujukan)", status: "done", due: -10 },
    { chapter: "bab3", title: "BAB III - Metodologi & instrumen", status: "done", due: -3 },
    { chapter: "bab4", title: "BAB IV - Analisis data & pembahasan", status: "in_progress", due: 7 },
    { chapter: "bab5", title: "BAB V - Kesimpulan & saran", status: "todo", due: 18 },
    { chapter: "sidang", title: "Latihan sidang & finalisasi slide", status: "todo", due: 28 },
  ]);
  await seedMilestones(bimDinda.id, dinda.id, 2002, [
    { chapter: "proposal", title: "Proposal disetujui", status: "done", due: -25 },
    { chapter: "bab1", title: "BAB I - Pendahuluan", status: "done", due: -15 },
    { chapter: "bab2", title: "BAB II - Landasan teori", status: "in_progress", due: 5 },
    { chapter: "bab3", title: "BAB III - Metode Naive Bayes", status: "todo", due: 20 },
    { chapter: "bab4", title: "BAB IV - Eksperimen & hasil", status: "todo", due: 35 },
    { chapter: "bab5", title: "BAB V - Penutup", status: "todo", due: 50 },
  ]);
  await seedMilestones(bimBagus.id, bagus.id, 2003, [
    { chapter: "proposal", title: "Proposal - revisi latar belakang", status: "in_progress", due: 3 },
    { chapter: "bab1", title: "BAB I - Pendahuluan", status: "blocked", due: 14 },
    { chapter: "bab2", title: "BAB II - Tinjauan Pustaka", status: "todo", due: 28 },
    { chapter: "bab3", title: "BAB III - Metodologi", status: "todo", due: 42 },
  ]);

  console.log("• Membuat jadwal sesi…");
  await prisma.schedule.createMany({
    data: [
      { tutorId: andi.id, klienId: rina.id, topic: "Review analisis data BAB IV", scheduledAt: at(daysAhead(2), 15), status: "approved", session: "Sesi 8", sesiKe: 8, gmeetLink: "https://meet.google.com/abc-defg-hij", createdAt: daysAgo(3) },
      { tutorId: andi.id, klienId: rina.id, topic: "Diskusi hasil uji statistik", scheduledAt: at(daysAgo(6), 14), status: "selesai", session: "Sesi 7", sesiKe: 7, tutorNote: "Uji reliabilitas OK; lanjut interpretasi.", recordingLink: "https://drive.google.com/rec", createdAt: daysAgo(10) },
      { tutorId: andi.id, klienId: rina.id, topic: "Konsultasi kerangka BAB II", scheduledAt: at(daysAgo(12), 10), status: "selesai", session: "Sesi 6", sesiKe: 6, tutorNote: "Perkuat state of the art; tambah 5 jurnal terbaru.", recordingLink: "tidak_ada", createdAt: daysAgo(14) },
      { tutorId: andi.id, klienId: rina.id, topic: "Bedah rumusan masalah", scheduledAt: at(daysAgo(2), 9), status: "selesai", session: "Sesi 9", sesiKe: 9, tutorNote: "Rumusan sudah tajam; siap lanjut proposal.", createdAt: daysAgo(3) },
      { tutorId: sinta.id, klienId: dinda.id, topic: "Bimbingan penulisan BAB II", scheduledAt: at(daysAhead(4), 10), status: "pending", session: "Sesi 5", createdAt: daysAgo(1) },
      { tutorId: andi.id, klienId: bagus.id, topic: "Perbaikan latar belakang & rumusan masalah", scheduledAt: at(daysAhead(1), 13), status: "menunggu_klien", session: "Sesi 3", createdAt: daysAgo(2) },
    ],
  });

  console.log("• Membuat dokumen + anotasi…");
  const docRina = await prisma.module.create({
    data: {
      title: "Draft BAB IV - Hasil & Pembahasan", originalName: "BAB4-Rina-v2.pdf",
      filePath: "portal/rina/bab4-v2.pdf", fileSize: 842_000, fileMime: "application/pdf",
      uploaderId: rina.id, receiverId: andi.id, note: "Mohon dicek bagian interpretasi tabel 4.3.",
      reviewStatus: "reviewed", version: 2, createdAt: daysAgo(5),
    },
  });
  await prisma.documentAnnotation.createMany({
    data: [
      { moduleId: docRina.id, bimbinganId: bimRina.id, authorUserId: andi.id, anchor: JSON.stringify({ page: 12, rect: [80, 220, 380, 20], quote: "Tabel 4.3 menunjukkan…" }), body: "Interpretasi masih deskriptif. Kaitkan dengan hipotesis H2 dan teori di BAB II.", resolved: false, createdAt: daysAgo(4) },
      { moduleId: docRina.id, bimbinganId: bimRina.id, authorUserId: andi.id, anchor: JSON.stringify({ page: 14, rect: [70, 140, 400, 20], quote: "Berdasarkan hasil uji…" }), body: "Cantumkan nilai signifikansi (p) dan ukuran efeknya, bukan hanya 'signifikan'.", resolved: true, createdAt: daysAgo(4) },
    ],
  });
  const docDinda = await prisma.module.create({
    data: {
      title: "Draft BAB II - Landasan Teori", originalName: "BAB2-Dinda.docx",
      filePath: "portal/dinda/bab2.docx", fileSize: 512_000, fileMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      uploaderId: dinda.id, receiverId: sinta.id, note: "Draft awal, mohon arahan struktur.",
      reviewStatus: "uploaded", version: 1, createdAt: daysAgo(1),
    },
  });
  await prisma.documentAnnotation.create({
    data: { moduleId: docDinda.id, bimbinganId: bimDinda.id, authorUserId: sinta.id, body: "Struktur sudah oke. Perbanyak sumber primer (jurnal), kurangi sitasi dari blog.", resolved: false, createdAt: daysAgo(0) },
  });
  await prisma.module.create({
    data: {
      title: "Proposal - revisi 1", originalName: "Proposal-Bagus.pdf",
      filePath: "portal/bagus/proposal-r1.pdf", fileSize: 388_000, fileMime: "application/pdf",
      uploaderId: bagus.id, receiverId: andi.id, reviewStatus: "uploaded", version: 1, createdAt: daysAgo(8),
    },
  });

  console.log("• Membuat pesan chat…");
  await prisma.message.createMany({
    data: [
      { senderId: rina.id, receiverId: andi.id, content: "Pak, saya sudah upload draft BAB IV versi 2. Mohon direview ya 🙏", roleSender: "klien", readAt: daysAgo(4), createdAt: daysAgo(5) },
      { senderId: andi.id, receiverId: rina.id, content: "Sudah saya lihat, Rina. Ada 2 anotasi di dokumen - cek bagian interpretasi tabel 4.3.", roleSender: "tutor", readAt: daysAgo(4), createdAt: daysAgo(4) },
      { senderId: rina.id, receiverId: andi.id, content: "Baik Pak, saya perbaiki. Untuk sesi berikutnya bisa hari Rabu?", roleSender: "klien", createdAt: daysAgo(1) },
      { senderId: sinta.id, receiverId: dinda.id, content: "Dinda, untuk BAB II jangan lupa sumber primer ya, hindari blog.", roleSender: "tutor", createdAt: daysAgo(2) },
      { senderId: bagus.id, receiverId: andi.id, content: "Pak, saya masih bingung menentukan rumusan masalah…", roleSender: "klien", createdAt: daysAgo(9) },
    ],
  });

  console.log("• Membuat log bimbingan…");
  await prisma.bimbinganLog.create({
    data: {
      bimbinganId: bimRina.id, authorUserId: andi.id,
      summary: "Membahas hasil uji statistik. Reliabilitas instrumen baik (α=0.87). Perlu memperkuat interpretasi.",
      actionItems: JSON.stringify([
        { text: "Revisi interpretasi tabel 4.3", done: false },
        { text: "Tambah pembahasan kaitan teori", done: false },
        { text: "Siapkan draft BAB V", done: false },
      ]),
      createdAt: daysAgo(6),
    },
  });

  console.log("• Membuat pustaka template feedback tutor…");
  await prisma.feedbackTemplate.createMany({
    data: [
      // Pustaka bersama (owner null, shared): tersedia untuk semua tutor.
      { ownerUserId: null, scope: "shared", category: "metodologi", sortOrder: 1, title: "Justifikasi metode kurang", body: "Jelaskan mengapa metode {{metode}} dipilih dan bagaimana ia menjawab rumusan masalah. Tambahkan rujukan pendukung." },
      { ownerUserId: null, scope: "shared", category: "sitasi", sortOrder: 2, title: "Sitasi perlu diperkuat", body: "Perkuat klaim ini dengan sitasi primer 5 tahun terakhir, dan pastikan format {{gaya}} konsisten." },
      { ownerUserId: null, scope: "shared", category: "struktur", sortOrder: 3, title: "Alur paragraf", body: "Satu paragraf sebaiknya memuat satu gagasan. Pecah paragraf ini agar argumen mengalir lebih jelas." },
      { ownerUserId: null, scope: "shared", category: "bahasa", sortOrder: 4, title: "Bahasa akademik", body: "Hindari bahasa lisan atau opini tanpa dasar. Ganti frasa '{{frasa}}' dengan istilah yang lebih baku dan objektif." },
      { ownerUserId: null, scope: "shared", category: "data", sortOrder: 5, title: "Interpretasi hasil", body: "Angka sudah ditampilkan, tetapi maknanya belum dibahas. Jelaskan apa arti temuan ini terhadap hipotesis." },
      { ownerUserId: null, scope: "shared", category: "umum", sortOrder: 6, title: "Bagus, pertahankan", body: "Bagian ini sudah kuat. Pertahankan kualitas argumennya di bab berikutnya." },
      // Template pribadi Andi (tutor): hanya muncul untuk Andi.
      { ownerUserId: andi.id, scope: "private", category: "metodologi", sortOrder: 1, usageCount: 4, title: "Uji asumsi klasik", body: "Sebelum analisis regresi, lampirkan uji normalitas dan multikolinearitas beserta tabelnya di lampiran." },
      { ownerUserId: andi.id, scope: "private", category: "data", sortOrder: 2, usageCount: 2, title: "Pelaporan PLS-SEM", body: "Sertakan nilai AVE, CR, dan R-square, lalu bahas apakah memenuhi ambang (AVE > 0.5, CR > 0.7)." },
    ],
  });

  console.log("• Membuat reminder…");
  await prisma.reminder.create({
    data: { ownerId: rina.id, coreUserId: 2001, bimbinganId: bimRina.id, channel: "inapp", remindAt: at(daysAhead(1), 9), status: "scheduled", payload: JSON.stringify({ title: "Sesi bimbingan besok", body: "Ingat, sesi \"Review analisis data BAB IV\" dijadwalkan besok jam 15:00.", actionUrl: "/jadwal" }) },
  });
  // Pengingat yang sudah jatuh tempo (demo lazy-cron): akan jadi notifikasi saat rina buka halaman.
  await prisma.reminder.create({
    data: { ownerId: rina.id, coreUserId: 2001, bimbinganId: bimRina.id, channel: "inapp", remindAt: daysAgo(0), status: "scheduled", payload: JSON.stringify({ title: "Deadline milestone mendekat", body: "BAB IV - Analisis data & pembahasan jatuh tempo minggu ini. Tetap semangat!", actionUrl: "/progres" }) },
  });

  console.log("• Membuat jejak audit contoh…");
  await prisma.auditLog.createMany({
    data: [
      { actorCoreUserId: 1002, actorUserId: andi.id, actorRole: "tutor", action: "doc.view", targetType: "module", targetId: String(docRina.id), metadata: JSON.stringify({ version: 2 }), createdAt: daysAgo(4) },
      { actorCoreUserId: 1002, actorUserId: andi.id, actorRole: "tutor", action: "annotation.create", targetType: "module", targetId: String(docRina.id), createdAt: daysAgo(4) },
      { actorCoreUserId: 1001, actorUserId: admin.id, actorRole: "admin", action: "role.change", targetType: "user", targetId: String(andi.id), metadata: JSON.stringify({ to: "mentor:thesis" }), createdAt: daysAgo(20) },
      { actorCoreUserId: 2001, actorUserId: rina.id, actorRole: "klien", action: "login", createdAt: daysAgo(0) },
    ],
  });

  console.log("• Membuat notifikasi contoh…");
  await prisma.notification.createMany({
    data: [
      { userId: rina.id, coreUserId: 2001, type: "schedule_approved", title: "Jadwal disetujui tutor", body: 'Sesi "Review analisis data BAB IV" disetujui. Link Google Meet sudah tersedia.', color: "success", actionUrl: "/jadwal", createdAt: daysAgo(2) },
      { userId: rina.id, coreUserId: 2001, type: "message_new", title: "Pesan baru dari Andi Prasetyo", body: "Sudah saya lihat, ada 2 anotasi di dokumen.", color: "info", actionUrl: "/chat", readAt: daysAgo(3), createdAt: daysAgo(4) },
      { userId: andi.id, coreUserId: 1002, type: "doc_new", title: "Berkas baru masuk 📁", body: "Rina Kusuma mengirim berkas: Draft BAB IV - Hasil & Pembahasan", color: "success", actionUrl: "/dokumen", createdAt: daysAgo(5) },
      { userId: andi.id, coreUserId: 1002, type: "schedule_request", title: "Pengajuan bimbingan baru", body: "Bagus Santoso mengajukan sesi: Perbaikan latar belakang", color: "info", actionUrl: "/jadwal", createdAt: daysAgo(2) },
      { userId: andi.id, coreUserId: 1002, type: "message_new", title: "Pesan baru dari Rina Kusuma", body: "Baik Pak, saya perbaiki. Untuk sesi berikutnya bisa hari Rabu?", color: "info", actionUrl: "/chat", createdAt: daysAgo(1) },
    ],
  });

  console.log("\n✓ Seed selesai. Login (kata sandi: password123):");
  console.log("  admin@maubisa.id · andi.tutor@maubisa.id · rina@student.ac.id\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
