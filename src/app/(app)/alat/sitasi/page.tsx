import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { SitasiClient } from "@/components/features/sitasi-client";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function SitasiPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "klien") {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Manajer Sitasi" desc="Alat ini untuk klien bimbingan." /></div>;
  }
  if (!(await hasThesisAccess(user.id))) {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Manajer Sitasi" /><NoAccess accountUrl={ACCOUNT_URL} /></div>;
  }

  const citations = await prisma.citation.findMany({
    where: { ownerId: user.id, deletedAt: null },
    orderBy: { id: "desc" },
  });

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Alat Skripsi"
        title="Manajer Sitasi"
        desc="Cari jurnal (OpenAlex, DOAJ open-access, Crossref), impor DOI atau BibTeX/RIS, lalu format otomatis ke APA & IEEE - siap tempel ke daftar pustaka."
      />
      <SitasiClient
        citations={citations.map((c) => ({
          id: c.id,
          title: c.title,
          year: c.year,
          source: c.source,
          formattedApa: c.formattedApa,
          formattedIeee: c.formattedIeee,
        }))}
      />
    </div>
  );
}
