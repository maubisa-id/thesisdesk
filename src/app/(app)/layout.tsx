import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { navFor } from "@/lib/nav";
import { getUnreadNotifCount } from "@/lib/notifications";
import { processDueReminders } from "@/lib/reminders";
import { AppShell } from "@/components/shell";

export const dynamic = "force-dynamic";

const ACCOUNT_URL = process.env.NEXT_PUBLIC_ACCOUNT_URL ?? "https://akun.maubisa.id";

export default async function AppGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/masuk");

  // Lazy cron: ubah pengingat in-app yang jatuh tempo jadi notifikasi (produksi: worker terjadwal).
  await processDueReminders(user.id);

  const unread = await getUnreadNotifCount(user.id);

  return (
    <AppShell
      user={{ name: user.name, email: user.email, role: user.role, avatarUrl: user.avatarUrl }}
      nav={navFor(user.role)}
      accountUrl={ACCOUNT_URL}
      unreadNotif={unread}
    >
      {children}
    </AppShell>
  );
}
