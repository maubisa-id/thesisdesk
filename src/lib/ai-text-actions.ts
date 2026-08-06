"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/session";
import { ForbiddenError } from "@/lib/rbac";
import { hasThesisAccess } from "@/lib/entitlement";
import { writeAudit } from "@/lib/audit";
import { enhanceTone, isToneMode, TONE_DISCLAIMER, type ToneSuggestion } from "@/lib/ai-tone";
import { generateOutline, OUTLINE_DISCLAIMER, type OutlineChapter } from "@/lib/ai-outline";
import { generateAbstract, ABSTRACT_DISCLAIMER } from "@/lib/ai-abstract";
import { guideMethodology, METHODOLOGY_DISCLAIMER } from "@/lib/ai-methodology";
import { AiNotConfiguredError } from "@/lib/ai-client";
import { runScaffold } from "@/lib/ai-scaffold";
import { assertAiRateLimit } from "@/lib/ai-ratelimit";
import { ingestText, retrieveContext, readModuleText } from "@/lib/ai-ingest";
import { vectorizeConfigured } from "@/lib/vectorize";

// Server Actions untuk fitur AI teks P1: Academic Tone Enhancer + Outline generator.
// Semua lewat gerbang: sesi + entitlement thesis. Metering token -> ai_jobs/ai_outputs. Jejak audit.
// Retensi keluaran dibatasi (PDP). Fallback aman bila Workers AI belum dikonfigurasi.

const RETENTION_DAYS = 180;

type Fail = { ok: false; error: string };

function fail(e: unknown): Fail {
  if (e instanceof ForbiddenError) return { ok: false, error: e.message };
  if (e instanceof z.ZodError) return { ok: false, error: e.issues[0]?.message ?? "Input tidak valid." };
  return { ok: false, error: "Terjadi kendala. Coba lagi." };
}

async function persistAiJob(opts: {
  ownerId: number;
  coreUserId: number | null;
  bimbinganId: number | null;
  kind: string;
  model: string;
  inputPreview: string;
  tokensIn: number;
  tokensOut: number;
  content: string | null;
  data: unknown;
}): Promise<number> {
  const job = await prisma.aiJob.create({
    data: {
      ownerId: opts.ownerId,
      coreUserId: opts.coreUserId,
      bimbinganId: opts.bimbinganId,
      kind: opts.kind,
      status: "done",
      input: JSON.stringify({ preview: opts.inputPreview.slice(0, 120) }),
      model: opts.model,
      providerRegion: opts.model === "scaffold-local" ? "local" : "cf-workers-ai",
      tokensIn: opts.tokensIn,
      tokensOut: opts.tokensOut,
      retentionUntil: new Date(Date.now() + RETENTION_DAYS * 86_400_000),
    },
  });
  await prisma.aiOutput.create({
    data: { aiJobId: job.id, content: opts.content, data: opts.data ? JSON.stringify(opts.data) : null },
  });
  return job.id;
}

// ── Academic Tone Enhancer ("QuillBot ala-ala" etis) ──

// Tipe internal (JANGAN export dari file "use server" - hanya async function yang boleh diekspor).
// UI menurunkan tipe via Awaited<ReturnType<typeof enhanceTextTone>>.
type ToneActionResult =
  | { ok: true; mode: string; suggestions: ToneSuggestion[]; jobId: number; disclaimer: string; fallback?: boolean; note?: string; eyd?: unknown }
  | Fail;

const toneSchema = z.object({
  mode: z.string(),
  text: z.string().trim().min(1, "Isi teks yang mau diperkuat.").max(4000, "Maksimal 4000 karakter per potongan."),
  bimbinganId: z.coerce.number().int().positive().optional(),
});

