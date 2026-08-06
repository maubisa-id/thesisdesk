# thesis-next - Thesis Management System

![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-0a48b7.svg)
![Next.js](https://img.shields.io/badge/Next.js-16-000.svg)
![Prisma](https://img.shields.io/badge/Prisma-6-2d3748.svg)

Platform **bimbingan skripsi** (thesis-supervision) yang siap dipakai kampus, instansi, atau
tim bimbingan mandiri: progres BAB, penjadwalan sesi + Google Meet, dokumen berversi dengan
anotasi inline, chat tutor-klien, dan alat skripsi (asisten nulis AI, manajer sitasi, simulasi
sidang, streak menulis). Dibangun dengan **Next.js 16 + Prisma**, berjalan **nol-setup di SQLite**
untuk lokal dan siap **satu-perintah Docker** untuk deploy.

Ini juga reference implementation dari redesign **Maubisa Lulus** (dari Laravel/Filament ke
Next.js, pola strangler). Fondasinya: design system "Ruang Belajar yang Tenang", Nielsen 10,
WCAG 2.2 AA, keamanan enterprise, dan arsitektur hub-and-spoke (identitas/tagihan/akses di core;
state bimbingan di DB thesis; tanpa FK lintas-DB). Integrasi khusus Maubisa (hub notifikasi/akun)
bersifat **opsional** - kosongkan env-nya dan aplikasi tetap jalan mandiri.

## Self-host (satu perintah, Docker)

```bash
cp .env.example .env      # isi BETTER_AUTH_SECRET (string acak panjang)
docker compose up         # app di http://localhost:3100 + MySQL 8.4, migrasi + generate otomatis
```

Untuk fork/kontribusi lihat [CONTRIBUTING.md](CONTRIBUTING.md), laporan keamanan di
[SECURITY.md](SECURITY.md). Lisensi: **[AGPL-3.0](LICENSE)** (lihat catatan lisensi di bawah).

## Stack

| Lapisan | Pilihan |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript + React 19 |
| UI | **shadcn/ui** (Base UI + Lucide, standar industri) + Tailwind v4 · aksen **cobalt** #0a48b7 · Geist (UI) + Cabinet Grotesk (display) |
| Auth/SSO | Better Auth (email+password lokal; cookie `.maubisa.id` SSO-ready) |
| ORM/DB | Prisma 6 - **SQLite (lokal)**, MySQL `db-thesis-maubisa` (produksi) |
| Validasi | zod (boundary Server Action) |

## Jalankan lokal (nol setup - SQLite)

```bash
npm install
npm run db:setup     # generate Prisma client + buat SQLite (prisma/dev.db)
npm run seed         # isi data contoh (akun + bimbingan + milestone + dst.)
npm run dev          # http://localhost:3100
```

### Akun demo (kata sandi: `password123`)

| Peran | Email |
|---|---|
| Admin | `admin@maubisa.id` |
| Tutor | `andi.tutor@maubisa.id` · `sinta.tutor@maubisa.id` |
| Klien | `rina@student.ac.id` · `dinda@student.ac.id` · `bagus@student.ac.id` |

## Fitur (blueprint IA)

- **Dashboard per peran** - Klien (progress ring BAB, jadwal, pesan, tugas AI), Tutor (antrian
  review, klien *stuck* ≥7 hari, jadwal), Admin (metrik + jejak audit).
- **Bimbingan** - Progres BAB (Kanban, keyboard-accessible), Jadwal & Sesi (ajukan/approve +
  GMeet), Dokumen (unggah + versi + **anotasi inline** + thread), Pesan (chat tutor↔klien).
- **Alat Skripsi (USP)** - Asisten Nulis AI (**scaffolding, bukan ghostwriter** + disclaimer),
  Manajer Sitasi (DOI/Crossref → APA/IEEE), Simulasi Sidang (bank soal + mode latihan), Streak
  Menulis (heatmap konsistensi).

## Keamanan (Definition of Secure - Fondasi §5.4)

- **Default-deny** akses via `entitlements` (`scope='thesis'`), dihitung lazy saat dibaca.
- **RBAC/Policy terpusat** (`src/lib/rbac.ts`) - cegah IDOR antar-klien di tiap query.
- **Audit log** aksi/akses sensitif (`src/lib/audit.ts`) - append-only, tanpa PII mentah.
- **Validasi zod** di boundary Server Action + **output AI di-encode** (tanpa `dangerouslySetInnerHTML`).
- Header keamanan (`next.config.ts`), rate-limit auth (Better Auth), noindex.

## Migrasi ke MySQL (produksi)

Samakan tiga hal (guard `src/lib/db-config.ts` melempar error bila tak konsisten):
1. `prisma/schema.prisma` → `datasource.provider = "mysql"` (atau `npm run db:provider` via `DB_PROVIDER`)
2. `.env` → `DB_PROVIDER="mysql"`
3. `.env` → `DATABASE_URL="mysql://…/db-thesis-maubisa"`

Lalu `npm run db:setup`. Better Auth ikut ke MySQL yang sama; set `BETTER_AUTH_URL=https://thesis.maubisa.id`
untuk cookie SSO `.maubisa.id`. **Catatan:** di produksi, DB thesis dikelola migration terpisah - 
mirror `entitlements` di sini hanya untuk demo lokal; sumber kebenaran akses tetap `maubisa_core`.

## Struktur

```
src/
├── app/
│   ├── (app)/            # rute di balik login (shell + nav per peran)
│   │   ├── progres, jadwal, dokumen, chat
│   │   ├── alat/{asisten,sitasi,sidang,streak}
│   │   ├── klien         # tutor: klien saya
│   │   └── admin/{pengguna,bimbingan,audit}
│   ├── masuk, daftar     # auth
│   └── api/auth/[...all] # Better Auth handler
├── components/{ui,shell,icons,states,dashboard,features,auth}
└── lib/{prisma,auth,session,entitlement,rbac,audit,actions,queries,citation,ai-scaffold,format,nav}
```

## Lisensi & open-core

Dilisensikan di bawah **GNU AGPL-3.0** (lihat [LICENSE](LICENSE)). Artinya bebas dipakai,
dipelajari, dimodifikasi, dan di-deploy - termasuk oleh kampus/instansi - selama modifikasi yang
dilayankan ke publik lewat jaringan ikut membuka source-nya. Ini melindungi kontribusi komunitas
dari fork tertutup, sekaligus tetap ramah adopsi non-komersial dan institusional.

Model **open-core**: repositori ini adalah fondasi thesis management system yang lengkap dan
berdiri sendiri. Fitur diferensiasi komersial khusus Maubisa (mis. integrasi hub akun/tagihan,
pipeline AI berbayar, federasi admin lintas-produk) berada di luar repositori ini; titik
integrasinya sudah di-abstraksi lewat env opsional sehingga fork tetap berjalan penuh tanpa itu.

> Catatan lisensi: AGPL-3.0 adalah rekomendasi default untuk melindungi karya sambil memaksimalkan
> adopsi. Bila kebutuhanmu berbeda (mis. ingin adopsi korporat lebih longgar -> Apache-2.0/MIT,
> atau dual-license komersial), ganti berkas `LICENSE` sebelum rilis publik. Keputusan lisensi
> final ada di pemilik hak cipta.
