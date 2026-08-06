import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { getKlienBimbingan } from "@/lib/queries";
import { SectionTitle } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { SidangClient } from "@/components/features/sidang-client";
import { IconMic } from "@/components/icons";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function SidangPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "klien") {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Simulasi Sidang" desc="Alat ini untuk klien bimbingan." /></div>;
  }
  if (!(await hasThesisAccess(user.id))) {
    return <div className="space-y-6"><SectionTitle eyebrow="Alat Skripsi" title="Simulasi Sidang" /><NoAccess accountUrl={ACCOUNT_URL} /></div>;
  }

  const bimbingan = await getKlienBimbingan(user.id);
  const questions = bimbingan
    ? await prisma.defenseQuestion.findMany({
        where: { bimbinganId: bimbingan.id, deletedAt: null },
        orderBy: { id: "asc" },
      })
    : [];

  return (
    <div className="space-y-6">
      <SectionTitle eyebrow="Alat Skripsi" title="Simulasi Sidang" desc="Latih menjawab pertanyaan penguji dari naskahmu, lalu tinjau jawabanmu sebelum hari sidang." />
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-brand-200 bg-gradient-to-br from-brand-50 via-brand-50/60 to-violet-50 p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-card text-brand-600 ring-1 ring-brand-600/15">
          <IconMic className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
            Mode Suara (Voice-to-Voice)
            <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">Segera</span>
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            AI berperan sebagai penguji dan bertanya lewat suara berdasarkan naskahmu (RAG), lalu memberi transkrip umpan balik artikulasi & penguasaan materi. Sementara itu, latih dulu dengan flashcard di bawah.
          </p>
        </div>
      </div>
      <SidangClient
        questions={questions.map((q) => ({
          id: q.id,
          question: q.question,
          category: q.category,
          difficulty: q.difficulty,
          suggestedAnswer: q.suggestedAnswer,
        }))}
      />
    </div>
  );
}
