# Panduan: Admin API Federasi (Thesis) — untuk `thesis.maubisa.id`

> **Tujuan:** Membuat admin `akun.maubisa.id` (hub) bisa **assign tutor, isi judul skripsi, dan
> memantau tutor/klien** TANPA login ke dashboard thesis. Hub sudah punya UI-nya (`/admin/thesis`);
> repo ini (thesis-next, spoke) tinggal menyediakan **admin API tipis** yang dipanggil hub.
>
> **Kontrak kanonik hub:** `maubisa-account-center/docs/federasi-admin.md`. Dokumen ini = sisi spoke,
> siap-implementasi.
>
> **Spesifikasi mesin (OpenAPI 3.1):** [`federation-admin-api.openapi.yaml`](./federation-admin-api.openapi.yaml)
> untuk 7 endpoint + skema respons (impor ke Swagger/Postman/klien-gen).

---

## 0. Prinsip keamanan (kenapa ini AMAN)

Kekhawatiran wajar: "hub nulis ke DB layanan lain?" **TIDAK.** Polanya:

```
Admin klik di hub  ─HTTP(JWT 60s)─►  Admin API DI SINI (thesis-next)  ──►  DB thesis (punya sendiri)
       (UI)                              (verifikasi + aturan bisnis)         (Prisma lokal)
```

- Hub **tidak pernah** menyentuh `db-thesis-maubisa`. Ia cuma **minta** lewat HTTP.
- **Repo INI** yang menulis ke DB-nya sendiri, pakai Prisma-nya sendiri, dengan **aturan bisnisnya
  sendiri** (tutor valid? bimbingan ada? default-deny). Persis seperti endpoint biasa — bedanya
  pemanggilnya hub (terverifikasi JWT), bukan browser klien.
- Jadi batas "jangan tulis lintas-DB" **tetap terjaga**: tiap layanan pemilik datanya.

Ini **lebih aman** daripada memberi hub kredensial DB thesis, karena thesis tetap memvalidasi tiap
aksi & mencatat siapa aktornya di audit-nya sendiri.

---

## 1. Env yang perlu diset

**Di repo INI (thesis-next), set di Coolify (prod):**
```
FEDERATION_SECRET=<rahasia-acak-kuat>     # SAMA PERSIS dengan THESIS_ADMIN_API_SECRET di hub
```
Generate sekali: `openssl rand -base64 48` (atau `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`).

**Di hub (akun-prod), set:**
```
THESIS_ADMIN_API_URL=https://thesis.maubisa.id
THESIS_ADMIN_API_SECRET=<rahasia-yang-sama>
```

Begitu kedua env hub terisi, nav "Thesis" + konsol `/admin/thesis` otomatis **hidup di prod**
(sebelum ini tampil "belum aktif"). Tak ada perubahan kode hub.

---

## 2. Verifikasi JWT hub (WAJIB, taruh sekali)

Hub mint **JWT HS256 umur 60 detik** per panggilan. Buat helper ini:

