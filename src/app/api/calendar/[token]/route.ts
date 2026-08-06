import { prisma } from "@/lib/prisma";
import { buildCalendar, type IcsEvent } from "@/lib/ics";

// Feed ICS langganan (read-only) untuk kalender pribadi tutor/klien. Otentikasi = token rahasia di
// path (bukan cookie; app kalender tak mengirim cookie). Menyajikan sesi ~7 hari lalu ke depan.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SESSION_MINUTES = 60;

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!token || token.length < 20) return new Response("Not found", { status: 404 });

  const user = await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, name: true, role: true },
  });
  if (!user || user.role === "admin") return new Response("Not found", { status: 404 });

  const where = user.role === "tutor" ? { tutorId: user.id } : { klienId: user.id };
  const since = new Date(Date.now() - 7 * 86_400_000);
  const rows = await prisma.schedule.findMany({
    where: { ...where, scheduledAt: { gte: since }, status: { notIn: ["rejected"] } },
    orderBy: { scheduledAt: "asc" },
    include: { tutor: { select: { name: true } }, klien: { select: { name: true } } },
    take: 200,
  });

  const events: IcsEvent[] = rows.map((s) => {
    const other = user.role === "tutor" ? s.klien.name : s.tutor.name;
    const end = new Date(s.scheduledAt.getTime() + SESSION_MINUTES * 60_000);
    const desc = [s.gmeetLink ? `Google Meet: ${s.gmeetLink}` : null, `Dengan: ${other}`]
      .filter(Boolean)
      .join("\n");
    return {
      uid: `sesi-${s.id}@thesisdesk`,
      start: s.scheduledAt,
      end,
      title: `Bimbingan: ${s.topic}`,
      description: desc,
      url: s.gmeetLink ?? undefined,
    };
  });

  const ics = buildCalendar(`Jadwal Bimbingan - ${user.name}`, events);
  return new Response(ics, {
    headers: {
      "content-type": "text/calendar; charset=utf-8",
      "content-disposition": 'inline; filename="jadwal-bimbingan.ics"',
      "cache-control": "private, max-age=300",
    },
  });
}
