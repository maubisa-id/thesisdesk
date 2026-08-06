import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SectionTitle } from "@/components/kit";
import { DbError } from "@/components/states";
import { ProdiManager } from "@/components/features/prodi-manager";

export const dynamic = "force-dynamic";

export default async function AdminProdiPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "admin") return <DbError error="Akses ditolak" />;

  const faculties = await prisma.faculty.findMany({
    orderBy: { name: "asc" },
    include: {
      programs: {
        orderBy: { name: "asc" },
        include: { _count: { select: { users: true } } },
      },
    },
  });

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Kelola"
        title="Fakultas & Program Studi"
        desc="Susun struktur akademik institusi. Prodi dipakai untuk mengelompokkan mahasiswa dan tutor."
      />
      <ProdiManager
        faculties={faculties.map((f) => ({
          id: f.id,
          name: f.name,
          code: f.code,
          programs: f.programs.map((p) => ({ id: p.id, name: p.name, code: p.code, level: p.level, users: p._count.users })),
        }))}
      />
    </div>
  );
}
