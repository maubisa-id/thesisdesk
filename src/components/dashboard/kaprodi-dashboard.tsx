import type { SessionUser } from "@/lib/session";
import { getStageApprovals } from "@/lib/queries";
import { DashboardHeader } from "@/components/kit";
import { StageApprovals } from "@/components/features/stage-approvals";
import { salamWaktu } from "@/lib/format";

export async function KaprodiDashboard({ user }: { user: SessionUser }) {
  const firstName = user.name.split(/\s+/)[0];
  const rows = await getStageApprovals(user);
  const pending = rows.filter((r) => r.status === "pending");
  const decided = rows.filter((r) => r.status !== "pending").slice(0, 10);

  return (
    <div className="space-y-8">
      <DashboardHeader
        eyebrow="Kaprodi"
        title={`${salamWaktu()}, ${firstName}`}
        desc={
          pending.length > 0
            ? `${pending.length} pengajuan naik tahap menunggu keputusanmu.`
            : "Tidak ada pengajuan yang menunggu saat ini."
        }
      />
      <StageApprovals pending={pending} decided={decided} />
    </div>
  );
}
