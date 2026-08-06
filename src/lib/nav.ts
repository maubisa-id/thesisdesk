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
          { href: "/admin/bimbingan", label: "Bimbingan", icon: "cap" },
          { href: "/admin/audit", label: "Jejak audit", icon: "shield" },
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
    {
      section: "Alat Skripsi",
      items: [
        { href: "/alat/asisten", label: "Asisten Nulis AI", icon: "sparkle" },
        { href: "/alat/sitasi", label: "Manajer Sitasi", icon: "quote" },
        { href: "/alat/sidang", label: "Simulasi Sidang", icon: "question" },
        { href: "/alat/streak", label: "Streak Menulis", icon: "flame" },
      ],
    },
  ];
}
