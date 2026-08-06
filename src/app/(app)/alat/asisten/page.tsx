import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { AsistenClient } from "@/components/features/asisten-client";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function AsistenPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "klien") {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Alat Skripsi" title="Asisten Nulis AI" desc="Alat ini untuk klien bimbingan." />
      </div>
    );
  }
  if (!(await hasThesisAccess(user.id))) {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Alat Skripsi" title="Asisten Nulis AI" />
        <NoAccess accountUrl={ACCOUNT_URL} />
      </div>
    );
  }

  // Sumber naskah: dokumen milik klien (pointer GCS di prod). Dipakai sebagai konteks yang dipilih
  // secara eksplisit (consent + gerbang biaya, lihat thesis-fitur-p1-ai-teks.md §1.1).
  const docs = await prisma.module.findMany({
    where: { uploaderId: user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: { id: true, title: true, originalName: true, version: true, createdAt: true },
  });

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Alat Skripsi · AI"
        title="Asisten Nulis"
        desc="Bantu proses & pemahamanmu - perkuat kalimatmu sendiri, susun kerangka & abstrak. Bukan mengerjakan untukmu."
      />
      <AsistenClient
        documents={docs.map((d) => ({
          id: d.id,
          label: d.title ?? d.originalName ?? `Dokumen #${d.id}`,
          version: d.version,
        }))}
      />
    </div>
  );
}
