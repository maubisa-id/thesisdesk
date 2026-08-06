// Utilitas bersama untuk endpoint federasi /admin/v1/*. Membungkus verifikasi JWT hub, respons
// JSON konsisten, jejak audit dua-sisi (actor dari klaim JWT), dan ringkasan progres milestone
// (satu query grup, hindari N+1). Semua endpoint memakai ini agar seragam + default-deny.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyHubRequest, type FederationActor } from "@/lib/federation";

export function jsonError(status: number, error: string): NextResponse {
  return NextResponse.json({ ok: false, error }, { status });
}

export function jsonOk(data: unknown): NextResponse {
  return NextResponse.json(data);
}

type GuardOk = { ok: true; actor: FederationActor; correlationId: string | null };
type GuardErr = { ok: false; response: NextResponse };

// Gerbang setiap route: verifikasi token hub. Bila gagal, kembalikan response siap-kirim.
export function guard(req: Request): GuardOk | GuardErr {
  const r = verifyHubRequest(req);
  if (!r.ok) return { ok: false, response: jsonError(r.status, r.error) };
  return { ok: true, actor: r.actor, correlationId: r.correlationId };
}

// Baca body JSON dengan aman (tanpa throw). Mengembalikan {} bila kosong/rusak.
export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const raw = await req.text();
    if (!raw.trim()) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

// Audit aksi federasi di DB thesis (jejak sah aksi tulis ada di spoke, sec 4 kontrak). actor dari
// klaim JWT hub -> disimpan di metadata untuk akuntabilitas (siapa-apa-kapan lintas-layanan).
export async function auditFederation(input: {
  actor: FederationActor;
  action: string;
  targetType?: string;
  targetId?: string | number;
  correlationId?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorRole: "admin", // operator hub (peran admin ber-scope thesis di sisi hub)
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId != null ? String(input.targetId) : null,
        metadata: JSON.stringify({
          via: "federation",
          actor_uuid: input.actor.uuid,
          actor_email: input.actor.email,
          correlation_id: input.correlationId ?? null,
          ...input.metadata,
        }),
      },
    });
  } catch {
    /* audit best-effort: kegagalan audit tak menjatuhkan aksi */
  }
}

export function pct(total: number, done: number): number {
  return total ? Math.round((done / total) * 100) : 0;
}

// Peta bimbinganId -> {total, done} milestone dalam SATU query grup (hindari N+1 di daftar).
export async function milestoneProgressMap(
  bimbinganIds: number[],
): Promise<Map<number, { total: number; done: number }>> {
  const map = new Map<number, { total: number; done: number }>();
  if (bimbinganIds.length === 0) return map;
  const grouped = await prisma.milestone.groupBy({
    by: ["bimbinganId", "status"],
    where: { bimbinganId: { in: bimbinganIds } },
    _count: { _all: true },
  });
  for (const g of grouped) {
    const cur = map.get(g.bimbinganId) ?? { total: 0, done: 0 };
    cur.total += g._count._all;
    if (g.status === "done") cur.done += g._count._all;
    map.set(g.bimbinganId, cur);
  }
  return map;
}
