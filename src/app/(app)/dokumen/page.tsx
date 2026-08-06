import Link from "next/link";
import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { SectionTitle, Card, Badge, Avatar, EmptyState } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { UploadDocForm } from "@/components/features/dokumen-actions";
import { IconDoc } from "@/components/icons";
import { waktuRelatif, bytesHuman, REVIEW_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function DokumenPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  const isKlien = user.role === "klien";
  if (isKlien && !(await hasThesisAccess(user.id))) {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Dokumen" title="Dokumen bimbingan" />
        <NoAccess accountUrl={ACCOUNT_URL} />
      </div>
    );
  }

  const where =
    user.role === "tutor" ? { receiverId: user.id, deletedAt: null } : user.role === "klien" ? { uploaderId: user.id, deletedAt: null } : { deletedAt: null };
  const docs = await prisma.module.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      uploader: { select: { name: true, avatarUrl: true } },
      receiver: { select: { name: true } },
      _count: { select: { annotations: true } },
    },
  });

  return (
    <div className="space-y-8">
      <SectionTitle
        eyebrow="Dokumen"
        title={user.role === "tutor" ? "Dokumen masuk" : "Dokumen bimbingan"}
        desc={isKlien ? "Unggah draft, terima revisi tutor sebagai komentar di dokumen - bukan chat berserakan." : "Buka dokumen untuk memberi anotasi inline dan menandai review."}
        action={isKlien ? <UploadDocForm clientName={user.name} /> : undefined}
      />

      {docs.length === 0 ? (
        <EmptyState icon={<IconDoc className="h-6 w-6" />} title={isKlien ? "Belum ada dokumen" : "Belum ada dokumen masuk"} desc={isKlien ? "Unggah draft pertamamu untuk mulai direview." : "Dokumen dari klien akan muncul di sini."} />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((d) => (
            <Link key={d.id} href={`/dokumen/${d.id}`} className="group">
              <Card className="h-full p-5 transition-[transform,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-0.5 group-hover:shadow-lift">
                <div className="flex items-start justify-between gap-2">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                    <IconDoc className="h-5 w-5" />
                  </span>
                  <Badge value={d.reviewStatus} label={REVIEW_STATUS_LABEL[d.reviewStatus]} />
                </div>
                <p className="mt-3 line-clamp-2 text-sm font-semibold text-ink transition-colors group-hover:text-brand-600">{d.title ?? d.originalName}</p>
                <p className="mt-1 text-xs text-muted-foreground">v{d.version} · {bytesHuman(d.fileSize)}</p>
                <div className="mt-3 flex items-center gap-2 border-t border-black/[0.05] pt-3">
                  <Avatar name={(user.role === "tutor" ? d.uploader.name : d.receiver?.name) ?? "-"} size={24} />
                  <span className="text-xs text-muted-foreground">
                    {user.role === "tutor" ? d.uploader.name : d.receiver?.name ?? "-"} · {waktuRelatif(d.createdAt)}
                  </span>
                  {d._count.annotations > 0 ? (
                    <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                      {d._count.annotations} komentar
                    </span>
                  ) : null}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
