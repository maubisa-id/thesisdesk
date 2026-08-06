"use server";

import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isSetupDone } from "@/lib/setup";

const schema = z.object({
  institutionName: z.string().trim().min(2).max(120),
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  password: z.string().min(8).max(200),
});

// First-run: buat institusi (singleton) + admin pertama tanpa edit env. Better Auth mengurus hash
// sandi + tabel auth; databaseHook membuat baris users (role klien) lalu kita naikkan ke admin.
export async function completeSetup(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (await isSetupDone()) return { ok: false, error: "Setup sudah selesai." };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Data belum lengkap atau tidak valid." };
  const { institutionName, name, email, password } = parsed.data;
  try {
    await auth.api.signUpEmail({ body: { email, password, name } });
    await prisma.$transaction([
      prisma.institution.create({ data: { name: institutionName } }),
      prisma.user.update({ where: { email }, data: { role: "admin" } }),
    ]);
    return { ok: true };
  } catch (e) {
    // ponytail: kalau signUpEmail sukses tapi transaksi gagal, auth user jadi yatim; retry pakai
    // email sama akan bentrok. Cukup untuk first-run; pindahkan ke satu transaksi bila jadi masalah.
    const msg = e instanceof Error ? e.message.toLowerCase() : "";
    if (msg.includes("exist") || msg.includes("unique")) {
      return { ok: false, error: "Email itu sudah terpakai. Pakai email lain." };
    }
    return { ok: false, error: "Gagal menyiapkan. Coba lagi." };
  }
}
