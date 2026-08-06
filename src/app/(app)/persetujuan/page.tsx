import { getSessionUser } from "@/lib/session";
import { getStageApprovals } from "@/lib/queries";
import { SectionTitle } from "@/components/kit";
import { DbError } from "@/components/states";
import { StageApprovals } from "@/components/features/stage-approvals";

export const dynamic = "force-dynamic";

export default async function PersetujuanPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "kaprodi" && user.role !== "admin") return <DbError error="Akses ditolak" />;

  const rows = await getStageApprovals(user);
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending").slice(0, 20);

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Kaprodi"
        title="Persetujuan naik tahap"
        desc="Tinjau pengajuan mahasiswa untuk maju dari proposal ke seminar hingga sidang akhir."
      />
      <StageApprovals pending={pending} decided={decided} />
    </div>
  );
}
