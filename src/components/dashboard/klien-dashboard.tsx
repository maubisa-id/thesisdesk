import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { hasThesisAccess } from "@/lib/entitlement";
import {
  getKlienBimbingan,
  getMilestones,
  summarizeMilestones,
  getUpcomingSchedules,
  getUnreadCount,
} from "@/lib/queries";
import {
  Card,
  StatCard,
  Badge,
  ProgressRing,
  ButtonLink,
  Reveal,
  EmptyState,
  Avatar,
  DashboardHeader,
  SectionHeading,
} from "@/components/kit";
import { NoAccess } from "@/components/states";
import { StageTracker } from "@/components/features/stage-tracker";
import {
  IconFlag,
  IconCalendar,
  IconChat,
  IconArrow,
  IconCap,
  IconClock,
  IconUpload,
} from "@/components/icons";
import {
  tanggalWaktu,
  sisaHari,
  CHAPTER_LABEL,
  CHAPTER_SHORT,
  MILESTONE_STATUS_LABEL,
  SCHEDULE_STATUS_LABEL,
  persen,
  salamWaktu,
} from "@/lib/format";

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.contoh.id";


export async function KlienDashboard({ user }: { user: SessionUser }) {
  const firstName = user.name.split(/\s+/)[0];
  const bimbingan = await getKlienBimbingan(user.id);
  const access = await hasThesisAccess(user.id);

  if (!bimbingan) {
    return (
      <div className="space-y-8">
        <Hero firstName={firstName} title={null} status={null} />
        {!access ? (
          <NoAccess accountUrl={ACCOUNT_URL} />
        ) : (
          <EmptyState
            icon={<IconCap className="h-6 w-6" />}
            title="Ayo mulai bimbingan pertamamu"
            desc="Bimbinganmu sudah aktif. Tim akan menautkan tutor dan menyiapkan milestone BAB I-V."
            action={<ButtonLink href="/progres">Lihat progres</ButtonLink>}
          />
        )}
      </div>
    );
  }

  const [milestones, upcoming, unread, lastLog] = await Promise.all([
    getMilestones(bimbingan.id),
    getUpcomingSchedules(user, 3),
    getUnreadCount(user.id),
    prisma.bimbinganLog.findFirst({
      where: { bimbinganId: bimbingan.id, deletedAt: null },
      orderBy: { createdAt: "desc" },
      select: { summary: true, createdAt: true },
    }),
  ]);

  const pendingStage = await prisma.stageApproval.findFirst({
    where: { bimbinganId: bimbingan.id, status: "pending" },
    select: { id: true },
  });

  const progress = summarizeMilestones(milestones);
  const nextTodo = milestones.find((m) => m.status !== "done" && m.status !== "blocked");
  const nextSchedule = upcoming[0];

  return (
    <div className="space-y-8">
      <Hero firstName={firstName} title={bimbingan.thesisTitle} status={bimbingan.status} />

      <StageTracker
        bimbinganId={bimbingan.id}
        stage={bimbingan.stage}
        pending={!!pendingStage}
        canRequest
      />

      <BimbinganSummary
        thesisTitle={bimbingan.thesisTitle}
        serviceType={bimbingan.serviceType}
        status={bimbingan.status}
        tutorName={bimbingan.tutor?.name ?? null}
        tutorAvatar={bimbingan.tutor?.avatarUrl ?? null}
        lastNote={lastLog?.summary ?? null}
        progressPct={progress.pct}
        progressDone={progress.done}
        progressTotal={progress.total}
        nextTopic={nextSchedule ? nextSchedule.topic : null}
        nextWhen={nextSchedule ? nextSchedule.scheduledAt : null}
      />

      <QuickActions unread={unread} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Reveal>
          <StatCard
            icon={<IconFlag className="h-5 w-5" />}
            label="Progres BAB"
            value={persen(progress.pct)}
            hint={`${progress.done}/${progress.total} milestone selesai`}
          />
        </Reveal>
        <Reveal delay={60}>
          <StatCard
            icon={<IconCalendar className="h-5 w-5" />}
            label="Sesi terdekat"
            value={nextSchedule ? (sisaHari(nextSchedule.scheduledAt) ?? 0) + " hari" : "-"}
            hint={nextSchedule ? nextSchedule.topic : "Belum ada jadwal"}
            accent="text-brand-600"
          />
        </Reveal>
        <Reveal delay={120}>
          <StatCard
            icon={<IconChat className="h-5 w-5" />}
            label="Pesan belum dibaca"
            value={unread}
            hint={bimbingan.tutor ? `dari ${bimbingan.tutor.name.split(/\s+/)[0]}` : "-"}
            accent="text-teal"
          />
        </Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Reveal delay={120}>
          <Card className="p-6 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Progres skripsi
                </p>
                <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-ink">
                  Di mana kamu sekarang
                </h2>
              </div>
              <Link
                href="/progres"
                className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700"
              >
                Lihat papan <IconArrow className="h-4 w-4" />
              </Link>
            </div>

            <div className="mt-6 flex items-center gap-6">
              <ProgressRing value={progress.pct} size={104} stroke={11}>
                <div className="text-center">
                  <div className="font-display text-2xl font-bold text-ink">{persen(progress.pct)}</div>
                  <div className="text-[11px] uppercase tracking-wide text-muted-foreground">selesai</div>
                </div>
              </ProgressRing>
              <div className="min-w-0 flex-1 space-y-2">
                {["proposal", "bab1", "bab2", "bab3", "bab4", "bab5"].map((ch) => {
                  const c = progress.perChapter.find((p) => p.chapter === ch);
                  const pct = c && c.total ? (c.done / c.total) * 100 : 0;
                  return (
                    <div key={ch} className="flex items-center gap-3">
                      <span className="w-16 shrink-0 text-xs font-medium text-muted-foreground">
                        {CHAPTER_SHORT[ch]}
                      </span>
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-50">
                        <div
                          className="h-full rounded-full bg-brand-500 transition-all duration-700"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {nextTodo ? (
              <div className="mt-6 rounded-2xl bg-brand-50 p-4 ring-1 ring-brand-600/10">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-600">
                  Langkah berikutnya
                </p>
                <p className="mt-1 text-sm font-semibold text-ink">{nextTodo.title}</p>
                <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                  {CHAPTER_LABEL[nextTodo.chapter]}
                  <Badge value={nextTodo.status} label={MILESTONE_STATUS_LABEL[nextTodo.status]} />
                </p>
              </div>
            ) : (
              <div className="mt-6 rounded-2xl bg-lime-50 p-4 text-sm font-medium text-lime-700 ring-1 ring-lime-600/15">
                Semua milestone selesai - saatnya bersiap sidang! 🎓
              </div>
            )}
          </Card>
        </Reveal>

        <div className="space-y-6">
          <Reveal delay={180}>
            <Card className="p-6">
                <SectionHeading title="Sesi bimbingan" action={
                  <Link href="/jadwal" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
                    Kelola
                  </Link>
                } />
                {nextSchedule ? (
                <div className="mt-4 space-y-3">
                  {upcoming.map((s) => (
                    <div key={s.id} className="rounded-2xl bg-muted/40 p-4 ring-1 ring-border">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink">{s.topic}</p>
                        <Badge value={s.status} label={SCHEDULE_STATUS_LABEL[s.status]} />
                      </div>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <IconClock className="h-3.5 w-3.5" /> {tanggalWaktu(s.scheduledAt)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-muted-foreground">
                  Belum ada sesi terjadwal.{" "}
                  <Link href="/jadwal" className="font-semibold text-brand-600">
                    Ajukan sesi pertama
                  </Link>
                  .
                </p>
              )}
            </Card>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

// Kartu Bimbingan: ringkasan konteks skripsi (judul, tutor, status, catatan terakhir).
// Diadopsi dari IA UI lama (kartu profil) - recognition over recall (H6): satu pandang tahu
// "skripsi apa, dengan siapa, catatan terakhir apa" tanpa harus mengingat/menggali.
function BimbinganSummary({
  thesisTitle,
  serviceType,
  status,
  tutorName,
  tutorAvatar,
  lastNote,
  progressPct,
  progressDone,
  progressTotal,
  nextTopic,
  nextWhen,
}: {
  thesisTitle: string | null;
  serviceType: string;
  status: string;
  tutorName: string | null;
  tutorAvatar: string | null;
  lastNote: string | null;
  progressPct: number;
  progressDone: number;
  progressTotal: number;
  nextTopic: string | null;
  nextWhen: Date | null;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="grid grid-cols-1 gap-0 lg:grid-cols-[1.4fr_1fr]">
        {/* Kiri: judul + progres */}
        <div className="p-6 sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-brand-700 ring-1 ring-brand-600/15">
              {serviceType}
            </span>
            <Badge value={status} label={status === "ongoing" ? "Sedang berjalan" : status} />
          </div>
          <p className="mt-4 text-xs font-medium uppercase tracking-wide text-muted-foreground">Judul penelitian</p>
          <p
            title={thesisTitle ?? undefined}
            className="mt-1 line-clamp-2 font-heading text-lg font-bold leading-snug tracking-tight text-foreground"
          >
            {thesisTitle ?? "Belum diisi"}
          </p>

          <div className="mt-5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-muted-foreground">Progres bimbingan</span>
              <span className="font-semibold text-primary">{progressDone}/{progressTotal} milestone · {persen(progressPct)}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-brand-400 transition-[width] duration-700 ease-out" style={{ width: `${progressPct}%` }} />
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href="/progres" className="press inline-flex min-h-9 items-center gap-1.5 rounded-full bg-brand-500 px-4 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-brand-600">
              Lihat papan progres <IconArrow className="size-3.5" />
            </Link>
          </div>
        </div>

        {/* Kanan: tutor + sesi berikutnya + catatan */}
        <div className="space-y-4 border-t border-border bg-muted/30 p-6 sm:p-7 lg:border-l lg:border-t-0">
          <div className="flex items-center gap-3">
            <Avatar name={tutorName ?? "?"} url={tutorAvatar} size={44} />
            <div className="min-w-0 leading-tight">
              <p className="text-xs text-muted-foreground">Tutor pembimbing</p>
              <p className="truncate text-sm font-semibold text-foreground">{tutorName ?? "Belum ditugaskan"}</p>
            </div>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/70 p-3">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <IconCalendar className="size-3.5" /> Sesi berikutnya
            </p>
            {nextTopic ? (
              <>
                <p className="mt-1 line-clamp-1 text-sm font-semibold text-foreground">{nextTopic}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{nextWhen ? tanggalWaktu(nextWhen) : ""}</p>
              </>
            ) : (
              <p className="mt-1 text-sm text-muted-foreground">
                Belum ada. <Link href="/jadwal" className="font-semibold text-brand-600">Ajukan sesi</Link>.
              </p>
            )}
          </div>

          {lastNote ? (
            <div className="rounded-xl border border-border/70 bg-card/70 p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Catatan terakhir</p>
              <p className="mt-1 line-clamp-2 text-sm text-foreground">{lastNote}</p>
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// Aksi Cepat: pintasan ke tugas inti (H7 efisiensi, Fitts's Law target besar & dekat).
// Diadopsi dari UI lama - kurangi klik ke tugas utama (blueprint: <=3 klik).
function QuickActions({ unread }: { unread: number }) {
  const actions: { href: string; label: string; sub: string; icon: typeof IconCalendar; badge?: number }[] = [
    { href: "/jadwal", label: "Ajukan jadwal", sub: "Buat sesi bimbingan", icon: IconCalendar },
    { href: "/dokumen", label: "Unggah dokumen", sub: "Kirim draft ke tutor", icon: IconUpload },
    { href: "/chat", label: "Chat tutor", sub: "Diskusi cepat", icon: IconChat, badge: unread },
  ];
  return (
    <div>
      <h2 className="mb-3 font-heading text-base font-semibold tracking-tight text-foreground">Aksi cepat</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map((a) => {
          const Icon = a.icon;
          return (
            <Link
              key={a.href}
              href={a.href}
              className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent"
            >
              <span className="relative flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon className="size-5" />
                {a.badge ? (
                  <span className="absolute -right-1 -top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[11px] font-bold text-primary-foreground">
                    {a.badge}
                  </span>
                ) : null}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground">{a.label}</p>
                <p className="truncate text-xs text-muted-foreground">{a.sub}</p>
              </div>
              <IconArrow className="ml-auto size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function Hero({
  firstName,
  title,
  status,
}: {
  firstName: string;
  title: string | null;
  status: string | null;
}) {
  void title;
  void status;
  return (
    <DashboardHeader
      eyebrow={salamWaktu()}
      title={<>Halo, {firstName} <span className="inline-block align-baseline">👋</span></>}
      desc="Senang kamu kembali. Semua progres skripsimu ada di sini. Kita jalani bareng tutor, selangkah demi selangkah sampai sidang."
      icon={<IconCap className="size-8" />}
    />
  );
}