**`src/lib/federation-verify.ts`**
```ts
import { createHmac, timingSafeEqual, randomUUID } from "crypto";

// Klaim yang dikirim hub (lihat maubisa-account-center/src/lib/federation.ts mintSpokeToken).
export type FederationActor = { uuid: string; email: string };
export type FederationClaims = {
  iss: string; aud: string; scope: string;
  actor: FederationActor; jti: string; iat: number; exp: number;
};

// Anti-replay: cache jti yang sudah dipakai selama masa token (in-memory cukup utk 1 instance;
// pindah Redis bila multi-instance). ponytail: map sederhana + sweep, bukan lib.
const seenJti = new Map<string, number>();
function rememberJti(jti: string, exp: number): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (const [k, e] of seenJti) if (e < now) seenJti.delete(k); // sweep kedaluwarsa
  if (seenJti.has(jti)) return false; // replay!
  seenJti.set(jti, exp);
  return true;
}

const b64urlToJson = (s: string) =>
  JSON.parse(Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8"));

/**
 * Verifikasi Bearer token dari hub. Return klaim bila sah, atau {error} bila tidak.
 * WAJIB: tanda tangan HS256 (secret sama), exp, aud='thesis', iss, TOLAK alg lain, anti-replay jti.
 */
export function verifyFederationToken(
  authHeader: string | null,
  expectedAud = "thesis",
): { ok: true; claims: FederationClaims } | { ok: false; error: string; status: number } {
  const secret = process.env.FEDERATION_SECRET;
  if (!secret) return { ok: false, error: "Federation belum dikonfigurasi.", status: 503 };

  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return { ok: false, error: "Token tidak ada.", status: 401 };

  const parts = token.split(".");
  if (parts.length !== 3) return { ok: false, error: "Token malformed.", status: 401 };
  const [h, p, sig] = parts;

  // 1) Header: HANYA HS256 (tolak alg=none / algorithm confusion).
  let header: { alg?: string };
  try { header = b64urlToJson(h); } catch { return { ok: false, error: "Header invalid.", status: 401 }; }
  if (header.alg !== "HS256") return { ok: false, error: "Algoritma ditolak.", status: 401 };

  // 2) Tanda tangan (timing-safe).
  const expected = createHmac("sha256", secret).update(`${h}.${p}`).digest();
  const got = Buffer.from(sig.replace(/-/g, "+").replace(/_/g, "/"), "base64");
  if (expected.length !== got.length || !timingSafeEqual(expected, got))
    return { ok: false, error: "Tanda tangan salah.", status: 401 };

  // 3) Klaim.
  let claims: FederationClaims;
  try { claims = b64urlToJson(p); } catch { return { ok: false, error: "Payload invalid.", status: 401 }; }
  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp < now)
    return { ok: false, error: "Token kedaluwarsa.", status: 401 };
  if (claims.iss !== "akun.maubisa.id") return { ok: false, error: "Issuer ditolak.", status: 401 };
  if (claims.aud !== expectedAud) return { ok: false, error: "Audience ditolak.", status: 401 };
  if (!claims.actor?.email) return { ok: false, error: "Actor tidak ada.", status: 401 };
  if (!rememberJti(claims.jti, claims.exp)) return { ok: false, error: "Replay terdeteksi.", status: 401 };

  return { ok: true, claims };
}

export function newCorrelationId(): string { return randomUUID(); }
```

Wrapper kecil biar tiap route ringkas — **`src/lib/federation-route.ts`**:
```ts
import { NextRequest, NextResponse } from "next/server";
import { verifyFederationToken, type FederationActor } from "@/lib/federation-verify";

export function withFederation(
  handler: (req: NextRequest, ctx: { actor: FederationActor; params: Record<string, string> }) => Promise<Response>,
) {
  return async (req: NextRequest, route: { params: Promise<Record<string, string>> }) => {
    const v = verifyFederationToken(req.headers.get("authorization"), "thesis");
    if (!v.ok) return NextResponse.json({ error: v.error }, { status: v.status });
    const params = await route.params;
    return handler(req, { actor: v.claims.actor, params });
  };
}
```

---

## 3. Endpoint yang WAJIB disediakan

Base path: `src/app/admin/v1/...`. Semua **verifikasi JWT** + **cek invariant sendiri** (default-deny).
Bentuk request/response HARUS sama persis (hub sudah memanggil dengan bentuk ini — lihat
`maubisa-account-center/src/app/(app)/admin/thesis/page.tsx` & `actions.ts`).

Model relevan (thesis-next `prisma/schema.prisma`): `Bimbingan { id, clientUserId, tutorUserId,
thesisTitle, status, ... }`, `User { id, coreUserId, name, email, role }`, `Milestone`, `Schedule`.

> **Soal `id`:** `id` yang KAMU kembalikan di GET adalah `id` yang SAMA yang hub kirim balik di POST.
> Kamu yang menentukan identifier-nya. **Rekomendasi:** pakai `Bimbingan.id` untuk bimbingan, dan
> `User.id` (thesis) untuk tutor. Konsisten GET↔POST.

