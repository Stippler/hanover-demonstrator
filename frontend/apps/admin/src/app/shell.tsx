"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  Activity,
  ArrowRightLeft,
  ScrollText,
  Menu,
  X,
  ExternalLink,
  ChevronDown,
  FileText,
} from "lucide-react";
import { useI18n, LangToggle, ThemeToggle, PoweredByDigitalFactory } from "@hanover/ui";

const DOMAIN = "imx.vactory-projects.com";
const ACCENT = "#2563eb";

const APP_LINKS = [
  { href: `https://vendor.${DOMAIN}`, label: "Ski Vendor", color: "#1d4ed8" },
  { href: `https://vault-a.${DOMAIN}`, label: "VaultA", color: "#059669" },
  { href: `https://vault-b.${DOMAIN}`, label: "VaultB", color: "#7c3aed" },
  { href: `https://service.${DOMAIN}`, label: "Peak Service", color: "#ea580c" },
];

const NAV = [
  { href: "/", labelKey: "nav.dashboard" as const, icon: LayoutDashboard },
  { href: "/passports", labelKey: "nav.passports" as const, icon: FileText },
  { href: "/participants", labelKey: "nav.participants" as const, icon: Users },
  { href: "/events", labelKey: "nav.events" as const, icon: Activity },
  { href: "/transfers", labelKey: "nav.transfers_admin" as const, icon: ArrowRightLeft },
  { href: "/logs", labelKey: "nav.logs" as const, icon: ScrollText },
];

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [appsOpen, setAppsOpen] = useState(false);

  return (
    <div className="flex min-h-dvh flex-col bg-page text-on-page">
      {/* Single full-width header — all nav and actions here */}
      <header className="sticky top-0 z-50 shrink-0 border-b border-line bg-surface shadow-sm">
        <div className="flex h-14 items-center justify-between gap-4 px-4 lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-4">
            <Link
              href="/"
              className="flex shrink-0 items-center gap-2.5"
              onClick={() => setMobileOpen(false)}
            >
              <div
                className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-black text-white"
                style={{ background: `linear-gradient(135deg, ${ACCENT}, ${ACCENT}99)` }}
              >
                H
              </div>
              <span className="hidden font-bold text-on-page sm:inline">Demonstrator Dashboard</span>
            </Link>

            {/* Desktop nav — inline in header */}
            <nav className="hidden items-center gap-0.5 lg:flex">
              {NAV.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive
                        ? "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                        : "text-muted hover:bg-subtle hover:text-on-page"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            {/* Apps dropdown — desktop */}
            <div className="relative hidden lg:block">
              <button
                type="button"
                onClick={() => setAppsOpen((o) => !o)}
                className="flex items-center gap-1.5 rounded-lg border border-line bg-subtle/50 px-3 py-2 text-sm font-medium text-on-page hover:bg-subtle"
              >
                {t("dashboard.appLinks")}
                <ChevronDown className={`h-4 w-4 transition ${appsOpen ? "rotate-180" : ""}`} />
              </button>
              {appsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    aria-hidden
                    onClick={() => setAppsOpen(false)}
                  />
                  <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-xl border border-line bg-surface py-1 shadow-lg">
                    {APP_LINKS.map((app) => (
                      <a
                        key={app.href}
                        href={app.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-2 px-3 py-2 text-sm text-on-page hover:bg-subtle"
                        onClick={() => setAppsOpen(false)}
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: app.color }}
                        />
                        {app.label}
                        <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                      </a>
                    ))}
                  </div>
                </>
              )}
            </div>

            <LangToggle className="h-10 min-w-[2.75rem] rounded-lg border border-line bg-subtle/80 px-3 shadow-sm" />
            <ThemeToggle className="h-10 w-10 rounded-lg border border-line bg-subtle/80 shadow-sm" />

            <button
              type="button"
              onClick={() => setMobileOpen((o) => !o)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-muted hover:bg-subtle hover:text-on-page lg:hidden"
              aria-label="Menu"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile: nav + apps in a single dropdown under header */}
        {mobileOpen && (
          <div className="border-t border-line bg-surface lg:hidden">
            <nav className="flex flex-col gap-0.5 px-4 py-3">
              {NAV.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/" && pathname.startsWith(item.href));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium ${
                      isActive ? "bg-blue-500/10 text-blue-600" : "text-on-page hover:bg-subtle"
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {t(item.labelKey)}
                  </Link>
                );
              })}
              <div className="my-2 border-t border-line" />
              <p className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {t("dashboard.appLinks")}
              </p>
              {APP_LINKS.map((app) => (
                <a
                  key={app.href}
                  href={app.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-on-page hover:bg-subtle"
                  onClick={() => setMobileOpen(false)}
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: app.color }}
                  />
                  {app.label}
                  <ExternalLink className="ml-auto h-3 w-3 opacity-50" />
                </a>
              ))}
            </nav>
          </div>
        )}
      </header>

      {/* Full-width content — no sidebar */}
      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      <PoweredByDigitalFactory />
    </div>
  );
}
