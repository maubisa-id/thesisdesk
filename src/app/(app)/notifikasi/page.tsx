import { getSessionUser } from "@/lib/session";
import { getNotifications } from "@/lib/notifications";
import { SectionTitle } from "@/components/kit";
import { DbError } from "@/components/states";
import { NotifikasiList, type NotifItem } from "@/components/features/notifikasi-client";

export const dynamic = "force-dynamic";

export default async function NotifikasiPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  const notifs = await getNotifications(user.id, 50);
  const items: NotifItem[] = notifs.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    color: n.color,
    actionUrl: n.actionUrl,
    readAt: n.readAt ? n.readAt.toISOString() : null,
    createdAt: n.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <SectionTitle
        eyebrow="Aktivitas"
        title="Notifikasi"
        desc="Kabar terbaru dari tutor, jadwal, dokumen, dan pesan bimbinganmu."
      />
      <NotifikasiList initial={items} />
    </div>
  );
}
