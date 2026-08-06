import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getDefenseDetail } from "@/lib/queries";
import { getInstitution } from "@/lib/setup";
import { canAccessBimbingan, canDecideStage } from "@/lib/rbac";
import { DbError } from "@/components/states";
import { PrintButton } from "@/components/features/print-button";
import {
  tanggalPanjang,
  waktu,
  parseExaminers,
  DEFENSE_RESULT_LABEL,
} from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function BeritaAcaraPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const defenseId = Number(id);
  if (!Number.isInteger(defenseId) || defenseId <= 0) notFound();

  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  const d = await getDefenseDetail(defenseId);
  if (!d) notFound();

  const b = d.bimbingan;
  const owners = { clientUserId: b.clientUserId, tutorUserId: b.tutorUserId };
  const allowed = canAccessBimbingan(user, owners) || canDecideStage(user, b.client.studyProgramId);
  if (!allowed) return <DbError error="Akses ditolak" />;

  const inst = await getInstitution();
  const examiners = parseExaminers(d.examiners);
  const facultyName = b.client.studyProgram?.faculty?.name ?? null;
  const prodiName = b.client.studyProgram
    ? `${b.client.studyProgram.level ? b.client.studyProgram.level + " " : ""}${b.client.studyProgram.name}`
    : null;

  return (
    <main className="mx-auto max-w-[820px] bg-white px-6 py-8 text-black print:px-0 print:py-0">
      <div className="mb-6 flex items-center justify-between print:hidden">
        <Link href="/sidang" className="text-sm text-neutral-600 hover:underline">
          &larr; Kembali ke sidang
        </Link>
        <PrintButton />
      </div>

      <article className="rounded-lg border border-neutral-300 p-10 leading-relaxed print:rounded-none print:border-0 print:p-0">
        <header className="border-b-2 border-black pb-4 text-center">
          <h1 className="text-lg font-bold uppercase tracking-wide">{inst?.name ?? "Institusi"}</h1>
          {facultyName && <p className="text-sm">{facultyName}</p>}
          {prodiName && <p className="text-sm">Program Studi {prodiName}</p>}
        </header>

        <h2 className="mt-6 text-center text-base font-bold uppercase tracking-wide">
          Berita Acara Sidang Akhir
        </h2>

        <section className="mt-6 space-y-1 text-sm">
          <p>
            Pada hari ini, {d.scheduledAt ? `${tanggalPanjang(d.scheduledAt)} pukul ${waktu(d.scheduledAt)} WIB` : "(tanggal belum dijadwalkan)"}
            {d.location ? `, bertempat di ${d.location}` : ""}, telah dilaksanakan sidang akhir atas:
          </p>
        </section>

        <table className="mt-4 text-sm">
          <tbody>
            <tr>
              <td className="py-1 pr-3 align-top font-medium">Nama</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 align-top">{b.client.name}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 align-top font-medium">Judul</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 align-top">{b.thesisTitle ?? "-"}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 align-top font-medium">Jenis</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 align-top capitalize">{b.serviceType}</td>
            </tr>
            <tr>
              <td className="py-1 pr-3 align-top font-medium">Hasil</td>
              <td className="py-1 pr-2 align-top">:</td>
              <td className="py-1 align-top font-semibold">
                {d.result ? DEFENSE_RESULT_LABEL[d.result] ?? d.result : "Belum ditetapkan"}
              </td>
            </tr>
          </tbody>
        </table>

        {d.notes && (
          <section className="mt-4 text-sm">
            <p className="font-medium">Catatan panel:</p>
            <p className="whitespace-pre-wrap">{d.notes}</p>
          </section>
        )}

        <section className="mt-8">
          <p className="mb-4 text-sm font-medium">Panel Penguji,</p>
          {examiners.length === 0 ? (
            <p className="text-sm text-neutral-500">(Panel penguji belum ditetapkan.)</p>
          ) : (
            <div className="grid grid-cols-2 gap-x-10 gap-y-10">
              {examiners.map((e, i) => (
                <div key={i} className="text-sm">
                  <p className="text-neutral-600">{e.role}</p>
                  <div className="mt-12 border-b border-black" />
                  <p className="mt-1 font-medium">{e.name}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {b.tutor?.name && (
          <section className="mt-10 text-sm">
            <p>Mengetahui, Dosen Pembimbing</p>
            <div className="mt-12 w-64 border-b border-black" />
            <p className="mt-1 font-medium">{b.tutor.name}</p>
          </section>
        )}
      </article>
    </main>
  );
}
