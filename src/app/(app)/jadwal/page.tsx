import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { getOrCreateCalendarToken } from "@/lib/calendar";
import { SectionTitle, Badge, EmptyState } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { RequestScheduleForm, TutorScheduleActions, SessionNotesDialog, KlienScheduleActions } from "@/components/features/jadwal-actions";
import { CalendarSubscribe } from "@/components/features/calendar-subscribe";
import { IconCalendar, IconVideo, IconClock } from "@/components/icons";
import { tanggalRail, waktu, SCHEDULE_STATUS_LABEL, nowMs, meetJoinState, MEET_JOIN_LABEL, recordingState } from "@/lib/format";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3100";

type ScheduleRow = Awaited<ReturnType<typeof loadSchedules>>[number];

async function loadSchedules(where: object) {
  return prisma.schedule.findMany({
    where,
    orderBy: { scheduledAt: "desc" },
    include: {
      tutor: { select: { name: true } },
      klien: { select: { name: true } },
    },
  });
}

export default async function JadwalPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  const isKlien = user.role === "klien";
  const statusLabel = (status: string) =>
    status === "menunggu_klien" && user.role === "tutor" ? "Menunggu klien" : SCHEDULE_STATUS_LABEL[status];

  if (isKlien && !(await hasThesisAccess(user.id))) {
    return (
      <div className="space-y-6">
        <SectionTitle />
        <NoAccess accountUrl={ACCOUNT_URL} />
      </div>
    );
  }

  const where =
    user.role === "tutor" ? { tutorId: user.id } : user.role === "klien" ? { klienId: user.id } : {};
  const schedules = await loadSchedules(where);

  const now = nowMs();
  const upcoming = schedules
    .filter((s) => s.scheduledAt.getTime() >= now && s.status !== "selesai" && s.status !== "rejected")
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime());
  const past = schedules.filter((s) => !upcoming.includes(s));

  const calendarUrl =
    user.role !== "admin"
      ? `${APP_URL}/api/calendar/${await getOrCreateCalendarToken(user.id)}`
      : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <SectionTitle
        eyebrow="Jadwal & sesi"
        title="Sesi bimbingan"
        desc={isKlien ? "Ajukan sesi baru, lalu pantau sesi yang akan datang dan riwayatnya di sini." : "Setujui atau usulkan waktu, gabung Google Meet, lalu catat hasil tiap sesi."}
        action={isKlien ? <RequestScheduleForm /> : undefined}
      />

      <Timeline
        heading="Akan datang"
        rows={upcoming}
        empty={
          <EmptyState
            icon={<IconCalendar className="h-6 w-6" />}
            title="Belum ada sesi terjadwal"
            desc={isKlien ? "Ajukan sesi pertamamu lewat tombol di atas." : "Sesi baru dari klien akan muncul di sini."}
          />
        }
        now={now}
        role={user.role}
        statusLabel={statusLabel}
      />

      {past.length > 0 ? (
        <Timeline heading="Riwayat" rows={past} now={now} role={user.role} statusLabel={statusLabel} muted />
      ) : null}

      {calendarUrl ? <CalendarSubscribe url={calendarUrl} /> : null}
    </div>
  );
}

function Timeline({
  heading,
  rows,
  empty,
  now,
  role,
  statusLabel,
  muted = false,
}: {
  heading: string;
  rows: ScheduleRow[];
  empty?: React.ReactNode;
  now: number;
  role: string;
  statusLabel: (s: string) => string;
  muted?: boolean;
}) {
  return (
    <section className="space-y-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{heading}</h3>
      {rows.length === 0 ? (
        empty
      ) : (
        <ol className="space-y-3">
          {rows.map((s) => (
            <SessionRow key={s.id} s={s} now={now} role={role} statusLabel={statusLabel} muted={muted} />
          ))}
        </ol>
      )}
    </section>
  );
}

