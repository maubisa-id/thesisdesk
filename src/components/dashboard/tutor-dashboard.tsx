import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { getTutorBimbingan, getUpcomingSchedules, getUnreadCount } from "@/lib/queries";
import { Card, StatCard, Badge, Avatar, Reveal, EmptyState, ProgressRing, DashboardHeader, SectionHeading } from "@/components/kit";
import { KlienDetailDialog } from "@/components/features/klien-detail-dialog";
import { IconUsers, IconDoc, IconCalendar, IconChat, IconClock, IconArrow } from "@/components/icons";
import {
  tanggalWaktu,
  waktuRelatif,
  persen,
  nowMs,
  salamWaktu,
  SCHEDULE_STATUS_LABEL,
  REVIEW_STATUS_LABEL,
} from "@/lib/format";

export async function TutorDashboard({ user }: { user: SessionUser }) {
  const firstName = user.name.split(/\s+/)[0];

  const [bimbingan, reviewQueue, upcoming, unread, recentSchedules, recentMsgs] = await Promise.all([
    getTutorBimbingan(user.id),
    prisma.module.findMany({
      where: { receiverId: user.id, reviewStatus: { in: ["uploaded", "in_review"] }, deletedAt: null },
      orderBy: { createdAt: "asc" },
      take: 6,
      include: { uploader: { select: { name: true, avatarUrl: true } } },
    }),
    getUpcomingSchedules(user, 4),
    getUnreadCount(user.id),
    prisma.schedule.findMany({
      where: { tutorId: user.id, scheduledAt: { gte: new Date(nowMs() - 42 * 86_400_000) } },
      select: { scheduledAt: true },
    }),
    prisma.message.findMany({
      where: { receiverId: user.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { sender: { select: { name: true, avatarUrl: true } } },
    }),
  ]);

  const stuck = bimbingan.filter((b) => (b.stuckDays ?? 0) >= 7);
  // Grafik bimbingan: sesi per minggu (6 minggu terakhir) untuk mengisi dashboard dengan data.
  const chartNow = nowMs();
  const weekBuckets = Array.from({ length: 6 }, (_, i) => {
    const startMs = chartNow - (5 - i) * 7 * 86_400_000;
    return { label: `M${i + 1}`, count: 0, startMs: startMs - 7 * 86_400_000, endMs: startMs };
  });
  for (const s of recentSchedules) {
    const t = s.scheduledAt.getTime();
    const b = weekBuckets.find((w) => t > w.startMs && t <= w.endMs);
    if (b) b.count += 1;
  }
  const maxWeek = Math.max(1, ...weekBuckets.map((w) => w.count));

  const focusLine =
    reviewQueue.length > 0
      ? `Ada ${reviewQueue.length} dokumen menunggu review kamu${stuck.length ? `, dan ${stuck.length} klien perlu perhatian ekstra` : ""}.`
      : stuck.length > 0
        ? `${stuck.length} klien perlu perhatian ekstra hari ini.`
        : "Semua antrean beres. Nikmati harimu dan sapa kliennmu, ya!";

  return (
    <div className="space-y-8">
      <DashboardHeader
        eyebrow={salamWaktu()}
        title={<>Halo, {firstName} <span className="inline-block align-baseline">👋</span></>}
        desc={focusLine}
        icon={<IconUsers className="size-8" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal>
          <StatCard icon={<IconUsers className="h-5 w-5" />} label="Klien aktif" value={bimbingan.length} hint={`${stuck.length} perlu perhatian`} attention={stuck.length > 0} />
        </Reveal>
        <Reveal delay={60}>
          <StatCard icon={<IconDoc className="h-5 w-5" />} label="Nunggu review kamu" value={reviewQueue.length} hint="dokumen menunggu" accent="text-brand-600" attention={reviewQueue.length > 0} />
        </Reveal>
        <Reveal delay={120}>
          <StatCard icon={<IconCalendar className="h-5 w-5" />} label="Sesi terjadwal" value={upcoming.length} hint="akan datang" accent="text-teal" />
        </Reveal>
        <Reveal delay={180}>
          <StatCard icon={<IconChat className="h-5 w-5" />} label="Pesan belum dibaca" value={unread} hint={unread > 0 ? "perlu dibalas" : "semua terbalas"} accent="text-lime-accent" attention={unread > 0} />
        </Reveal>
      </div>

      {/* Grafik bimbingan: sesi per minggu (mengisi dashboard dengan insight, bukan ruang kosong) */}
      <Reveal delay={100}>
        <Card className="p-6">
          <SectionHeading
            title="Aktivitas bimbingan"
            sub="Jumlah sesi 6 minggu terakhir"
            action={<span className="rounded-full bg-brand-50 px-3 py-1 text-sm font-semibold text-brand-700">{recentSchedules.length} sesi</span>}
          />
          <div className="mt-6 flex items-end justify-between gap-3" role="img" aria-label={`Sesi per minggu: ${weekBuckets.map((w) => w.count).join(", ")}`}>
            {weekBuckets.map((w) => (
              <div key={w.label} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-semibold text-ink">{w.count}</span>
                <div className="flex h-28 w-full items-end">
                  <div
                    className={`w-full rounded-t-lg transition-[height] duration-500 ${w.count === 0 ? "bg-border" : "bg-gradient-to-t from-primary to-brand-400"}`}
                    style={{ height: w.count === 0 ? "4px" : `${Math.max(12, (w.count / maxWeek) * 100)}%` }}
                  />
                </div>
                <span className="text-[11px] text-muted-foreground">{w.label}</span>
              </div>
            ))}
          </div>
        </Card>
      </Reveal>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Klien yang stuck / semua klien */}
        <Reveal delay={120}>
          <Card className="p-6">
            <SectionHeading title="Klien saya" action={
              <Link href="/klien" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Semua <IconArrow className="h-4 w-4" />
              </Link>
            } />
            {bimbingan.length === 0 ? (
              <EmptyState
                icon={<IconUsers className="h-6 w-6" />}
                title="Belum ada klien"
                desc="Admin belum menugaskan mahasiswa bimbingan untukmu. Klien yang ditugaskan akan muncul di sini beserta progres skripsinya."
              />
            ) : (
              <ul className="mt-4 space-y-3">
                {bimbingan.slice(0, 5).map((b) => (
                  <li key={b.id}>
                    <KlienDetailDialog klienId={b.client.id}>
                      <div className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 ring-1 ring-border transition-colors hover:bg-accent">
                        <Avatar name={b.client.name} url={b.client.avatarUrl} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{b.client.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{b.thesisTitle ?? "-"}</p>
                        </div>
                        {(b.stuckDays ?? 0) >= 7 ? (
                          <Badge value="blocked" label={`Stuck ${b.stuckDays}h`} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <ProgressRing value={b.progress.pct} size={44} stroke={5}>
                              <span className="text-[11px] font-bold tabular-nums text-ink">{persen(b.progress.pct)}</span>
                            </ProgressRing>
                          </div>
                        )}
                      </div>
                    </KlienDetailDialog>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>

        {/* Antrian review */}
        <Reveal delay={180}>
          <Card className="p-6">
            <SectionHeading title="Antrian review" action={
              <Link href="/dokumen" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Buka</Link>
            } />
            {reviewQueue.length === 0 ? (
              <EmptyState icon={<IconDoc className="h-6 w-6" />} title="Tidak ada antrian" desc="Semua dokumen sudah kamu review. Mantap!" />
            ) : (
              <ul className="mt-4 space-y-3">
                {reviewQueue.map((m) => (
                  <li key={m.id}>
                    <Link href={`/dokumen/${m.id}`} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 ring-1 ring-border transition-colors hover:bg-brand-50">
                      <Avatar name={m.uploader.name} url={m.uploader.avatarUrl} size={36} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{m.title ?? m.originalName ?? "Dokumen"}</p>
                        <p className="text-xs text-muted-foreground">{m.uploader.name} · {waktuRelatif(m.createdAt)}</p>
                      </div>
                      <Badge value={m.reviewStatus} label={REVIEW_STATUS_LABEL[m.reviewStatus]} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>

      {/* Jadwal terdekat */}
      <Reveal delay={240}>
        <Card className="p-6">
          <SectionHeading title="Sesi terdekat" action={
            <Link href="/jadwal" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Kelola jadwal</Link>
          } />
          {upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Belum ada sesi terjadwal.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {upcoming.map((s) => (
                <div key={s.id} className="rounded-2xl bg-muted/40 p-4 ring-1 ring-border">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold text-ink">{s.topic}</p>
                    <Badge value={s.status} label={SCHEDULE_STATUS_LABEL[s.status]} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">dengan {s.klien.name}</p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <IconClock className="h-3.5 w-3.5" /> {tanggalWaktu(s.scheduledAt)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </Reveal>

      {/* Pesan terbaru (diadopsi dari dashboard tutor lama, gaya baru) */}
      <Reveal delay={300}>
        <Card className="p-6">
          <SectionHeading title="Pesan terbaru" action={
            <Link href="/chat" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Buka chat</Link>
          } />
          {recentMsgs.length === 0 ? (
            <EmptyState icon={<IconChat className="h-6 w-6" />} title="Belum ada pesan" desc="Pesan dari mahasiswa bimbinganmu akan muncul di sini." />
          ) : (
            <ul className="mt-4 divide-y divide-border">
              {recentMsgs.map((m) => (
                <li key={m.id}>
                  <Link href="/chat" className="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/40">
                    <Avatar name={m.sender.name} url={m.sender.avatarUrl} size={34} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-ink">{m.sender.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{m.content || "Mengirim berkas"}</p>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">{waktuRelatif(m.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </Reveal>
    </div>
  );
}
