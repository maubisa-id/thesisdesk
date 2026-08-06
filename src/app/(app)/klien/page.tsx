import { getSessionUser } from "@/lib/session";
import { getTutorBimbingan } from "@/lib/queries";
import { SectionTitle, Card, Badge, Avatar, ProgressRing, EmptyState } from "@/components/kit";
import { DbError } from "@/components/states";
import { KlienDetailDialog } from "@/components/features/klien-detail-dialog";
import { IconUsers } from "@/components/icons";
import { persen } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function KlienSayaPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "tutor") {
    return <div className="space-y-6"><SectionTitle /></div>;
  }

  const bimbingan = await getTutorBimbingan(user.id);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Bimbingan"
        title="Klien saya"
        desc="Pilih klien untuk melihat progres, sesi, dan catatan bimbingannya secara lengkap."
      />

      {bimbingan.length === 0 ? (
        <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Belum ada klien" desc="Klien yang ditugaskan admin akan muncul di sini." />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {bimbingan.map((b) => {
            const stuck = (b.stuckDays ?? 0) >= 7;
            return (
              <KlienDetailDialog key={b.id} klienId={b.client.id}>
                <Card className="p-6 transition-colors hover:border-brand-200">
                  <div className="flex items-start gap-4">
                    <Avatar name={b.client.name} url={b.client.avatarUrl} size={48} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-ink">{b.client.name}</p>
                        {stuck ? <Badge value="blocked" label={`Stuck ${b.stuckDays}h`} /> : <Badge value={b.status} label="Aktif" />}
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{b.thesisTitle ?? "-"}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-4">
                    <ProgressRing value={b.progress.pct} size={56} stroke={7}>
                      <span className="text-xs font-bold tabular-nums text-ink">{persen(b.progress.pct)}</span>
                    </ProgressRing>
                    <div className="flex-1 text-xs text-muted-foreground">
                      <p className="tabular-nums">{b.progress.done}/{b.progress.total} milestone</p>
                      <p className="mt-0.5">Aktivitas terakhir: {b.stuckDays != null ? `${b.stuckDays} hari lalu` : "-"}</p>
                    </div>
                  </div>

                  <p className="mt-4 border-t border-black/[0.05] pt-3 text-xs font-semibold text-brand-600">
                    Klik untuk lihat detail lengkap &rarr;
                  </p>
                </Card>
              </KlienDetailDialog>
            );
          })}
        </div>
      )}
    </div>
  );
}
