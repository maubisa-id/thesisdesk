import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

// Jejak audit aksi/akses sensitif (WAJIB, Fondasi §5.1). Append-only. JANGAN memuat PII mentah
// di metadata - cukup id + ringkasan non-PII. Best-effort: kegagalan audit tak menjatuhkan aksi.
export async function writeAudit(input: {
  actor?: Pick<SessionUser, "id" | "coreUserId" | "role"> | null;
  action: string;
  targetType?: string;
  targetId?: string | number;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    let ip: string | null = null;
    let ua: string | null = null;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        null;
      ua = h.get("user-agent")?.slice(0, 255) ?? null;
    } catch {
      /* di luar konteks request (mis. seed) - abaikan */
    }
    await prisma.auditLog.create({
      data: {
        actorCoreUserId: input.actor?.coreUserId ?? null,
        actorUserId: input.actor?.id ?? null,
        actorRole: input.actor?.role ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId != null ? String(input.targetId) : null,
        ipAddress: ip,
        userAgent: ua,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch {
    /* audit best-effort */
  }
}
