import Link from "next/link";
import type { SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { Card, StatCard, Badge, Reveal, DashboardHeader, SectionHeading } from "@/components/kit";
import { IconUsers, IconCap, IconCalendar, IconShield } from "@/components/icons";
import { waktuRelatif, nowMs } from "@/lib/format";

export async function AdminDashboard({ user }: { user: SessionUser }) {
  const firstName = user.name.split(/\s+/)[0];
  const weekAhead = new Date(nowMs() + 7 * 86_400_000);

  const [klienCount, tutorCount, bimbinganActive, sesiWeek, recentAudit, recentBimbingan] =
    await Promise.all([
      prisma.user.count({ where: { role: "klien", deletedAt: null } }),
      prisma.user.count({ where: { role: "tutor", deletedAt: null } }),
      prisma.bimbingan.count({ where: { status: "ongoing", deletedAt: null } }),
      prisma.schedule.count({
        where: { status: { in: ["approved", "pending"] }, scheduledAt: { gte: new Date(), lte: weekAhead } },
      }),
      prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 8 }),
      prisma.bimbingan.findMany({
        where: { deletedAt: null },
        orderBy: { id: "desc" },
        take: 6,
        include: {
          client: { select: { name: true } },
          tutor: { select: { name: true } },
        },
      }),
    ]);

  return (
    <div className="space-y-8">
      <DashboardHeader
        eyebrow="Dashboard admin"
        title={<>Halo, {firstName}.</>}
        desc="Pantau kualitas bimbingan lintas tutor dan klien dalam satu pandang."
        icon={<IconShield className="size-8" />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Reveal><StatCard icon={<IconUsers className="h-5 w-5" />} label="Klien" value={klienCount} hint="Mahasiswa terdaftar" /></Reveal>
        <Reveal delay={60}><StatCard icon={<IconUsers className="h-5 w-5" />} label="Tutor" value={tutorCount} accent="text-teal" hint="Pembimbing aktif" /></Reveal>
        <Reveal delay={120}><StatCard icon={<IconCap className="h-5 w-5" />} label="Bimbingan aktif" value={bimbinganActive} accent="text-brand-600" hint="Sedang berjalan" /></Reveal>
        <Reveal delay={180}><StatCard icon={<IconCalendar className="h-5 w-5" />} label="Sesi minggu ini" value={sesiWeek} accent="text-lime-accent" hint="7 hari ke depan" /></Reveal>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1fr]">
        <Reveal delay={120}>
          <Card className="p-6">
            <SectionHeading title="Bimbingan terbaru" action={
              <Link href="/admin/bimbingan" className="text-sm font-semibold text-brand-600 hover:text-brand-700">Semua</Link>
            } />
            <ul className="mt-4 space-y-2.5">
              {recentBimbingan.map((b) => (
                <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-muted/40 p-3 text-sm ring-1 ring-border">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-ink">{b.client.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {b.thesisTitle ?? "-"} · tutor: {b.tutor?.name ?? "belum ditugaskan"}
                    </p>
                  </div>
                  <Badge value={b.status} label={b.status === "ongoing" ? "Berjalan" : b.status} />
                </li>
              ))}
            </ul>
          </Card>
        </Reveal>

        <Reveal delay={180}>
          <Card className="p-6">
            <SectionHeading title="Jejak audit" action={
              <Link href="/admin/audit" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 hover:text-brand-700">
                Lengkap
              </Link>
            } />
            {recentAudit.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">Belum ada aktivitas tercatat.</p>
            ) : (
              <ul className="mt-4 space-y-2">
                {recentAudit.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                      <IconShield className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-xs font-medium text-ink">{a.action}</span>
                      {a.targetType ? <span className="text-xs text-muted-foreground"> · {a.targetType}#{a.targetId}</span> : null}
                    </span>
                    <span className="shrink-0 text-xs text-muted-foreground">{waktuRelatif(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </Reveal>
      </div>
    </div>
  );
}
