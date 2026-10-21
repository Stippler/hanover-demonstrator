"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ScanLine, Wrench, LogOut } from "lucide-react";
import { ThemeToggle, LangToggle, useSession, useI18n, PoweredByDigitalFactory } from "@hanover/ui";

const ACCENT = "#86b817";

export function RepairShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useSession();
  const { t } = useI18n();

  const NAV = [
    { href: "/", label: t("repair.nav.scan"), icon: ScanLine },
    { href: "/report", label: t("repair.nav.report"), icon: Wrench },
  ];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page text-on-page">
      <header className="sticky top-0 z-50 border-b border-line bg-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center gap-6 px-6">
          <Link href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="/wintersteiger-logo.svg"
              alt="Wintersteiger"
              className="h-7 object-contain dark:brightness-[1.15]"
            />
          </Link>

          <nav className="flex h-full items-center gap-1">
            {NAV.map((item) => {
              const active = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex h-full items-center gap-1.5 px-3 text-[13px] font-semibold transition-colors ${
                    active
                      ? "text-[#86b817]"
                      : "text-muted hover:text-on-page"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-0 bottom-0 h-0.5 rounded-full"
                      style={{ backgroundColor: ACCENT }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>

          <div className="flex-1" />

          <div className="flex items-center gap-1.5">
            <LangToggle className="h-8 rounded-md border border-line bg-subtle/60 px-2 text-xs" />
            <ThemeToggle className="h-8 w-8 rounded-md border border-line bg-subtle/60" />
            <div className="mx-1 h-5 w-px bg-line" />
            <button
              onClick={() => logout()}
              className="flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted transition hover:bg-subtle hover:text-on-page"
            >
              <LogOut className="h-3.5 w-3.5" />
              {t("repair.nav.signOut")}
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1400px]">
          {children}
        </div>
      </main>
      <PoweredByDigitalFactory />
    </div>
  );
}
