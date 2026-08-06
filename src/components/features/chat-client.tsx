"use client";

import { useState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Paperclip, X, FileText, Loader2 } from "lucide-react";
import { sendMessage, markConversationRead, uploadChatAttachment } from "@/lib/actions";
import { Avatar } from "@/components/kit";
import { IconArrow, IconChat } from "@/components/icons";
import { waktu, isOnline, presenceLabel } from "@/lib/format";

export type ChatMessage = {
  id: number;
  fromMe: boolean;
  content: string;
  attachment?: string | null;
  createdAt: string;
};
export type Partner = { id: number; name: string; avatarUrl?: string | null; lastSeenAt?: string | null };

function fileNameFromPath(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d+-/, "");
}

// Titik presence hijau (online < 5 menit) - paritas isOnline Laravel lama.
function PresenceDot({ lastSeenAt, className = "" }: { lastSeenAt?: string | null; className?: string }) {
  if (!isOnline(lastSeenAt)) return null;
  return (
    <span className={`block size-2.5 rounded-full bg-emerald-500 ring-2 ring-white ${className}`} aria-hidden />
  );
}

export function ChatClient({
  partners,
  initialPartnerId,
  messages,
}: {
  partners: Partner[];
  initialPartnerId: number | null;
  messages: Record<number, ChatMessage[]>;
}) {
  const [activeId, setActiveId] = useState<number | null>(initialPartnerId);
  const [threads, setThreads] = useState(messages);
  const [draft, setDraft] = useState("");
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const active = partners.find((p) => p.id === activeId) ?? null;
  const thread = activeId != null ? (threads[activeId] ?? []) : [];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [thread.length, activeId]);

  useEffect(() => {
    if (activeId != null) markConversationRead(activeId);
  }, [activeId]);

  function pushMessage(id: number, content: string, attachment: string | null) {
    const optimistic: ChatMessage = { id: Date.now(), fromMe: true, content, attachment, createdAt: new Date().toISOString() };
    setThreads((t) => ({ ...t, [id]: [...(t[id] ?? []), optimistic] }));
    return optimistic.id;
  }

  function send(e: React.FormEvent) {
    e.preventDefault();
    if (!activeId || draft.trim().length === 0) return;
    const text = draft.trim();
    setError(null);
    setDraft("");
    const optimisticId = pushMessage(activeId, text, null);
    start(async () => {
      const res = await sendMessage({ receiverId: activeId, content: text });
      if (!res.ok) {
        setError(res.error);
        setThreads((t) => ({ ...t, [activeId]: (t[activeId] ?? []).filter((m) => m.id !== optimisticId) }));
      }
    });
  }

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !activeId) return;
    const targetId = activeId;
    setError(null);
    setUploading(true);
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      try {
        const up = await uploadChatAttachment(fd);
        if (!up.ok) {
          setError(up.error);
          toast.error(up.error);
          return;
        }
        const optimisticId = pushMessage(targetId, "", up.path);
        const res = await sendMessage({ receiverId: targetId, content: "", attachment: up.path });
        if (!res.ok) {
          setError(res.error);
          setThreads((t) => ({ ...t, [targetId]: (t[targetId] ?? []).filter((m) => m.id !== optimisticId) }));
        } else {
          toast.success("Berkas terkirim.");
        }
      } finally {
        setUploading(false);
        if (fileRef.current) fileRef.current.value = "";
      }
    });
  }

  if (partners.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center rounded-3xl border border-dashed border-border bg-card px-6 py-16 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><IconChat className="size-6" /></span>
        <p className="mt-4 text-sm font-semibold text-foreground">Belum ada percakapan</p>
        <p className="mt-1 max-w-sm text-xs text-muted-foreground">Percakapan muncul begitu tutor & klien terhubung dalam bimbingan.</p>
      </div>
    );
  }

  return (
    <div className="grid h-full min-h-0 gap-3 rounded-3xl border border-border bg-card p-2 sm:grid-cols-[264px_1fr]">
      {/* Daftar percakapan */}
      <aside className={`min-h-0 overflow-y-auto rounded-2xl bg-muted/40 p-2 ${activeId != null ? "hidden sm:block" : ""}`}>
        <ul className="space-y-1">
          {partners.map((p) => {
            const last = (threads[p.id] ?? []).at(-1);
            const isActive = p.id === activeId;
            const preview = last ? (last.content || "Mengirim berkas") : "Mulai percakapan";
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setActiveId(p.id)}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors ${isActive ? "bg-card shadow-sm ring-1 ring-border" : "hover:bg-card/70"}`}
                >
                  <span className="relative shrink-0">
                    <Avatar name={p.name} url={p.avatarUrl} size={40} />
                    <PresenceDot lastSeenAt={p.lastSeenAt} className="absolute -bottom-0.5 -right-0.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{preview}</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* Thread */}
      <section className={`flex min-h-0 flex-col rounded-2xl ${activeId == null ? "hidden sm:flex" : ""}`}>
        {active ? (
          <>
            <header className="flex items-center gap-3 border-b border-border px-4 py-3">
              <button type="button" onClick={() => setActiveId(null)} className="sm:hidden" aria-label="Kembali ke daftar">
                <IconArrow className="size-5 rotate-180 text-muted-foreground" />
              </button>
              <span className="relative shrink-0">
                <Avatar name={active.name} url={active.avatarUrl} size={38} />
                <PresenceDot lastSeenAt={active.lastSeenAt} className="absolute -bottom-0.5 -right-0.5" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">{active.name}</p>
                <p className={`text-xs ${isOnline(active.lastSeenAt) ? "text-emerald-600" : "text-muted-foreground"}`}>
                  {presenceLabel(active.lastSeenAt)}
                </p>
              </div>
            </header>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-4 py-4">
              {thread.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">Belum ada pesan. Sapa dulu, yuk 👋</p>
              ) : (
                thread.map((m) => (
                  <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${m.fromMe ? "bg-brand-500 text-white" : "bg-muted text-foreground"}`}>
                      {m.attachment ? (
                        <a
                          href={m.attachment}
                          target="_blank"
                          rel="noopener noreferrer"
                          className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs font-medium ${m.fromMe ? "bg-white/15 hover:bg-white/25" : "bg-card ring-1 ring-border hover:bg-accent"}`}
                        >
                          <FileText className="size-4 shrink-0" />
                          <span className="truncate">{fileNameFromPath(m.attachment)}</span>
                        </a>
                      ) : null}
                      {m.content ? <p className={`leading-relaxed ${m.attachment ? "mt-1.5" : ""}`}>{m.content}</p> : null}
                      <p className={`mt-1 text-[11px] ${m.fromMe ? "text-white/70" : "text-muted-foreground"}`}>{waktu(m.createdAt)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={send} className="flex items-center gap-2 border-t border-border p-3">
              <input ref={fileRef} type="file" onChange={onPickFile} className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.webp,.xlsx,.pptx,.zip" />
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading || pending}
                className="flex size-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:opacity-50"
                aria-label="Lampirkan berkas"
              >
                {uploading ? <Loader2 className="size-5 animate-spin" /> : <Paperclip className="size-5" />}
              </button>
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="Tulis pesan…"
                aria-label="Pesan"
                className="min-h-11 min-w-0 flex-1 rounded-full bg-muted px-4 py-2.5 text-sm ring-1 ring-border placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand-400"
              />
              <button type="submit" disabled={pending || uploading || draft.trim().length === 0} className="flex size-11 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white hover:bg-brand-600 disabled:opacity-50" aria-label="Kirim">
                <IconArrow className="size-5" />
              </button>
            </form>
            {error ? (
              <p role="alert" className="flex items-center gap-1.5 px-4 pb-2 text-xs text-destructive">
                <X className="size-3.5" /> {error}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">Pilih percakapan untuk mulai.</div>
        )}
      </section>
    </div>
  );
}
