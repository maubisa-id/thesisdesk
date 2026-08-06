import type { ReactNode } from "react";
import { EmptyState, ButtonLink } from "./kit";
import { IconShield, IconSparkle } from "./icons";

// Belum ada entitlement thesis aktif → fitur terkunci (default-deny). Ajak beli di Pusat Akun.
export function NoAccess({ accountUrl }: { accountUrl: string }) {
  return (
    <EmptyState
      icon={<IconShield className="h-6 w-6" />}
      title="Bimbingan belum aktif"
      desc="Akses fitur bimbingan & alat skripsi terbuka setelah paket bimbinganmu aktif. Selesaikan lewat Pusat Akun - aksesmu menyala otomatis begitu pembayaran dikonfirmasi."
      action={
        <ButtonLink href={`${accountUrl}/langganan/ubah`} external>
          Aktifkan bimbingan
        </ButtonLink>
      }
    />
  );
}

// Error DB (mis. belum di-seed / koneksi). Tampilkan pesan + kode untuk support (H9).
export function DbError({ error }: { error?: string | null }) {
  return (
    <EmptyState
      icon={<IconShield className="h-6 w-6" />}
      title="Data belum bisa dimuat"
      desc={
        "Terjadi kendala membaca data. Coba muat ulang halaman. Bila berlanjut, hubungi tim dengan menyebut kode ini." +
        (error ? ` (${error.slice(0, 80)})` : "")
      }
    />
  );
}

export function ComingSoon({ title, desc }: { title: string; desc?: string }) {
  return (
    <EmptyState
      icon={<IconSparkle className="h-6 w-6" />}
      title={title}
      desc={desc ?? "Fitur ini sedang disiapkan."}
    />
  );
}

export function DisclaimerBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-amber-600/15">
      <IconSparkle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
      <p className="leading-relaxed">{children}</p>
    </div>
  );
}
