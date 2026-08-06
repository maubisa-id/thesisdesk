import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { SectionTitle, Card, EmptyState } from "@/components/kit";
import { DbError } from "@/components/states";
import { IconShield } from "@/components/icons";
import { tanggalWaktu } from "@/lib/format";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  login: "Masuk",
  "doc.view": "Buka dokumen",
  "doc.upload": "Unggah dokumen",
  "doc.review": "Tandai review",
  "annotation.create": "Tambah anotasi",
  "milestone.update": "Ubah milestone",
  "milestone.create": "Buat milestone",
  "schedule.request": "Ajukan sesi",
  "schedule.approve": "Setujui sesi",
  "schedule.reject": "Tolak sesi",
  "schedule.selesai": "Selesaikan sesi",
  "ai.run": "Jalankan alat AI",
  "defense.generate": "Buat pertanyaan sidang",
  "feedback_template.create": "Buat template feedback",
  "pii.read": "Baca data pribadi",
  "role.change": "Ubah peran",
};

export default async function AdminAuditPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role !== "admin") return <DbError error="Akses ditolak" />;

  const logs = await prisma.auditLog.findMany({ orderBy: { id: "desc" }, take: 100 });
  const actorIds = Array.from(new Set(logs.map((l) => l.actorUserId).filter((x): x is number => x != null)));
  const actors = await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, name: true } });
  const nameById = new Map(actors.map((a) => [a.id, a.name] as const));

  return (
    <div className="space-y-8">
      <SectionTitle eyebrow="Kelola" title="Jejak audit" desc="Catatan aksi & akses sensitif (buka dokumen, review, ubah peran). Append-only, retensi ≥12 bulan - kepatuhan ISO/SOC2/PDP." />

      {logs.length === 0 ? (
        <EmptyState icon={<IconShield className="h-6 w-6" />} title="Belum ada catatan" desc="Aktivitas sensitif akan tercatat di sini." />
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-black/[0.04]">
            {logs.map((l) => (
              <li key={l.id} className="flex items-center gap-4 px-5 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  <IconShield className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink">
                    {ACTION_LABEL[l.action] ?? l.action}
                    {l.targetType ? <span className="text-muted-foreground"> · {l.targetType}#{l.targetId}</span> : null}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {l.actorUserId ? (nameById.get(l.actorUserId) ?? `user#${l.actorUserId}`) : "Sistem"}
                    {l.actorRole ? ` (${l.actorRole})` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-xs text-muted-foreground">{tanggalWaktu(l.createdAt)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
