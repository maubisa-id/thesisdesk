import { getSessionUser } from "@/lib/session";
import { hasThesisAccess } from "@/lib/entitlement";
import { prisma } from "@/lib/prisma";
import { getChatPartners } from "@/lib/queries";
import { SectionTitle } from "@/components/kit";
import { NoAccess, DbError } from "@/components/states";
import { ChatClient, type ChatMessage } from "@/components/features/chat-client";

export const dynamic = "force-dynamic";
const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function ChatPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;

  if (user.role === "klien" && !(await hasThesisAccess(user.id))) {
    return (
      <div className="space-y-6">
        <SectionTitle eyebrow="Pesan" title="Chat bimbingan" />
        <NoAccess accountUrl={ACCOUNT_URL} />
      </div>
    );
  }

  const partners = await getChatPartners(user);
  const partnerIds = partners.map((p) => p.id);

  // Ambil semua pesan antara user dan para partner (satu query), lalu kelompokkan per partner.
  const rows = partnerIds.length
    ? await prisma.message.findMany({
        where: {
          deletedAt: null,
          OR: [
            { senderId: user.id, receiverId: { in: partnerIds } },
            { receiverId: user.id, senderId: { in: partnerIds } },
          ],
        },
        orderBy: { createdAt: "asc" },
      })
    : [];

  const messages: Record<number, ChatMessage[]> = {};
  for (const p of partners) messages[p.id] = [];
  for (const m of rows) {
    const other = m.senderId === user.id ? m.receiverId : m.senderId;
    (messages[other] ??= []).push({
      id: m.id,
      fromMe: m.senderId === user.id,
      content: m.content,
      attachment: m.attachment,
      createdAt: m.createdAt.toISOString(),
    });
  }

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-4">
      <SectionTitle eyebrow="Pesan" title="Chat bimbingan" desc="Ngobrol langsung dengan tutor atau kliennmu. Untuk revisi dokumen, gunakan anotasi agar tetap rapi." />
      <div className="min-h-0 flex-1">
        <ChatClient
          partners={partners.map((p) => ({ id: p.id, name: p.name, avatarUrl: p.avatarUrl, lastSeenAt: p.lastSeenAt ? p.lastSeenAt.toISOString() : null }))}
          initialPartnerId={partnerIds[0] ?? null}
          messages={messages}
        />
      </div>
    </div>
  );
}
