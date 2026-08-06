import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { summarizeMilestones } from "@/lib/queries";
import { SectionTitle, Card, Badge, ProgressRing } from "@/components/kit";
import { DbError } from "@/components/states";
import { IconCap } from "@/components/icons";
import { persen, tanggal } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminBimbinganPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "admin") return <DbError error="Akses ditolak" />;

  const list = await prisma.bimbingan.findMany({
    where: { deletedAt: null },
    orderBy: { id: "desc" },
    include: {
      client: { select: { name: true, avatarUrl: true } },
      tutor: { select: { name: true } },
      milestones: { select: { chapter: true, status: true } },
    },
  });

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Kelola" title="Bimbingan" desc={`${list.length} bimbingan aktif & selesai. Pantau progres lintas tutor.`} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((b) => {
          const p = summarizeMilestones(b.milestones);
          return (
            <Card key={b.id} className="p-6">
              <div className="flex items-start justify-between gap-2">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600"><IconCap className="h-5 w-5" /></span>
                <Badge value={b.status} label={b.status === "ongoing" ? "Berjalan" : b.status} />
              </div>
              <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink">{b.thesisTitle ?? "-"}</p>
              <div className="mt-4 flex items-center gap-4">
                <ProgressRing value={p.pct} size={52} stroke={6}>
                  <span className="text-[11px] font-bold text-ink">{persen(p.pct)}</span>
                </ProgressRing>
                <div className="text-xs text-muted-foreground">
                  <p className="font-medium text-ink-soft">{b.client.name}</p>
                  <p className="mt-0.5">Tutor: {b.tutor?.name ?? "belum ditugaskan"}</p>
                  <p className="mt-0.5">Mulai: {tanggal(b.createdAt)}</p>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
