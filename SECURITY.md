# Kebijakan Keamanan

Sistem ini menangani **data pribadi mahasiswa** (nama, email, dokumen skripsi, chat bimbingan).
Keamanan ditanggapi serius.

## Melaporkan kerentanan

**Jangan** buka issue publik untuk kerentanan. Laporkan privat lewat GitHub Security Advisories
("Report a vulnerability" di tab Security) atau email ke maintainer. Sertakan langkah reproduksi,
dampak, dan versi. Target respons awal: 72 jam.

## Kontrol keamanan bawaan

- **Default-deny** akses; RBAC terpusat (`src/lib/rbac.ts`) + cek kepemilikan objek (anti-IDOR).
- **Audit log** append-only untuk aksi/akses sensitif (buka/unduh dokumen, baca PII, aksi admin).
- **Validasi zod** di boundary + output AI di-encode (tanpa `dangerouslySetInnerHTML`).
- **Rate-limit** auth (Better Auth) + endpoint AI; header keamanan di `next.config.ts`.
- **Magic-byte** pada unggahan berkas (bukan sekadar ekstensi).
- **Federasi admin** (`/admin/v1/*`, env-gated OFF by default): verifikasi JWT HS256 S2S
  (`src/lib/federation.ts`) - tanda tangan timing-safe, cek `iss/aud/scope/exp`, tolak
  `alg=none`, anti-replay `jti` untuk POST, dan cek ulang invariant sendiri (default-deny).

## Sebelum produksi (checklist deployer)

- [ ] Ganti semua secret contoh (`BETTER_AUTH_SECRET`, password DB) dengan nilai acak kuat.
- [ ] Aktifkan HTTPS + HSTS di depan (reverse proxy / Cloudflare).
- [ ] Simpan berkas unggahan di object storage privat + signed URL (bukan `public/uploads` lokal).
- [ ] Aktifkan MFA untuk admin/tutor.
- [ ] Backup DB terjadwal + uji restore.
- [ ] Set `robots noindex` (sudah default) bila belum siap publik.