export async function enhanceTextTone(input: unknown): Promise<ToneActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif - alat AI terkunci.");
    await assertAiRateLimit(user.id);
    const { mode, text, bimbinganId } = toneSchema.parse(input);
    if (!isToneMode(mode)) throw new ForbiddenError("Mode perbaikan tidak dikenal.");

    try {
      const r = await enhanceTone(mode, text);
      const jobId = await persistAiJob({
        ownerId: user.id, coreUserId: user.coreUserId, bimbinganId: bimbinganId ?? null,
        kind: "tone_enhance", model: r.model, inputPreview: text,
        tokensIn: r.tokensIn, tokensOut: r.tokensOut, content: null, data: { mode, suggestions: r.suggestions },
      });
      await writeAudit({ actor: user, action: "ai.run", targetType: "ai_job", targetId: jobId, metadata: { kind: "tone_enhance", mode, count: r.suggestions.length } });
      revalidatePath("/alat/asisten");
      return { ok: true, mode, suggestions: r.suggestions, jobId, disclaimer: r.disclaimer };
    } catch (e) {
      if (!(e instanceof AiNotConfiguredError)) throw e;
      // Fallback deterministik (nol token): pemeriksaan EYD dasar supaya fitur tetap memberi nilai.
      const f = runScaffold("eyd_check", text);
      const jobId = await persistAiJob({
        ownerId: user.id, coreUserId: user.coreUserId, bimbinganId: bimbinganId ?? null,
        kind: "tone_enhance", model: "scaffold-local", inputPreview: text,
        tokensIn: f.tokensIn, tokensOut: f.tokensOut, content: f.content, data: { mode, eyd: f.data },
      });
      await writeAudit({ actor: user, action: "ai.run", targetType: "ai_job", targetId: jobId, metadata: { kind: "tone_enhance", mode, fallback: true } });
      revalidatePath("/alat/asisten");
      return { ok: true, mode, suggestions: [], jobId, disclaimer: TONE_DISCLAIMER, fallback: true, note: "AI belum aktif; menampilkan pemeriksaan EYD dasar dulu.", eyd: f.data };
    }
  } catch (e) {
    return fail(e);
  }
}

// ── Outline generator ──

type OutlineActionResult =
  | { ok: true; content: string; chapters: OutlineChapter[]; jobId: number; aiUsed: boolean; disclaimer: string }
  | Fail;

const outlineSchema = z.object({
  topic: z.string().trim().min(1, "Isi topik/judul dulu.").max(300),
  field: z.string().trim().max(120).optional(),
  bimbinganId: z.coerce.number().int().positive().optional(),
});

export async function generateOutlineText(input: unknown): Promise<OutlineActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif - alat AI terkunci.");
    await assertAiRateLimit(user.id);
    const { topic, field, bimbinganId } = outlineSchema.parse(input);

    const r = await generateOutline(topic, field);
    const jobId = await persistAiJob({
      ownerId: user.id, coreUserId: user.coreUserId, bimbinganId: bimbinganId ?? null,
      kind: "outline", model: r.model, inputPreview: topic,
      tokensIn: r.tokensIn, tokensOut: r.tokensOut, content: r.content, data: r.chapters,
    });
    await writeAudit({ actor: user, action: "ai.run", targetType: "ai_job", targetId: jobId, metadata: { kind: "outline", aiUsed: r.model !== "scaffold-local" } });
    revalidatePath("/alat/asisten");
    return { ok: true, content: r.content, chapters: r.chapters, jobId, aiUsed: r.model !== "scaffold-local", disclaimer: OUTLINE_DISCLAIMER };
  } catch (e) {
    return fail(e);
  }
}

// ── Abstract generator ──

type AbstractActionResult =
  | { ok: true; content: string; jobId: number; aiUsed: boolean; disclaimer: string; grounded?: boolean }
  | Fail;

const abstractSchema = z.object({
  input: z.string().trim().min(1, "Isi poin/isi bab dulu.").max(6000),
  bimbinganId: z.coerce.number().int().positive().optional(),
  moduleId: z.coerce.number().int().positive().optional(),
});

// Pastikan modul milik user (anti-IDOR) sebelum dipakai sebagai konteks AI.
async function assertOwnedModule(userId: number, moduleId: number): Promise<void> {
  const m = await prisma.module.findUnique({ where: { id: moduleId }, select: { uploaderId: true, deletedAt: true } });
  if (!m || m.deletedAt || m.uploaderId !== userId) throw new ForbiddenError("Dokumen tidak ditemukan.");
}

export async function generateAbstractText(input: unknown): Promise<AbstractActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif - alat AI terkunci.");
    await assertAiRateLimit(user.id);
    const { input: text, bimbinganId, moduleId } = abstractSchema.parse(input);

    // Grounding: kalau user memilih dokumen & Vectorize aktif, tarik potongan naskah relevan.
    let context = "";
    if (moduleId) {
      await assertOwnedModule(user.id, moduleId);
      context = await retrieveContext({ userId: user.id, docId: moduleId, query: text || "abstrak skripsi" });
    }

    const r = await generateAbstract(text, context);
    const jobId = await persistAiJob({
      ownerId: user.id, coreUserId: user.coreUserId, bimbinganId: bimbinganId ?? null,
      kind: "abstract", model: r.model, inputPreview: text,
      tokensIn: r.tokensIn, tokensOut: r.tokensOut, content: r.content, data: null,
    });
    await writeAudit({ actor: user, action: "ai.run", targetType: "ai_job", targetId: jobId, metadata: { kind: "abstract", aiUsed: r.model !== "scaffold-local", grounded: Boolean(context) } });
    revalidatePath("/alat/asisten");
    return { ok: true, content: r.content, jobId, aiUsed: r.model !== "scaffold-local", disclaimer: ABSTRACT_DISCLAIMER, grounded: Boolean(context) };
  } catch (e) {
    return fail(e);
  }
}

