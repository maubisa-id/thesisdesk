import { getSessionUser } from "@/lib/session";
import { getSidangList } from "@/lib/queries";
import { SectionTitle } from "@/components/kit";
import { DbError } from "@/components/states";
import { SidangManager } from "@/components/features/sidang-manager";

export const dynamic = "force-dynamic";

export default async function SidangPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "kaprodi" && user.role !== "admin") return <DbError error="Akses ditolak" />;

  const rows = await getSidangList(user);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Kaprodi"
        title="Sidang akhir"
        desc="Jadwalkan sidang, tunjuk panel penguji, catat hasil, lalu cetak berita acara / lembar pengesahan."
      />
      <SidangManager rows={rows} />
    </div>
  );
}