function SessionRow({
  s,
  now,
  role,
  statusLabel,
  muted,
}: {
  s: ScheduleRow;
  now: number;
  role: string;
  statusLabel: (s: string) => string;
  muted: boolean;
}) {
  const rail = tanggalRail(s.scheduledAt);
  const joinState = meetJoinState(s.scheduledAt, now);
  const rec = s.status === "selesai" ? recordingState(s.recordingLink) : null;

  const dotTone =
    s.status === "approved" ? "bg-brand-500"
    : s.status === "selesai" ? "bg-emerald-500"
    : s.status === "rejected" ? "bg-rose-400"
    : s.status === "menunggu_klien" ? "bg-amber-400"
    : "bg-border";

  return (
    <li className="flex gap-3 sm:gap-4">
      {/* Rail tanggal + garis waktu; dot status berada DI garis (bukan mengambang) */}
      <div className="flex w-12 shrink-0 flex-col items-center sm:w-14">
        <div className={`flex w-full flex-col items-center rounded-xl border px-1 py-1.5 ${muted ? "border-border bg-muted/40" : "border-brand-200 bg-brand-50"}`}>
          <span className={`text-base font-bold leading-none ${muted ? "text-foreground" : "text-brand-700"}`}>{rail.day}</span>
          <span className={`text-[11px] font-semibold uppercase ${muted ? "text-muted-foreground" : "text-brand-600"}`}>{rail.month}</span>
        </div>
        <span className="mt-1.5 flex items-center gap-0.5 text-[11px] font-medium tabular-nums text-muted-foreground">
          <IconClock className="size-2.5" /> {waktu(s.scheduledAt)}
        </span>
        <span aria-hidden className={`mt-2 size-2.5 shrink-0 rounded-full ring-4 ring-background ${dotTone}`} />
        <span aria-hidden className={`w-px flex-1 ${muted ? "bg-border" : "bg-brand-100"}`} />
      </div>

      {/* Kartu sesi */}
      <div className="min-w-0 flex-1 rounded-2xl border border-border bg-card p-4 transition-colors hover:border-brand-200 sm:p-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {s.sesiKe ? (
                <span className="inline-flex shrink-0 items-center rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  Pertemuan {s.sesiKe}
                </span>
              ) : null}
              <p className="truncate text-sm font-semibold text-foreground">{s.topic}</p>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {role === "tutor" ? `dengan ${s.klien.name}` : `dengan ${s.tutor.name}`}
            </p>
          </div>
          <Badge value={s.status} label={statusLabel(s.status)} />
        </div>

        {s.status === "approved" && s.gmeetLink ? (
          <div className="mt-3">
            {joinState === "open" ? (
              <a href={s.gmeetLink} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-500 px-3.5 text-sm font-medium text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                <IconVideo className="h-4 w-4" /> Gabung Google Meet
              </a>
            ) : (
              <p className="inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-medium text-muted-foreground" title={joinState === "too_early" ? "Tautan aktif 15 menit sebelum jadwal" : "Sesi telah lewat 90 menit dari jadwal"}>
                <IconVideo className="h-4 w-4" /> {MEET_JOIN_LABEL[joinState]}
              </p>
            )}
          </div>
        ) : null}

        {s.tutorNote ? (
          <div className="mt-3 rounded-xl bg-muted/60 p-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Catatan tutor</p>
            <p className="mt-0.5 text-xs text-ink-soft">{s.tutorNote}</p>
          </div>
        ) : null}

        {rec === "ready" ? (
          <a href={s.recordingLink!} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-sm font-medium text-brand-700 hover:bg-brand-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
            <IconVideo className="h-4 w-4" /> Tonton rekaman
          </a>
        ) : rec === "unavailable" ? (
          <p className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-medium text-muted-foreground">
            <IconVideo className="h-4 w-4" /> Rekaman tidak tersedia
          </p>
        ) : rec === "processing" ? (
          <p className="mt-2 inline-flex h-9 items-center gap-1.5 rounded-full bg-muted px-3.5 text-sm font-medium text-muted-foreground">
            <IconClock className="h-4 w-4" /> Rekaman sedang diproses
          </p>
        ) : null}

        {role === "klien" ? <KlienScheduleActions id={s.id} status={s.status} /> : null}
        {role === "tutor" ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <TutorScheduleActions id={s.id} status={s.status} />
            {s.status === "approved" || s.status === "selesai" ? (
              <SessionNotesDialog id={s.id} currentNote={s.tutorNote} currentRecording={s.recordingLink} />
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}
