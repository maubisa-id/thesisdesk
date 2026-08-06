# Berkontribusi ke thesis-next

Terima kasih sudah tertarik. Repo ini adalah **sistem manajemen bimbingan skripsi** (thesis
management system) berbasis Next.js. Panduan singkat agar kontribusi cepat di-merge.

## Setup dev (nol-setup, SQLite)

```bash
npm install
npm run db:setup   # generate Prisma client + buat prisma/dev.db
npm run seed       # data contoh (akun + bimbingan + milestone)
npm run dev        # http://localhost:3100
```

Akun demo (kata sandi `password123`): `admin@maubisa.id`, `andi.tutor@maubisa.id`,
`rina@student.ac.id`. Ganti seed ini untuk data netral bila mem-fork untuk institusimu.

## Gate sebelum PR (wajib hijau semua)

Jalankan lokal sebelum push. CI juga menjalankan ini.

```bash
npx tsc --noEmit     # 0 error tipe
npx eslint .         # 0 error lint
npm run build        # build produksi sukses
```

## Aturan rumah (house rules)

Ini bukan formalitas; PR yang melanggar akan diminta revisi.

1. **Warna via token, bukan hardcoded.** Pakai `bg-card`, `text-muted-foreground`, `border-border`,
   `text-brand-600`, dst. **Jangan** `bg-zinc-50`, `ring-black/[0.05]`, `bg-white` solid. Ini
   menjaga konsistensi light/dark (Law of Similarity).
2. **Tanpa em-dash / en-dash** (`-` `-`) di mana pun dalam `src/` & `prisma/`. Pakai hyphen `-`.
   (Preferensi proyek; juga menghindari artefak encoding.)
3. **Aksesibilitas WCAG 2.2 AA.** Target sentuh >= 44px (pointer kasar), `focus-visible` jelas,
   teks terbaca >= 11px, kontrol pakai elemen semantik + `aria-*` (mis. `role="switch"`), bukan
   `<div onClick>`.
4. **Grid responsif** selalu punya base `grid-cols-1` sebelum `sm:/lg:` (cegah overflow mobile).
5. **Keamanan (Definition of Secure).** Validasi input dengan **zod** di boundary Server Action;
   cek kepemilikan objek (anti-IDOR) di tiap query; catat aksi sensitif ke `audit_logs`; **jangan**
   `dangerouslySetInnerHTML` untuk output AI/user.
6. **AI = scaffolding, bukan ghostwriter.** Fitur AI wajib menampilkan disclaimer + rating; jangan
   memposisikan AI sebagai penulis skripsi.

## Konvensi commit

`type(scope): ringkasan` (mis. `feat(jadwal): cegah double-book`, `fix(sitasi): toggle a11y`).
Type: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`.

## Struktur

```
src/app/(app)/...   rute di balik login (shell + nav per peran)
src/components/...   ui (shadcn/Base UI), shell, dashboard, features
src/lib/...          prisma, auth, session, rbac, audit, actions, queries
prisma/              schema + seed
```

## Lisensi kontribusi

Dengan mengirim PR, kamu setuju kontribusimu dilisensikan di bawah lisensi repo (lihat `LICENSE`).
