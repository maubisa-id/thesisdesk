<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./.github/assets/maubisa-logo-white.png">
  <img alt="Maubisa" src="./.github/assets/maubisa-logo.png" height="52">
</picture>

# Thesisdesk

**Satu ruang untuk bimbingan skripsi, dari progres BAB sampai sidang.**

Platform bimbingan skripsi siap pakai untuk kampus, program studi, atau tim bimbingan mandiri:
progres BAB per milestone, penjadwalan sesi dengan Google Meet otomatis, dokumen berversi dengan
anotasi inline, chat tutor-mahasiswa, dan modul akademik kampus (SSO, SIAKAD, sidang, multi-tenant).
Ini bukan prototipe atau demo template kosong: kode yang sama persis menjalankan
[`thesis.maubisa.id`](https://thesis.maubisa.id) untuk mahasiswa dan tutor sungguhan setiap hari.
Kami membukanya supaya Anda tidak perlu menghabiskan waktu tim membangun ulang yang sudah teruji.

<p>
  <a href="https://thesis.maubisa.id"><img alt="Demo langsung" src="https://img.shields.io/badge/Demo%20langsung-thesis.maubisa.id-0a48b7?logo=vercel&logoColor=white"></a>
  <a href="https://github.com/maubisa-id/thesisdesk/generate"><img alt="Gunakan template ini" src="https://img.shields.io/badge/Gunakan%20template%20ini-2ea44f?logo=github&logoColor=white"></a>
</p>

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/maubisa-id/thesisdesk)

<p>
  <a href="https://github.com/maubisa-id/thesisdesk/actions/workflows/ci.yml"><img alt="Status CI" src="https://github.com/maubisa-id/thesisdesk/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://github.com/maubisa-id/thesisdesk/releases/latest"><img alt="Rilis terbaru" src="https://img.shields.io/github/v/release/maubisa-id/thesisdesk?color=3FB950&label=rilis"></a>
  <a href="./LICENSE"><img alt="Lisensi" src="https://img.shields.io/github/license/maubisa-id/thesisdesk?color=3FB950"></a>
  <a href="https://github.com/maubisa-id/thesisdesk/commits/main"><img alt="Commit terakhir" src="https://img.shields.io/github/last-commit/maubisa-id/thesisdesk"></a>
</p>

<p>
  <a href="https://nextjs.org/"><img alt="Next.js" src="https://img.shields.io/badge/Next.js-16-000000?logo=nextdotjs&logoColor=white"></a>
  <a href="https://react.dev/"><img alt="React" src="https://img.shields.io/badge/React-19-149ECA?logo=react&logoColor=white"></a>
  <a href="https://www.typescriptlang.org/"><img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white"></a>
  <a href="https://tailwindcss.com/"><img alt="Tailwind CSS" src="https://img.shields.io/badge/Tailwind-v4-38BDF8?logo=tailwindcss&logoColor=white"></a>
  <a href="https://www.prisma.io/"><img alt="Prisma" src="https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma&logoColor=white"></a>
  <a href="https://www.better-auth.com/"><img alt="Better Auth" src="https://img.shields.io/badge/Better%20Auth-1.6-000000"></a>
</p>

<br/>

<img src="./.github/assets/og.png" alt="Thesisdesk" width="840">

</div>

---

