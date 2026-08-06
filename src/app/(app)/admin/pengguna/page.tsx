import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SectionTitle, Badge, Avatar, Card } from "@/components/kit";
import { DbError } from "@/components/states";
import { UserImport } from "@/components/features/user-import";
import { tanggal } from "@/lib/format";

export const dynamic = "force-dynamic";

const ROLE_LABEL: Record<string, string> = { admin: "Admin", tutor: "Tutor", klien: "Klien" };
const ROLE_TONE: Record<string, string> = { admin: "in_progress", tutor: "approved", klien: "pending" };

export default async function AdminPenggunaPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "admin") return <DbError error="Akses ditolak" />;

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: [{ role: "asc" }, { id: "asc" }],
    include: {
      tutor: { select: { name: true } },
      _count: { select: { bimbinganAsClient: true, klien: true } },
    },
  });

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Kelola"
        title="Pengguna"
        desc={`${users.length} pengguna terdaftar di produk thesis.`}
        action={<UserImport />}
      />

      <Card className="overflow-hidden">
        {/* Tabel di md+, kartu bertumpuk di mobile (aksi tak tersembunyi di scroll horizontal) */}
        <div className="hidden md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-black/[0.06] bg-muted/40/60 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
              <tr>
                <th className="px-6 py-3">Nama</th>
                <th className="px-6 py-3">Peran</th>
                <th className="px-6 py-3">Relasi</th>
                <th className="px-6 py-3">Bergabung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.04]">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/50/50">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={u.name} url={u.avatarUrl} size={36} />
                      <div>
                        <p className="font-semibold text-ink">{u.name}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-3"><Badge value={ROLE_TONE[u.role]} label={ROLE_LABEL[u.role]} /></td>
                  <td className="px-6 py-3 text-muted-foreground">
                    {u.role === "klien" ? (u.tutor ? `Tutor: ${u.tutor.name}` : "Belum ada tutor") : u.role === "tutor" ? `${u._count.klien} klien` : "-"}
                  </td>
                  <td className="px-6 py-3 text-muted-foreground">{tanggal(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <ul className="divide-y divide-black/[0.04] md:hidden">
          {users.map((u) => (
            <li key={u.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={u.name} url={u.avatarUrl} size={40} />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-ink">{u.name}</p>
                <p className="truncate text-xs text-muted-foreground">{u.email}</p>
              </div>
              <Badge value={ROLE_TONE[u.role]} label={ROLE_LABEL[u.role]} />
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