### `GET /admin/v1/stats`
Ringkasan angka bebas. Hub merender apa adanya.
```jsonc
// 200
{ "bimbingan_aktif": 128, "klien_thesis": 140, "tutor_tersedia": 12 }
```

### `GET /admin/v1/tutors`
Daftar tutor untuk dropdown assign. `id` = identifier tutor (rekomendasi `User.id` thesis).
```jsonc
// 200
[ { "id": "42", "name": "Tutor Pembimbing" } ]
```

### `GET /admin/v1/bimbingan?status=unassigned`
Klien yang belum ber-tutor (untuk dropdown). `judul` boleh placeholder bila belum ada.
```jsonc
// 200
[ { "id": "1001", "klien_name": "Rina Wardani", "judul": "Bimbingan skripsi" } ]
```

### `POST /admin/v1/bimbingan/{id}/assign-tutor`
Body: `{ "tutor_user_id": "42" }`. **Idempoten** (tutor sama → no-op, tetap 200). WAJIB verifikasi:
bimbingan `{id}` ada; tutor valid & `role` tutor/mentor. Tulis `bimbingan.tutorUserId`. Kembalikan
detail klien supaya hub bisa kirim email "pembimbing ditetapkan".
```jsonc
// 200
{ "ok": true, "klien_name": "Rina Wardani", "klien_email": "rina@contoh.com" }
// 4xx: { "ok": false, "error": "Bimbingan tidak ditemukan." }
```

### `POST /admin/v1/bimbingan/{id}/title`
Body: `{ "thesis_title": "Pengaruh Gamifikasi terhadap Motivasi Belajar" }`. **Idempoten**. Simpan ke
`bimbingan.thesisTitle` (maks 300 char). Ini yang bikin klien **tak perlu mengetik ulang judul**.
```jsonc
// 200
{ "ok": true }
```

### `GET /admin/v1/tutor-workload`
Pemantauan beban tutor. Hitung dari `Bimbingan` per tutor + progres dari `Milestone`.
```jsonc
// 200
[ { "id": "42", "name": "Tutor Pembimbing", "active_clients": 5, "avg_progress": 62, "last_activity": "hari ini" } ]
```

### `GET /admin/v1/klien`
Daftar semua klien bimbingan (read-only monitoring di hub).
```jsonc
// 200
[ { "id": "1001", "name": "Rina", "email": "rina@contoh.com", "tutor_name": "Tutor Pembimbing",
    "status": "ongoing", "judul": "…", "progress_pct": 55, "last_activity": "kemarin" } ]
```

---

## 4. Contoh implementasi 2 endpoint (pola untuk sisanya)

**`src/app/admin/v1/bimbingan/[id]/assign-tutor/route.ts`**
```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFederation } from "@/lib/federation-route";
import { writeAudit } from "@/lib/audit"; // pakai audit thesis yang sudah ada

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withFederation(async (req, { actor, params }) => {
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as { tutor_user_id?: string };
  const tutorId = Number(body.tutor_user_id);
  if (!Number.isInteger(id) || !Number.isInteger(tutorId))
    return NextResponse.json({ ok: false, error: "Input tidak valid." }, { status: 400 });

  // Invariant sendiri (default-deny): bimbingan ada + tutor valid.
  const [bim, tutor] = await Promise.all([
    prisma.bimbingan.findUnique({ where: { id }, select: { id: true, tutorUserId: true, client: { select: { name: true, email: true } } } }),
    prisma.user.findFirst({ where: { id: tutorId, role: { in: ["tutor", "admin"] } }, select: { id: true } }),
  ]);
  if (!bim) return NextResponse.json({ ok: false, error: "Bimbingan tidak ditemukan." }, { status: 404 });
  if (!tutor) return NextResponse.json({ ok: false, error: "Tutor tidak valid." }, { status: 400 });

  // Idempoten: kalau sudah tutor yang sama, no-op.
  if (bim.tutorUserId !== tutorId) {
    await prisma.bimbingan.update({ where: { id }, data: { tutorUserId: tutorId } });
  }
  // WAJIB: catat actor dari hub di audit thesis (akuntabilitas).
  await writeAudit({ actorEmail: actor.email, action: "federation.assign_tutor", targetType: "bimbingan", targetId: id });

  return NextResponse.json({ ok: true, klien_name: bim.client?.name ?? null, klien_email: bim.client?.email ?? null });
});
```

