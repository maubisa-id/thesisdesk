import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

// Token rahasia per-user untuk URL feed kalender (pola iCal secret URL, mis. Google Calendar).
// Dibuat lazy saat pertama dibutuhkan. Tak ada cookie di feed -> token inilah otentikasinya.
export async function getOrCreateCalendarToken(userId: number): Promise<string> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { calendarToken: true } });
  if (u?.calendarToken) return u.calendarToken;
  const token = randomBytes(24).toString("base64url");
  await prisma.user.update({ where: { id: userId }, data: { calendarToken: token } });
  return token;
}
