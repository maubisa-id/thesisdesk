import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { getKlienBimbingan, getMilestones } from "@/lib/queries";
import { SectionTitle, EmptyState } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { ProgresBoard } from "@/components/features/progres-board";
import { IconFlag, IconUsers } from "@/components/icons";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.contoh.id";

export default async function ProgresPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  if (user.role !== "klien") {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Progres BAB" title="Papan progres" desc="Papan milestone dimiliki tiap klien." />
        <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Pilih klien dulu" desc="Buka Klien saya untuk melihat papan progres masing-masing." />
      </div>
    );
  }

  if (!(await hasThesisAccess(user.id))) {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Progres BAB" title="Papan progres" />
        <NoAccess accountUrl={ACCOUNT_URL} />
      </div>
    );
  }

  const bimbingan = await getKlienBimbingan(user.id);
  if (!bimbingan) {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Progres BAB" title="Papan progres" />
        <EmptyState icon={<IconFlag className="h-6 w-6" />} title="Belum ada milestone" desc="Milestone BAB I-V akan muncul begitu tutor menyiapkannya." />
      </div>
    );
  }

  const milestones = await getMilestones(bimbingan.id);

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Progres BAB"
        title="Papan progres"
        desc="Seret kartu antar kolom atau ubah status lewat menu di tiap kartu. Perubahan tersimpan otomatis."
      />

      <ProgresBoard
        bimbinganId={bimbingan.id}
        canEdit
        thesisTitle={bimbingan.thesisTitle}
        milestones={milestones.map((m) => ({
          id: m.id,
          chapter: m.chapter,
          title: m.title,
          status: m.status,
          dueDate: m.dueDate ? m.dueDate.toISOString() : null,
        }))}
      />
    </div>
  );
}
