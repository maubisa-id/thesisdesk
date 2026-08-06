import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { AuthForm } from "@/components/auth/auth-form";
import { getSessionEmail } from "@/lib/session";
import { isSetupDone } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function MasukPage() {
  if (!(await isSetupDone())) redirect("/setup");
  const email = await getSessionEmail();
  if (email) redirect("/");
  return (
    <AuthShell
      eyebrow="Selamat datang kembali"
      title="Masuk"
      subtitle="Lanjutkan bimbingan skripsimu. Satu akun untuk semua layanan Maubisa."
    >
      <AuthForm mode="masuk" />
    </AuthShell>
  );
}
