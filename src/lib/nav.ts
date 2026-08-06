import type { Role } from "@/lib/session";

export type IconKey =
  | "grid" | "flag" | "calendar" | "doc" | "chat" | "sparkle" | "quote"
  | "question" | "flame" | "users" | "shield" | "cap" | "target";

export type NavItem = { href: string; label: string; icon: IconKey };
export type NavGroup = { section: string; items: NavItem[] };

// Navigasi per peran. IA dangkal (≤3 klik ke tugas inti, blueprint §3). Label domain kampus (H2).
export function navFor(role: Role): NavGroup[] {
  if (role === "tutor") {
    return [
      {
        section: "Ringkasan",
        items: [{ href: "/", label: "Dashboard", icon: "grid" }],
      },
      {
        section: "Bimbingan",
        items: [
          { href: "/klien", label: "Klien saya", icon: "users" },
          { href: "/jadwal", label: "Jadwal & sesi", icon: "calendar" },
          { href: "/dokumen", label: "Antrian review", icon: "doc" },
          { href: "/chat", label: "Pesan", icon: "chat" },
        ],
      },
    ];
  }
  if (role === "admin") {
    return [
      {
        section: "Ringkasan",
        items: [{ href: "/", label: "Dashboard", icon: "grid" }],
      },
      {
        section: "Kelola",
        items: [
          { href: "/admin/pengguna", label: "Pengguna", icon: "users" },
          { href: "/admin/prodi", label: "Fakultas & Prodi", icon: "target" },
          { href: "/admin/bimbingan", label: "Bimbingan", icon: "cap" },
          { href: "/persetujuan", label: "Persetujuan tahap", icon: "flag" },
          { href: "/sidang", label: "Sidang akhir", icon: "question" },
          { href: "/admin/audit", label: "Jejak audit", icon: "shield" },
        ],
      },
    ];
  }
  if (role === "kaprodi") {
    return [
      {
        section: "Ringkasan",
        items: [{ href: "/", label: "Dashboard", icon: "grid" }],
      },
      {
        section: "Kaprodi",
        items: [
          { href: "/persetujuan", label: "Persetujuan tahap", icon: "flag" },
          { href: "/sidang", label: "Sidang akhir", icon: "question" },
        ],
      },
    ];
  }
  // klien
  return [
    {
      section: "Ringkasan",
      items: [{ href: "/", label: "Dashboard", icon: "grid" }],
    },
    {
      section: "Bimbingan",
      items: [
        { href: "/progres", label: "Progres BAB", icon: "flag" },
        { href: "/jadwal", label: "Jadwal & sesi", icon: "calendar" },
        { href: "/dokumen", label: "Dokumen", icon: "doc" },
        { href: "/chat", label: "Pesan", icon: "chat" },
      ],
    },
  ];
}
