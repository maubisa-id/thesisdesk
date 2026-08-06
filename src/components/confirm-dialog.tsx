"use client";

import { useState, useTransition, type ReactNode, type ReactElement } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

type Result = { ok: true; message?: string } | { ok: false; error: string };

// Dialog konfirmasi untuk KEPUTUSAN KRITIS (setujui/tolak sesi, hapus). Memakai AlertDialog
// (scrim gelap + focus-trap + esc) → mengunci fokus (Cognitive Interruption). Menangani:
//  • pending: tombol jadi spinner + DISABLED → cegah double-submit (idempotensi, UXPin #8).
//  • error terkendali dari server: tetap terbuka, tampilkan pesan, boleh coba lagi.
//  • KONEKSI TERPUTUS (throw): JANGAN tutup; tampilkan pesan pulih ("periksa internet, coba lagi")
//    supaya aksi tak "hilang diam-diam" (NN/g H9 error recovery).
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  variant = "default",
  onConfirm,
  successMessage,
}: {
  trigger: ReactElement;
  title: string;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "destructive";
  onConfirm: () => Promise<Result>;
  successMessage?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleConfirm() {
    setError(null);
    start(async () => {
      try {
        const res = await onConfirm();
        if (res.ok) {
          toast.success(successMessage ?? res.message ?? "Berhasil.");
          setOpen(false);
        } else {
          setError(res.error);
        }
      } catch {
        setError("Koneksi terputus. Aksimu belum tersimpan, jadi tidak ada yang berubah. Periksa internet lalu coba lagi.");
      }
    });
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(o) => {
        if (pending) return; // jangan tutup saat proses berjalan
        setOpen(o);
        if (!o) setError(null);
      }}
    >
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description ? <AlertDialogDescription>{description}</AlertDialogDescription> : null}
        </AlertDialogHeader>
        {error ? (
          <p role="alert" className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        ) : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction
            variant={variant === "destructive" ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 className="animate-spin" /> : null}
            {pending ? "Memproses" : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
