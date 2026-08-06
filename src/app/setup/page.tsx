import { redirect } from "next/navigation";
import { AuthShell } from "@/components/auth/auth-shell";
import { SetupForm } from "@/components/auth/setup-form";
import { isSetupDone } from "@/lib/setup";

export const dynamic = "force-dynamic";

export default async function SetupPage() {
  if (await isSetupDone()) redirect("/masuk");
  return (
    <AuthShell
      eyebrow="Penyiapan awal"
      title="Siapkan institusimu"
      subtitle="Satu langkah untuk membuat akun admin pertama. Setelah ini kamu bisa menambah tutor dan mahasiswa."
    >
      <SetupForm />
    </AuthShell>
  );
}
