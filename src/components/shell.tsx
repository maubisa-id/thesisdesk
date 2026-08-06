"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { toast } from "sonner";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/utils";
import type { NavGroup, IconKey } from "@/lib/nav";
import { Avatar, Logo } from "@/components/kit";
import { PageSearch } from "@/components/page-search";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  IconGrid, IconFlag, IconCalendar, IconDoc, IconChat, IconSparkle, IconQuote,
  IconQuestion, IconFlame, IconUsers, IconShield, IconCap, IconTarget,
  IconMenu, IconLogout, IconExternal, IconChevron, IconBell, type IconType,
} from "@/components/icons";

const ICONS: Record<IconKey, IconType> = {
  grid: IconGrid, flag: IconFlag, calendar: IconCalendar, doc: IconDoc, chat: IconChat,
  sparkle: IconSparkle, quote: IconQuote, question: IconQuestion, flame: IconFlame,
  users: IconUsers, shield: IconShield, cap: IconCap, target: IconTarget,
};

const ROLE_LABEL: Record<string, string> = { admin: "Admin", tutor: "Tutor", klien: "Klien" };

export function AppShell({
  user,
  nav,
  accountUrl,
  unreadNotif,
  children,
}: {
  user: { name: string; email: string; role: string; avatarUrl?: string | null };
  nav: NavGroup[];
  accountUrl: string;
  unreadNotif: number;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const activeItem = nav.flatMap((g) => g.items).find((i) => isActive(i.href));
  const pageTitle = activeItem?.label ?? "Dashboard";
  const pageSection = nav.find((g) => g.items.some((i) => i.href === activeItem?.href))?.section ?? "Ringkasan";

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await authClient.signOut();
    } catch {
      toast.error("Gagal keluar. Coba lagi.");
    }
    router.push("/masuk");
    router.refresh();
  }

  const navBody = (
    <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
      {nav.map((group) => (
        <div key={group.section}>
          <div className="px-2 pb-1.5 text-xs font-medium text-sidebar-foreground/55">{group.section}</div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = ICONS[item.icon];
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon className={cn("size-[18px]", active ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const brand = (
    <Link href="/" className="flex items-center gap-2 px-4 py-4" onClick={() => setMobileOpen(false)} aria-label="Maubisa Lulus, ke dashboard">
      <Logo variant="white" className="h-6" />
      <span className="font-heading text-[15px] font-semibold tracking-tight text-sidebar-foreground/85">Lulus</span>
    </Link>
  );

  const footer = (
    <div className="border-t border-sidebar-border p-3">
      <Link
        href="/notifikasi"
        onClick={() => setMobileOpen(false)}
        aria-current={isActive("/notifikasi") ? "page" : undefined}
        className={cn(
          "mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
          isActive("/notifikasi")
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
        )}
      >
        <IconBell className={cn("size-[18px]", isActive("/notifikasi") ? "text-sidebar-primary" : "text-sidebar-foreground/60")} />
        <span>Notifikasi</span>
        {unreadNotif > 0 ? (
          <span className="ml-auto flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-bold text-primary-foreground">
            {unreadNotif > 9 ? "9+" : unreadNotif}
          </span>
        ) : null}
      </Link>
      <a
        href={accountUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="mb-1 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-sidebar-foreground/75 transition-colors hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
      >
        <IconExternal className="size-[18px] text-sidebar-foreground/60" />
        <span>Akun & tagihan</span>
      </a>
      <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
        <Avatar name={user.name} url={user.avatarUrl} size={34} />
        <div className="min-w-0 flex-1 leading-tight">
          <div className="truncate text-sm font-medium text-sidebar-foreground">{user.name}</div>
          <div className="truncate text-xs text-sidebar-foreground/55">{ROLE_LABEL[user.role] ?? user.role}</div>
        </div>
        <Button variant="ghost" size="icon-sm" onClick={handleSignOut} disabled={signingOut} aria-label="Keluar">
          <IconLogout />
        </Button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-[100dvh]">
      {/* Sidebar desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar md:flex">
        {brand}
        {navBody}
        {footer}
      </aside>

      {/* Konten */}
      <div className="flex min-w-0 flex-1 flex-col md:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-2.5 backdrop-blur sm:px-6">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger
              render={<Button variant="outline" size="icon-sm" className="md:hidden" aria-label="Buka menu" />}
            >
              <IconMenu />
            </SheetTrigger>
            <SheetContent side="left" className="w-72 gap-0 bg-sidebar p-0" showCloseButton={false}>
              <SheetTitle className="sr-only">Menu navigasi</SheetTitle>
              <div className="flex h-full flex-col">
                {brand}
                {navBody}
                {footer}
              </div>
            </SheetContent>
          </Sheet>

          {/* Breadcrumb-style: Seksi > Halaman (paritas header account-center). Item saat ini =
              span aria-current (wayfinding), BUKAN h1 - h1 tunggal per halaman ada di konten
              (DashboardHeader/SectionTitle) demi semantik & a11y yang benar. */}
          <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-1.5">
            <span className="hidden text-sm text-muted-foreground sm:inline">{pageSection}</span>
            <IconChevron className="hidden size-3.5 text-muted-foreground/50 sm:inline" />
            <span aria-current="page" className="truncate font-heading text-base font-semibold tracking-tight text-foreground">{pageTitle}</span>
          </nav>

          <div className="ml-auto flex items-center gap-2 sm:gap-3">
            <PageSearch nav={nav} />
            <button
              type="button"
              onClick={handleSignOut}
              disabled={signingOut}
              aria-label="Profil & keluar"
              title={`${user.name} - klik untuk keluar`}
              className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <Avatar name={user.name} url={user.avatarUrl} size={34} />
            </button>
          </div>
        </header>
        <main id="main" tabIndex={-1} className="flex-1 px-4 py-6 focus:outline-none sm:px-6 sm:py-8">
          <div className="mx-auto w-full max-w-6xl">{children}</div>
        </main>
      </div>
    </div>
  );
}