> [!TIP]
> **Coba dulu sebelum dipakai: [thesis.maubisa.id](https://thesis.maubisa.id).**
> Masuk sebagai klien `rina@student.ac.id`, tutor `andi.tutor@maubisa.id`, atau admin
> `admin@maubisa.id` (sandi `password123` untuk semuanya). Ini bukan sandbox terpisah - Anda
> login ke instance produksi yang sama yang dipakai pengguna asli.

## Kenapa Anda butuh ini

Kalau Anda pernah mencoba mengelola bimbingan skripsi lewat kombinasi grup WhatsApp, Google Form,
dan spreadsheet, Anda tahu persis masalahnya: progres mahasiswa tercecer di banyak tempat, tutor
lupa catatan sesi minggu lalu, revisi dokumen menumpuk jadi puluhan pesan yang sulit ditelusuri,
dan admin baru sadar seorang mahasiswa "hilang" setelah berbulan-bulan tanpa progres.

Membangun sistem yang benar untuk masalah ini bukan proyek akhir pekan. Anda butuh dashboard per
peran yang masuk akal (mahasiswa tidak boleh mengintip data mahasiswa lain), papan progres per bab,
penjadwalan yang benar-benar terhubung ke Google Meet, dokumen berversi dengan anotasi alih-alih
revisi berserakan di chat, sampai jejak audit untuk kepatuhan. Tim berpengalaman biasanya butuh
berminggu-minggu untuk itu semua, dan bagian yang paling gampang salah - hak akses dan keamanan -
justru yang paling sering diremehkan waktunya.

Thesisdesk sudah menyelesaikan semua itu, dan sudah terbukti jalan di dunia nyata: kode yang sama
menangani mahasiswa dan tutor produksi di `thesis.maubisa.id` setiap hari, bukan cuma lolos demo.
Anda tinggal ganti merek, sesuaikan alur bila perlu, dan jalankan.

## Untuk siapa ini

- **Program studi atau fakultas** yang masih mengelola bimbingan lewat WhatsApp grup dan tanda
  tangan basah, dan butuh sistem yang mencatat progres, sesi, dan dokumen di satu tempat yang bisa
  diaudit - lengkap dengan struktur Fakultas/Prodi, alur persetujuan kaprodi, dan integrasi SIAKAD.
- **Lembaga bimbingan atau tutor privat** yang menjual jasa pendampingan skripsi/tesis dan butuh
  dashboard profesional untuk klien mereka, bukan folder Google Drive yang berantakan.
- **Tim produk atau startup EdTech** yang ingin membangun layanan serupa tanpa menghabiskan
  berbulan-bulan membangun ulang RBAC, audit trail, dan integrasi kalender dari nol.
- **Developer yang mempelajari pola arsitektur Next.js kelas produksi**: multi-peran, SSO
  hub-and-spoke opsional, federasi admin API, dan keamanan default-deny - semua kode sungguhan yang
  sudah dipakai pengguna asli, bukan contoh dari tutorial.

## Fitur

### Inti bimbingan

- **Dashboard per peran.** Mahasiswa (cincin progres BAB, jadwal, tugas), tutor (antrean review,
  klien yang macet 7 hari lebih, jadwal), admin (metrik plus jejak audit) - masing-masing melihat
  yang relevan untuknya saja, bukan satu dashboard generik untuk semua orang.
- **Progres BAB.** Papan Kanban milestone per bab (proposal, BAB 1-5, revisi, sidang) yang bisa
  dioperasikan penuh lewat keyboard, sehingga tutor dan mahasiswa selalu tahu persis di tahap mana.
- **Jadwal dan sesi.** Mahasiswa mengajukan, tutor menyetujui, tautan **Google Meet** dibuat
  otomatis lewat Calendar API (bukan tautan manual yang gampang basi), plus catatan sesi dan
  rekaman supaya progres tiap pertemuan tidak menguap begitu sesi selesai.
- **Dokumen berversi.** Unggah naskah, simpan versi, beri **anotasi inline** dan diskusi ber-thread
  langsung di dokumen - revisi jadi jejak yang bisa ditelusuri, bukan pesan yang tenggelam di chat.
- **Pesan real-time.** Chat tutor-mahasiswa dengan indikator kehadiran, terpisah rapi dari alur
  revisi dokumen supaya percakapan penting tidak bercampur dengan obrolan santai.
- **Notifikasi.** Pemberitahuan dalam aplikasi (jadwal disetujui, berkas baru, pesan) dengan penanda
  belum-dibaca; email bersifat opsional lewat hub, jadi tetap jalan penuh tanpa SMTP sendiri.
- **Kuota sesi per paket.** Model paket = jatah pertemuan (mis. Sempro 8 sesi, Wisuda 16 sesi),
  bukan langganan waktu - cocok untuk model bisnis bimbingan yang jual per paket, bukan per bulan.

### Modul akademik kampus

Bagian ini yang biasanya paling mahal dibangun sendiri, dan sepenuhnya opsional (mati secara
default sampai Anda mengaktifkannya lewat environment variable):

- **Struktur Fakultas dan Program Studi** dengan alur bertingkat (proposal → seminar proposal →
  sidang) plus **approval kaprodi** di tiap tahap kenaikan.
- **Sidang akhir**: penjadwalan, panel penguji, dan pembuatan berita acara PDF otomatis.
- **Integrasi SIAKAD**: webhook untuk sinkron roster mahasiswa dan API baca status skripsi, jadi
  data akademik tidak perlu diketik ulang secara manual.
- **SSO kampus via OIDC generik** (env-gated) - cocok untuk Google Workspace, Microsoft Entra,
  Keycloak, dan penyedia identitas kampus lain tanpa perlu tulis integrasi khusus.
- **White-label branding per institusi** dan **impor pengguna massal via CSV**, supaya onboarding
  satu angkatan tidak perlu dibuat akun satu-satu.
- **Fondasi multi-tenant** (`institution_id` per kampus) untuk yang mau menjalankan satu instance
  untuk beberapa institusi sekaligus.

### Keamanan dan tata kelola

- Akses **default-deny** berbasis hak (scope `thesis`): fitur bimbingan hanya terbuka untuk
  pengguna dengan entitlement aktif, gerbang RBAC terpusat mencegah mahasiswa mengintip data
  mahasiswa lain.
- **Jejak audit append-only** untuk aksi sensitif (baca dokumen, ubah peran, review, dll.),
  memenuhi kebutuhan kepatuhan ISO/SOC2/PDP.
- Validasi input dengan **zod** di setiap boundary Server Action, header keamanan standar
  (HSTS, CSP nonce, frame-ancestors), rate-limit pada endpoint auth, dan pengecekan tipe berkas
  dari **magic-byte** (bukan sekadar ekstensi file, supaya `.exe` tak bisa menyamar jadi `.pdf`).
- **Federasi admin (opsional).** API tipis `/admin/v1/*` (JWT HS256 server-to-server, anti-replay,
  mati secara default) agar sebuah pusat operator bisa menugaskan tutor, mengatur judul, dan
  memantau beban tutor tanpa login ulang. Lihat [docs/federation-admin-api.md](./docs/federation-admin-api.md).

## Kenapa bukan alternatif lain

- **Dibanding LMS umum (Moodle, Google Classroom, dsb.):** LMS dirancang untuk kelas dan materi
  belajar, bukan alur bimbingan satu-ke-satu dengan milestone per bab, kuota sesi per paket, dan
  approval berjenjang kaprodi. Memaksakannya butuh banyak akal-akalan yang tetap terasa janggal.
- **Dibanding kombinasi spreadsheet + WhatsApp + Google Drive:** berjalan di awal, tapi tidak
  terskala. Tidak ada kontrol akses per peran, tidak ada jejak audit, dan progres gampang hilang
  begitu jumlah mahasiswa bertambah.
- **Dibanding membangun dari nol:** peran-akses yang benar, jejak audit, integrasi kalender, dan
  keamanan upload adalah bagian yang paling mudah salah dan paling lama dikerjakan. Thesisdesk
  sudah menyelesaikan dan mengujinya di produksi, jadi tim Anda bisa langsung ke bagian yang
  benar-benar membedakan produk Anda.

## Cara kerjanya

```
Mahasiswa  --ajukan sesi-->  Tutor  --review + anotasi-->  Dokumen berversi
    |                          |
    +------- Progres BAB ------+       (milestone per bab, papan Kanban)
    |
    +------- Chat + Notifikasi

Identitas / tagihan / hak akses  --(opsional, lewat env)-->  Hub  akun.maubisa.id
Aksi operator lintas-produk       --(opsional, /admin/v1 JWT)-->  Federasi admin
```

Aturan intinya: **state bimbingan hidup di aplikasi ini**, sedangkan identitas, tagihan, dan hak
akses bisa ditumpangkan ke sebuah hub (pola hub-and-spoke, tanpa foreign key lintas-DB). Integrasi
hub itu **opsional**: kosongkan env-nya dan Thesisdesk tetap berjalan mandiri, notifikasi tetap
tampil di dalam aplikasi.

## Tech stack

| Bagian | Teknologi | Kenapa ini |
|--------|-----------|------------|
| Framework | [Next.js 16](https://nextjs.org/) (App Router, Server Components, Turbopack) | Server Components memangkas JS di klien; satu framework untuk halaman, API, dan middleware. |
| UI | [React 19](https://react.dev/) + [Tailwind CSS v4](https://tailwindcss.com/) + shadcn / Base UI | Komponen bisa dibaca dan diubah langsung, bukan tersembunyi di balik library UI tertutup. |
| Bahasa | [TypeScript](https://www.typescriptlang.org/) (strict) | Tipe end-to-end dari database sampai komponen, kesalahan ketahuan saat build. |
| ORM | [Prisma 6](https://www.prisma.io/) (SQLite untuk dev, MySQL untuk produksi) | Nol-setup di lokal (SQLite), migrasi aman ke MySQL terkelola saat produksi. |
| Auth | [Better Auth 1.6](https://www.better-auth.com/) (email + password, cookie SSO-ready) | Auth modern tanpa vendor lock-in, siap dihubungkan ke SSO kampus. |
| Penyimpanan dokumen | [Google Cloud Storage](https://cloud.google.com/storage) (opsional; default lokal saat dev) | Dokumen mahasiswa (PII) di bucket privat dengan signed URL, bukan URL publik. |
| Desain | Sistem "Ruang Belajar yang Tenang" (cream + cobalt, Cabinet Grotesk + Geist, WCAG 2.2 AA) | Kontras dan target sentuh diuji, bukan sekadar terlihat rapi di desktop. |

Angka konkret di baliknya: **24 model data** (Prisma) mencakup peran, entitlement, milestone,
dokumen, jadwal, audit, hingga struktur akademik kampus; **18 halaman** dan **13 route API**;
**~47 komponen React**; dan **33 automated test** (Vitest) yang mengunci logika RBAC, federasi
JWT, dan feed kalender ICS supaya regresi ketahuan sebelum sampai ke pengguna.

## Mulai cepat

Pilih salah satu cara memakai kode ini:

- **Tombol "Use this template"** (paling gampang): bikin repo baru milik Anda dengan riwayat bersih,
  [buka di sini](https://github.com/maubisa-id/thesisdesk/generate).
- **Salin langsung jadi folder baru** (tanpa membawa riwayat git):
  ```bash
  npx degit maubisa-id/thesisdesk nama-proyek-anda
  cd nama-proyek-anda
  ```
- **Fork lewat tombol di GitHub** kalau ingin tetap terhubung ke sumbernya, supaya gampang menarik
  pembaruan nanti.

Lalu jalankan (nol-setup, pakai SQLite):

```bash
npm install
cp .env.example .env          # minimal isi BETTER_AUTH_SECRET (openssl rand -base64 32)
npm run db:setup              # generate Prisma client + buat dev.db dari schema
npm run seed                  # data contoh + akun demo
npm run dev                   # http://localhost:3100
```

Atau sekali jalan dengan Docker (app + MySQL):

```bash
cp .env.example .env          # isi BETTER_AUTH_SECRET
docker compose up             # http://localhost:3100, migrasi + generate otomatis
```

**Akun demo (sandi `password123`):** admin `admin@thesisdesk.test`, tutor `andi.tutor@thesisdesk.test`
atau `sinta.tutor@thesisdesk.test`, mahasiswa `rina@student.ac.id`, `dinda@student.ac.id`,
`bagus@student.ac.id`. Butuh Node 22 (lihat [`.nvmrc`](./.nvmrc)).

## Pertanyaan yang sering muncul

**Ini beneran dipakai produksi, atau cuma demo template?**
Beneran dipakai. Ini persis kode yang menjalankan [thesis.maubisa.id](https://thesis.maubisa.id)
hari ini. Coba langsung pakai akun demo di bagian atas README ini - itu instance produksi yang sama,
bukan sandbox terpisah yang dipoles buat pamer.

**Apakah saya wajib pakai integrasi Maubisa (hub akun, notifikasi, federasi)?**
Tidak. Semua integrasi eksternal itu opsional dan mati secara default. Kosongkan env-nya dan
Thesisdesk tetap jalan penuh sebagai aplikasi mandiri, termasuk notifikasi (tetap tampil in-app).

**Boleh dipakai komersial? Ada biaya lisensi?**
Boleh, gratis, termasuk untuk kampus dan bisnis bimbingan berbayar. Lisensinya AGPL-3.0: kalau
Anda menjalankan versi modifikasi sebagai layanan jaringan untuk publik, source modifikasi itu
wajib ikut dibuka bagi penggunanya. Baca bagian [Lisensi](#lisensi) untuk detail lengkapnya.

**Fitur kampus (SIAKAD, SSO, sidang) bikin lebih berat kalau saya cuma butuh bimbingan sederhana?**
Tidak. Semuanya env-gated - kalau env-nya kosong, endpoint terkait otomatis nonaktif (balas 503
atau disembunyikan dari navigasi) dan tidak menambah beban di alur yang Anda pakai.

**Apakah brandingnya bisa saya ganti sepenuhnya?**
Bisa, dan sudah didesain untuk itu. Ikon aplikasi adalah SVG inline (bukan file gambar terkunci),
seed data sudah netral, dan ada wizard setup untuk isi nama plus logo institusi tanpa sentuh kode.
Lihat [Buat jadi milik Anda](#buat-jadi-milik-anda).

**Kalau saya fork, apakah saya kebagian pembaruan berikutnya?**
Iya, kalau Anda fork lewat tombol GitHub (bukan "Use this template" atau `degit`), Anda bisa
menarik pembaruan lewat `git fetch upstream` kapan saja perubahan baru masuk ke `main`.

**Kenapa Next.js, bukan Laravel/Django/Rails?**
Produksi awalnya memang Laravel; stack ini adalah hasil migrasi ke Next.js supaya satu bahasa
(TypeScript) dipakai dari database sampai UI, dan Server Components memangkas JavaScript yang
dikirim ke browser. Kalau tim Anda lebih nyaman di stack lain, struktur datanya (lihat
`prisma/schema.prisma`) tetap jadi referensi model domain yang bisa diporting.

## Environment

Semua variabel dijelaskan di [`.env.example`](./.env.example). Yang paling penting:

| Variabel | Wajib | Keterangan |
|----------|:-----:|------------|
| `DATABASE_URL` + `DB_PROVIDER` | ya | `file:./dev.db` (dev) atau `mysql://` (produksi) |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | ya | rahasia acak plus origin app |
| `ADMIN_EMAILS` | untuk admin | daftar email admin (dipisah koma) |
| `THESIS_ADMIN_API_SECRET` | untuk federasi | mengaktifkan API `/admin/v1/*`; samakan dengan hub |
| `NOTIFY_URL` / `NOTIFY_SECRET` | untuk email | kirim notifikasi lewat hub; kosong = tetap in-app |
| `GCS_*` | untuk dokumen | Google Cloud Storage; kosong = simpan lokal saat dev |

> [!IMPORTANT]
> Semua integrasi hub eksternal (notifikasi, akun, federasi) bersifat **opsional dan mati
> secara default**. Kosongkan env-nya dan aplikasi tetap berjalan penuh secara mandiri.

## Deploy

- **Vercel.** Klik tombol **Deploy with Vercel** di atas, sambungkan repo, lalu isi environment dari
  `.env.example`. `vercel.json` sudah menjalankan `prisma generate && prisma db push && next build`.
  Gunakan database terkelola (Neon, PlanetScale, Railway, atau sejenisnya) untuk `DATABASE_URL` dan
  set `DB_PROVIDER=mysql`, lalu set `BETTER_AUTH_URL` ke domain final dan deploy ulang.
- **Docker.** `docker compose up` menjalankan app plus MySQL sekali perintah. `Dockerfile` (multi-
  stage, standalone, non-root) tersedia di root.

## Buat jadi milik Anda

Template ini sudah bebas identitas Maubisa secara default (ikon generik, seed data netral, domain
contoh) - README ini saja yang sengaja mencantumkan atribusi ke proyek asal sebagai bentuk kredit.
Untuk memasang identitas Anda sendiri:

1. **Pasang merek Anda.** Ikon aplikasi adalah SVG inline di [`src/components/kit.tsx`](./src/components/kit.tsx)
   (tanpa file gambar, tinggal ganti bentuk/warnanya), favicon di [`src/app/icon.png`](./src/app).
   Atau, tanpa sentuh kode: isi nama dan URL logo institusi lewat wizard setup saat pertama kali
   dijalankan. Warna dan token ada di [`src/app/globals.css`](./src/app/globals.css).
2. **Sesuaikan data contoh.** Akun dan bimbingan demo ada di [`prisma/seed.ts`](./prisma/seed.ts).
3. **Matikan/hidupkan integrasi.** Semua integrasi hub bersifat env. Biarkan kosong untuk berdiri
   sendiri, atau isi untuk menyambung ke pusat akun dan federasi admin Anda.
4. **Deploy.** Cara tercepat: tombol **Deploy with Vercel**, bawa database terkelola sendiri. Untuk
   MySQL manual atau Docker, ikuti bagian Deploy di atas.

Panduan kontribusi dan standar kode ada di [CONTRIBUTING.md](./CONTRIBUTING.md).

## Struktur proyek

```
src/
  app/
    (app)/            # area login (shell + nav per peran)
      progres, jadwal, dokumen, chat, notifikasi
      klien           # tutor: klien saya
      sidang          # simulasi & jadwal sidang akhir
      admin/{pengguna,bimbingan,audit,prodi}   # panel admin + struktur akademik
    admin/v1/         # API federasi (JWT S2S, env-gated)
    api/{auth,cron,portal,siakad,calendar}     # integrasi SIAKAD, portal dokumen, kalender ICS
    masuk, daftar, setup                        # auth + wizard first-run
  components/{ui,shell,dashboard,features,auth,states,icons}
  lib/{prisma,auth,session,entitlement,rbac,audit,federation,actions,queries,
       notify,gcs,siakad,format,nav}
prisma/               # schema.prisma (24 model), seed.ts
test/                 # Vitest: federation, rbac, ics
docs/                 # kontrak API federasi (Markdown + OpenAPI 3.1)
```

## Skrip

| Skrip | Fungsi |
|-------|--------|
| `npm run dev` | server pengembangan (port 3100) |
| `npm run build` / `npm start` | build dan jalankan produksi |
| `npm run lint` | ESLint |
| `npm test` | Vitest (federasi JWT, RBAC, feed ICS) |
| `npm run db:setup` | generate Prisma client + buat/sinkron DB |
| `npm run seed` | isi data contoh dan akun demo |

## Keamanan

Akses bersifat default-deny: fitur bimbingan hanya terbuka untuk pengguna dengan hak aktif, dan
setiap query difilter per pengguna sehingga mahasiswa tidak bisa mengintip data mahasiswa lain.
Aksi sensitif tercatat di jejak audit append-only dengan retensi minimal 12 bulan untuk kebutuhan
kepatuhan ISO/SOC2/PDP. Endpoint federasi memverifikasi tanda tangan JWT secara timing-safe,
menolak `alg=none`, dan mengecek ulang invariant-nya sendiri di setiap panggilan, bukan cuma
percaya token yang lolos verifikasi awal.

Ini bukan janji kosong: 33 automated test mengunci perilaku RBAC dan federasi supaya perubahan
kode yang melonggarkan akses ketahuan sebelum di-merge, dan CI menjalankannya di setiap push
([status CI](https://github.com/maubisa-id/thesisdesk/actions/workflows/ci.yml)). Menemukan celah
keamanan? Jangan buka issue publik - ikuti proses pelaporan privat di [SECURITY.md](./SECURITY.md).

## Yang belum ada (biar Anda tidak kaget)

Supaya ekspektasinya jujur sejak awal - hal-hal berikut sengaja belum dibangun:

- **Mode suara AI penguji sidang** ada placeholder UI-nya, tapi mekanismenya ("Segera") belum aktif.
- **Notifikasi push mobile** belum ada; kanal yang tersedia adalah in-app dan email opsional lewat hub.
- **Multi-bahasa (i18n)** belum diimplementasikan; UI saat ini Bahasa Indonesia saja.
- **Billing/pembayaran** sengaja tidak dibangun di sini - itu tanggung jawab hub identitas Anda
  sendiri (pola hub-and-spoke), bukan bagian dari Thesisdesk.

Kalau salah satu ini jadi kebutuhan Anda, pull request dipersilakan - lihat
[CONTRIBUTING.md](./CONTRIBUTING.md) untuk standar kode dan gate sebelum PR.

## Dokumentasi

| Dokumen | Isi |
|---------|-----|
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Cara berkontribusi dan standar kode |
| [SECURITY.md](./SECURITY.md) | Kebijakan keamanan dan checklist produksi |
| [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md) | Pedoman perilaku komunitas |
| [docs/federation-admin-api.md](./docs/federation-admin-api.md) | Kontrak API federasi admin |
| [docs/federation-admin-api.openapi.yaml](./docs/federation-admin-api.openapi.yaml) | Spesifikasi OpenAPI 3.1 (Swagger/Postman) |
| [.env.example](./.env.example) | Semua variabel environment |

## Kredit dan atribusi

Template ini berasal dari [`maubisa-id/thesisdesk`](https://github.com/maubisa-id/thesisdesk) oleh
Maubisa / PT Litera Edu Solusi, dan menggerakkan [thesis.maubisa.id](https://thesis.maubisa.id).
Kalau Anda memakai atau memodifikasinya, kami akan senang bila atribusi dan tautan asalnya tetap
dicantumkan agar pengguna lain bisa menemukan sumbernya.

## Lisensi

[AGPL-3.0](./LICENSE), hak cipta 2026 PT Litera Edu Solusi (Maubisa). Bebas dipakai, dipelajari,
dimodifikasi, dan di-deploy, termasuk oleh kampus dan instansi. Karena AGPL, bila Anda menjalankan
versi modifikasi sebagai layanan jaringan untuk publik, source modifikasi itu ikut dibuka bagi
penggunanya. Logo dan nama "Maubisa" tetap milik PT Litera Edu Solusi; ganti dengan merek Anda
sendiri saat memakai.

---

<div align="center">
<sub>Dibuat oleh <a href="https://maubisa.id">Maubisa</a>. Menggerakkan <a href="https://thesis.maubisa.id">thesis.maubisa.id</a>.</sub>
</div>
