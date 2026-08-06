import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { SectionTitle, Card, StatCard } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { LogWritingForm } from "@/components/features/streak-form";
import { IconFlame, IconTarget, IconClock } from "@/components/icons";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

function computeStreak(dates: Set<string>): number {
  let streak = 0;
  const cursor = new Date();
  if (!dates.has(isoDay(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (dates.has(isoDay(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

export default async function StreakPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "klien") {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Streak Menulis" desc="Alat ini untuk klien bimbingan." /></div>;
  }
  if (!(await hasThesisAccess(user.id))) {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Streak Menulis" /><NoAccess accountUrl={ACCOUNT_URL} /></div>;
  }

  const stats = await prisma.writingStat.findMany({
    where: { ownerId: user.id },
    orderBy: { statDate: "desc" },
    take: 120,
  });

  const dateSet = new Set(stats.map((s) => isoDay(s.statDate)));
  const streak = computeStreak(dateSet);
  const totalWords = stats.reduce((s, r) => s + r.words, 0);
  const totalMinutes = stats.reduce((s, r) => s + r.minutes, 0);

  // Heatmap 12 minggu (84 hari), kolom = minggu, baris = hari.
  const wordsByDay = new Map(stats.map((s) => [isoDay(s.statDate), s.words] as const));
  const days: { date: string; words: number }[] = [];
  for (let i = 83; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push({ date: isoDay(d), words: wordsByDay.get(isoDay(d)) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.words));
  const level = (w: number) => (w === 0 ? 0 : w < max * 0.25 ? 1 : w < max * 0.5 ? 2 : w < max * 0.75 ? 3 : 4);
  const LEVEL_BG = ["bg-muted", "bg-brand-100", "bg-brand-200", "bg-brand-400", "bg-brand-600"];

  // Susun ke kolom minggu.
  const weeks: { date: string; words: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Alat Skripsi"
        title="Streak Menulis"
        desc="Konsistensi mengalahkan intensitas. Catat sesi menulis harianmu dan jaga ritmenya menuju sidang."
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={<IconFlame className="h-5 w-5" />} label="Streak saat ini" value={`${streak} hari`} hint={streak > 0 ? "Jangan putus!" : "Mulai hari ini"} accent="text-lime-accent" />
        <StatCard icon={<IconTarget className="h-5 w-5" />} label="Total kata (120 hari)" value={totalWords.toLocaleString("id-ID")} accent="text-brand-600" />
        <StatCard icon={<IconClock className="h-5 w-5" />} label="Total waktu" value={`${Math.round(totalMinutes / 60)} jam`} accent="text-teal" />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <LogWritingForm />

        <Card className="p-6">
          <h3 className="font-display text-lg font-bold tracking-tight text-ink">Grafik konsistensi</h3>
          <p className="mt-0.5 text-sm text-muted-foreground">12 minggu terakhir</p>
          <div className="mt-5 flex gap-1 overflow-x-auto pb-2">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-1">
                {week.map((d) => (
                  <span
                    key={d.date}
                    title={`${d.date}: ${d.words} kata`}
                    className={`h-3.5 w-3.5 rounded-[3px] ${LEVEL_BG[level(d.words)]}`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <span>Sedikit</span>
            {LEVEL_BG.map((bg, i) => (
              <span key={i} className={`h-3 w-3 rounded-[3px] ${bg}`} />
            ))}
            <span>Banyak</span>
          </div>
        </Card>
      </div>
    </div>
  );
}
