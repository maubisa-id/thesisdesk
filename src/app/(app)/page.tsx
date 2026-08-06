import { getSessionUser } from "@/lib/session";
import { KlienDashboard } from "@/components/dashboard/klien-dashboard";
import { TutorDashboard } from "@/components/dashboard/tutor-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { KaprodiDashboard } from "@/components/dashboard/kaprodi-dashboard";
import { DbError } from "@/components/states";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getSessionUser();
  if (!user) return <DbError error="Sesi tidak ditemukan" />;
  if (user.role === "tutor") return <TutorDashboard user={user} />;
  if (user.role === "admin") return <AdminDashboard user={user} />;
  if (user.role === "kaprodi") return <KaprodiDashboard user={user} />;
  return <KlienDashboard user={user} />;
}
