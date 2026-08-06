import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionEmail } from "@/lib/session";
import { isSetupDone } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function DaftarPage() {
  if (!(await isSetupDone())) redirect("/setup");
  const email = await getSessionEmail();
  if (email) redirect("/");
  return (
    <AuthShell
      eyebrow="Mulai perjalananmu"
      title="Buat akun"
      subtitle="Daftar gratis untuk mengenal platform. Bimbingan aktif setelah paketmu dikonfirmasi."
    >
      <AuthForm mode="daftar" />
    </AuthShell>
  );
}