**`src/app/admin/v1/bimbingan/[id]/title/route.ts`**
```ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withFederation } from "@/lib/federation-route";
import { writeAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export const POST = withFederation(async (req, { actor, params }) => {
  const id = Number(params.id);
  const body = (await req.json().catch(() => ({}))) as { thesis_title?: string };
  const title = (body.thesis_title ?? "").trim();
  if (!Number.isInteger(id) || title.length < 4 || title.length > 300)
    return NextResponse.json({ ok: false, error: "Judul 4–300 karakter." }, { status: 400 });

  const bim = await prisma.bimbingan.findUnique({ where: { id }, select: { thesisTitle: true } });
  if (!bim) return NextResponse.json({ ok: false, error: "Bimbingan tidak ditemukan." }, { status: 404 });
  if (bim.thesisTitle !== title) await prisma.bimbingan.update({ where: { id }, data: { thesisTitle: title } });

  await writeAudit({ actorEmail: actor.email, action: "federation.set_thesis_title", targetType: "bimbingan", targetId: id });
  return NextResponse.json({ ok: true });
});
```

GET endpoint lebih sederhana (tanpa params), pola sama:
`export const GET = withFederation(async (req, { actor }) => { ... return NextResponse.json(rows); })`.

---

## 5. Uji lokal (tanpa hub)

Mint token uji lalu curl:
```js
// scripts/mint-test-token.mjs — jalankan: node scripts/mint-test-token.mjs
import { createHmac, randomUUID } from "crypto";
const secret = process.env.FEDERATION_SECRET;            // set sama dgn .env
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const now = Math.floor(Date.now()/1000);
const h = b64({ alg:"HS256", typ:"JWT" });
const p = b64({ iss:"akun.maubisa.id", aud:"thesis", scope:"thesis",
  actor:{ uuid:"test", email:"admin@contoh.com" }, jti:randomUUID(), iat:now, exp:now+60 });
const sig = createHmac("sha256", secret).update(`${h}.${p}`).digest("base64url");
console.log(`${h}.${p}.${sig}`);
```
```bash
TOKEN=$(node scripts/mint-test-token.mjs)
curl -s -H "Authorization: Bearer $TOKEN" http://localhost:3100/admin/v1/stats
curl -s -X POST -H "Authorization: Bearer $TOKEN" -H "content-type: application/json" \
  -d '{"thesis_title":"Judul uji coba"}' http://localhost:3100/admin/v1/bimbingan/1/title
```
Tanpa token → 401. Token kedaluwarsa/aud salah → 401. Itu tandanya gerbang jalan.

---

## 6. Checklist go-live

- [ ] `FEDERATION_SECRET` diset (sama dengan hub `THESIS_ADMIN_API_SECRET`).
- [ ] `federation-verify.ts` + `federation-route.ts` dibuat.
- [ ] 7 endpoint `/admin/v1/*` dibuat + verifikasi JWT + cek invariant.
- [ ] Tiap aksi tulis mencatat `actor` di audit thesis.
- [ ] Uji lokal (token uji) hijau; tanpa token 401.
- [ ] Hub set `THESIS_ADMIN_API_URL` + `THESIS_ADMIN_API_SECRET` → konsol `/admin/thesis` hidup di prod.
- [ ] Smoke di hub: assign tutor + isi judul + lihat pantau tutor/klien.

Setelah ini, admin cukup buka `akun.maubisa.id/admin/thesis` — **tak perlu login ke thesis**.
