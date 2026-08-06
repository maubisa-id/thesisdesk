import Link from "next/link";
import { notFound } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { writeAudit } from "@/lib/audit";
import { Card, Badge, InfoRow } from "@/components/kit";
import { DbError } from "@/components/states";
import { ReviewControls, AnnotationPanel } from "@/components/features/dokumen-actions";
import { IconDoc, IconArrow } from "@/components/icons";
import { tanggalWaktu, bytesHuman, REVIEW_STATUS_LABEL } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function DokumenDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const docId = Number(id);
  if (!Number.isInteger(docId)) notFound();

  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  const doc = await prisma.module.findUnique({
    where: { id: docId },
    include: {
      uploader: { select: { id: true, name: true, avatarUrl: true } },
      receiver: { select: { id: true, name: true } },
      annotations: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!doc || doc.deletedAt) notFound();

  // RBAC: hanya pemilik (uploader), penerima (tutor), atau admin. Cegah IDOR antar-klien.
  const allowed =
    user.role === "admin" || user.id === doc.uploaderId || user.id === doc.receiverId;
  if (!allowed) {
    return <DbError error="Akses ditolak" />;
  }

  // Audit: buka dokumen (Fondasi §5.1 - buka/unduh dokumen dicatat).
  await writeAudit({ actor: user, action: "doc.view", targetType: "module", targetId: doc.id, metadata: { version: doc.version } });

  // Nama penulis anotasi (resolve terpisah agar tetap ringan).
  const authorIds = Array.from(new Set(doc.annotations.map((a) => a.authorUserId)));
  const authors = await prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true } });
  const nameById = new Map(authors.map((a) => [a.id, a.name] as const));

  const canAnnotate = user.role !== "admin"; // uploader & tutor boleh; admin read-only di sini
  const canReview = user.role === "tutor" && user.id === doc.receiverId;

  // Pustaka template feedback tutor (bersama + milik sendiri) untuk quick-insert saat anotasi.
  const templates = canReview
    ? (
        await prisma.feedbackTemplate.findMany({
          where: { deletedAt: null, OR: [{ scope: "shared" }, { ownerUserId: user.id }] },
          orderBy: [{ usageCount: "desc" }, { sortOrder: "asc" }, { id: "asc" }],
          take: 100,
          select: { id: true, title: true, body: true, category: true, scope: true, ownerUserId: true },
        })
      ).map((t) => ({ id: t.id, title: t.title, body: t.body, category: t.category, scope: t.scope, mine: t.ownerUserId === user.id }))
    : [];

  return (
    <div className="space-y-5">
      <Link href="/dokumen" className="inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground">
        <IconArrow className="h-4 w-4 rotate-180" /> Kembali ke dokumen
      </Link>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_400px] lg:items-stretch">
        {/* Kiri: meta ringkas + pratinjau dokumen (ukuran wajar, tidak memenuhi layar) */}
        <div className="flex flex-col gap-4">
          <Card className="p-5">
            <div className="flex items-start justify-between gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <IconDoc className="h-5 w-5" />
              </span>
              <Badge value={doc.reviewStatus} label={REVIEW_STATUS_LABEL[doc.reviewStatus]} />
            </div>
            <h1 className="mt-4 font-display text-lg font-bold leading-snug tracking-tight text-ink">{doc.title ?? doc.originalName}</h1>
            <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
              <InfoRow label="Versi">v{doc.version}</InfoRow>
              <InfoRow label="Ukuran">{bytesHuman(doc.fileSize)}</InfoRow>
              <InfoRow label="Pengirim">{doc.uploader.name}</InfoRow>
              <InfoRow label="Diunggah">{tanggalWaktu(doc.createdAt)}</InfoRow>
            </div>
            {doc.note ? <p className="mt-4 rounded-xl bg-muted/60 p-3 text-sm text-ink-soft">Catatan: {doc.note}</p> : null}
            {canReview ? <div className="mt-4"><ReviewControls id={doc.id} status={doc.reviewStatus} /></div> : null}
          </Card>

          {/* Pratinjau: PDF nyata di-embed dengan tinggi wajar; selain itu kartu ringkas. */}
          {doc.filePath && doc.filePath.startsWith("/uploads/") && doc.filePath.toLowerCase().endsWith(".pdf") ? (
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
                <p className="truncate text-xs font-medium text-muted-foreground">{doc.originalName}</p>
                <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700">
                  Buka di tab baru <IconArrow className="h-3.5 w-3.5 rotate-[-45deg]" />
                </a>
              </div>
              <iframe src={`${doc.filePath}#view=FitH`} title={doc.originalName ?? "Pratinjau dokumen"} className="h-[30rem] w-full bg-muted/30" />
            </Card>
          ) : (
            <Card className="flex flex-col items-center justify-center p-8 text-center">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <IconDoc className="h-7 w-7" />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">{doc.originalName ?? "Berkas dokumen"}</p>
              {doc.filePath && doc.filePath.startsWith("/uploads/") ? (
                <>
                  <p className="mt-1 text-xs text-muted-foreground">Pratinjau inline khusus PDF. Berkas ini bisa dibuka atau diunduh.</p>
                  <a href={doc.filePath} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-brand-500 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
                    <IconArrow className="h-4 w-4 rotate-[-45deg]" /> Buka berkas
                  </a>
                </>
              ) : (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Berkas belum terlampir. Unggah lewat tombol Unggah dokumen di halaman Dokumen.</p>
              )}
            </Card>
          )}
        </div>

        {/* Kanan: komentar revisi - tinggi mengikuti kolom kiri (chat-style: diam, list scroll internal).
            Card di-absolute pada lg agar TIDAK menambah tinggi baris; ia mengisi tinggi kolom kiri. */}
        <div className="relative min-h-[24rem]">
          <Card className="flex flex-col overflow-hidden p-0 max-lg:h-[70vh] lg:absolute lg:inset-0">
            <div className="shrink-0 border-b border-border p-5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-display text-base font-bold tracking-tight text-ink">Komentar revisi</h2>
                {doc.annotations.length > 0 ? (
                  <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">{doc.annotations.length}</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Revisi tersimpan per posisi (halaman), bukan chat berserakan.</p>
            </div>
            <AnnotationPanel
              moduleId={doc.id}
              canAnnotate={canAnnotate}
              canReview={canReview}
              templates={templates}
              annotations={doc.annotations.map((a) => {
                let page: number | null = null;
                let quote: string | null = null;
                if (a.anchor) {
                  try {
                    const parsed = JSON.parse(a.anchor) as { page?: number; quote?: string };
                    page = parsed.page ?? null;
                    quote = parsed.quote ?? null;
                  } catch {
                    /* anchor rusak - abaikan */
                  }
                }
                return {
                  id: a.id,
                  body: a.body,
                  resolved: a.resolved,
                  authorName: nameById.get(a.authorUserId) ?? "-",
                  page,
                  quote,
                  createdAt: a.createdAt.toISOString(),
                };
              })}
            />
          </Card>
        </div>
      </div>
    </div>
  );
}
