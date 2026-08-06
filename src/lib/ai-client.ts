import "server-only";

// Klien Workers AI (teks) via AI Gateway. Dipakai fitur AI teks P1 (Tone Enhancer, Outline).
// Kontrak sederhana: callText(messages) -> { text, tokensIn, tokensOut, model, cached }.
//
// ENV (produksi; kalau kosong -> AiNotConfiguredError, pemanggil fallback ke stub deterministik):
//   CF_ACCOUNT_ID   : id akun Cloudflare
//   CF_AI_TOKEN     : API token dengan izin Workers AI (+ AI Gateway run)
//   CF_AI_GATEWAY   : slug AI Gateway (opsional; kalau di-set, lewat gateway -> analitik biaya + fallback + cache)
//   AI_TEXT_MODEL   : model teks (default llama-4-scout; dgn kredit startup bisa dinaikkan, mis. llama-3.3-70b)
//
// Kenapa lewat AI Gateway: observabilitas biaya per-request (ganti LangSmith), retry/fallback antar-model
// (circuit breaker), caching, dan budget cap - semua syarat di dokumen USP.

export class AiNotConfiguredError extends Error {
  constructor() {
    super("Workers AI belum dikonfigurasi (set CF_ACCOUNT_ID + CF_AI_TOKEN).");
    this.name = "AiNotConfiguredError";
  }
}

export type ChatRole = "system" | "user" | "assistant";
export type ChatMessage = { role: ChatRole; content: string };

export type AiTextResult = {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  cached: boolean;
};

export const DEFAULT_TEXT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

export function aiTextModel(): string {
  return process.env.AI_TEXT_MODEL || DEFAULT_TEXT_MODEL;
}

export function aiConfigured(): boolean {
  return Boolean(process.env.CF_ACCOUNT_ID && process.env.CF_AI_TOKEN);
}

const est = (s: string) => Math.max(1, Math.round(s.length / 4));

// Bangun URL: lewat AI Gateway bila CF_AI_GATEWAY di-set, kalau tidak langsung ke Workers AI.
function runUrl(model: string): string {
  const acct = process.env.CF_ACCOUNT_ID!;
  const gw = process.env.CF_AI_GATEWAY;
  const m = model.replace(/^@/, ""); // path pakai bentuk tanpa "@"
  if (gw) {
    return `https://gateway.ai.cloudflare.com/v1/${acct}/${gw}/workers-ai/@${m}`;
  }
  return `https://api.cloudflare.com/client/v4/accounts/${acct}/ai/run/@${m}`;
}

type WorkersAiResponse = {
  result?: {
    // Workers AI mengembalikan string; TAPI untuk sebagian model (mis. llama-3.3-70b) bila keluaran
    // berupa JSON, Cloudflare mem-parse `response` menjadi objek/array. Envelope OpenAI-compat juga
    // menaruh teks mentah di `choices[0].message.content`. coerceText() menangani ketiga bentuk.
    response?: unknown;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
  };
  success?: boolean;
  errors?: Array<{ message?: string }>;
};

// Normalkan keluaran model ke STRING, apa pun bentuk envelope-nya:
//  - string            -> apa adanya
//  - objek/array (JSON) -> JSON.stringify (agar extractJsonArray tetap jalan)
//  - kosong            -> fallback ke choices[0].message.content (OpenAI-compat)
function coerceText(result: WorkersAiResponse["result"]): string {
  const r = result?.response;
  if (typeof r === "string" && r.trim()) return r;
  if (r && typeof r === "object") {
    try {
      return JSON.stringify(r);
    } catch {
      /* lanjut ke fallback */
    }
  }
  const choice = result?.choices?.[0]?.message?.content;
  if (typeof choice === "string" && choice.trim()) return choice;
  return typeof r === "string" ? r : "";
}

export type CallTextOptions = {
  maxTokens?: number;
  temperature?: number;
  timeoutMs?: number;
  model?: string; // override AI_TEXT_MODEL untuk panggilan tertentu
};

// Panggil model teks. Melempar AiNotConfiguredError bila env kosong; Error biasa bila HTTP/parse gagal.
export async function callText(
  messages: ChatMessage[],
  opts: CallTextOptions = {},
): Promise<AiTextResult> {
  if (!aiConfigured()) throw new AiNotConfiguredError();

  const model = opts.model || aiTextModel();
  const body = {
    messages,
    max_tokens: opts.maxTokens ?? 700,
    temperature: opts.temperature ?? 0.3,
  };

  const res = await fetch(runUrl(model), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.CF_AI_TOKEN}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
    cache: "no-store",
  });

  const cached = res.headers.get("cf-aig-cache-status") === "HIT";

  if (!res.ok) {
    let detail = `${res.status}`;
    try {
      const j = (await res.json()) as WorkersAiResponse;
      detail = j.errors?.[0]?.message ?? detail;
    } catch {
      /* abaikan */
    }
    throw new Error(`Workers AI gagal: ${detail}`);
  }

  const json = (await res.json()) as WorkersAiResponse;
  const text = coerceText(json.result);
  const promptText = messages.map((m) => m.content).join("\n");
  const tokensIn = json.result?.usage?.prompt_tokens ?? est(promptText);
  const tokensOut = json.result?.usage?.completion_tokens ?? est(text);

  return { text, tokensIn, tokensOut, model, cached };
}

// ── Utilitas ──

// Ekstrak blok JSON array pertama dari teks model (model kadang membungkus dengan prosa).
// Mengembalikan string "[ ... ]" atau null. Balanced-scan, mengabaikan kurung di dalam string.
export function extractJsonArray(text: string): string | null {
  const start = text.indexOf("[");
  if (start === -1) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "[") depth++;
    else if (c === "]") {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  return null;
}

// Redaksi PII ringan sebelum kirim ke model (potongan editorial biasanya minim PII, ini backstop).
// Mengganti email, NIM-like (8-12 digit), dan pola "NIM: xxxx" - bukan sensor menyeluruh.
export function redactLightPII(text: string): string {
  return text
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, "[email]")
    .replace(/\b\d{8,12}\b/g, "[nomor]");
}