// ── Pemandu Metodologi (real AI) ──

type MethodologyActionResult =
  | { ok: true; content: string; jobId: number; aiUsed: boolean; disclaimer: string }
  | Fail;

const methodologySchema = z.object({
  topic: z.string().trim().min(1, "Isi topik/judul dulu.").max(300),
  problem: z.string().trim().max(2000).optional(),
  bimbinganId: z.coerce.number().int().positive().optional(),
});

export async function generateMethodologyText(input: unknown): Promise<MethodologyActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif - alat AI terkunci.");
    await assertAiRateLimit(user.id);
    const { topic, problem, bimbinganId } = methodologySchema.parse(input);

    const r = await guideMethodology(topic, problem);
    const jobId = await persistAiJob({
      ownerId: user.id, coreUserId: user.coreUserId, bimbinganId: bimbinganId ?? null,
      kind: "methodology", model: r.model, inputPreview: topic,
      tokensIn: r.tokensIn, tokensOut: r.tokensOut, content: r.content, data: null,
    });
    await writeAudit({ actor: user, action: "ai.run", targetType: "ai_job", targetId: jobId, metadata: { kind: "methodology", aiUsed: r.model !== "scaffold-local" } });
    revalidatePath("/alat/asisten");
    return { ok: true, content: r.content, jobId, aiUsed: r.model !== "scaffold-local", disclaimer: METHODOLOGY_DISCLAIMER };
  } catch (e) {
    return fail(e);
  }
}

// ── Ingestion naskah untuk grounding (Vectorize) ──
// User memilih dokumen (aksi eksplisit = consent + gerbang biaya) → embed → Vectorize.
// Bisa terima `text` tempelan (dev/lokal) atau baca berkas teks modul; PDF/GCS via job di produksi.

type IngestActionResult =
  | { ok: true; chunks: number; message: string }
  | Fail;

const ingestSchema = z.object({
  moduleId: z.coerce.number().int().positive(),
  text: z.string().trim().max(200_000).optional(),
});

export async function ingestDocumentForAI(input: unknown): Promise<IngestActionResult> {
  try {
    const user = await getSessionUser();
    if (!user) throw new ForbiddenError("Sesi berakhir. Masuk lagi, ya.");
    if (!(await hasThesisAccess(user.id))) throw new ForbiddenError("Bimbingan belum aktif - alat AI terkunci.");
    const { moduleId, text } = ingestSchema.parse(input);

    const m = await prisma.module.findUnique({
      where: { id: moduleId },
      select: { uploaderId: true, deletedAt: true, title: true, originalName: true, filePath: true },
    });
    if (!m || m.deletedAt || m.uploaderId !== user.id) throw new ForbiddenError("Dokumen tidak ditemukan.");

    if (!vectorizeConfigured()) {
      return { ok: false, error: "Grounding (Vectorize) belum diaktifkan. Set CF_VECTORIZE_INDEX di server." };
    }

    const body = (text && text.trim()) || (await readModuleText(m.filePath)) || "";
    if (!body.trim()) {
      return { ok: false, error: "Isi naskah belum bisa dibaca otomatis (PDF/DOCX diproses di server). Tempel isi bab untuk sekarang." };
    }

    const res = await ingestText({ userId: user.id, docId: moduleId, title: m.title ?? m.originalName ?? undefined, text: body });
    if (!res.ok) {
      return { ok: false, error: res.reason === "empty-text" ? "Teks kosong." : "Grounding belum aktif." };
    }
    await writeAudit({ actor: user, action: "ai.ingest", targetType: "module", targetId: moduleId, metadata: { chunks: res.chunks } });
    return { ok: true, chunks: res.chunks, message: `Naskah disiapkan untuk AI (${res.chunks} bagian terindeks).` };
  } catch (e) {
    return fail(e);
  }
}
