"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { LangToggle } from "./lang-toggle";
import { useI18n } from "../providers/i18n-provider";
import { PoweredByDigitalFactory } from "./powered-by-digital-factory";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

interface MobileShellProps {
  children: React.ReactNode;
  navItems: NavItem[];
  themeColor?: string;
  title?: string;
  logo?: string;
}

export function MobileShell({
  children,
  navItems,
  themeColor = "#1e40af",
  title,
  logo,
}: MobileShellProps) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-page text-on-page">
      {/* ── Sticky header ── */}
      {title && (
        <header
          className="z-40 shrink-0 safe-area-top"
          style={{
            background: `linear-gradient(145deg, ${themeColor} 0%, ${themeColor}dd 50%, ${themeColor}bb 100%)`,
            boxShadow: "0 2px 8px rgba(0,0,0,0.12), 0 1px 0 rgba(255,255,255,0.08) inset",
          }}
        >
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <Link
              href="/"
              className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg transition-[background-color,transform] active:scale-[0.98] hover:bg-white/15"
            >
              {logo && (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/25 text-sm font-black text-white shadow-sm">
                  {logo}
                </div>
              )}
              <h1 className="truncate text-base font-bold tracking-tight text-white drop-shadow-sm">
                {title}
              </h1>
            </Link>
            <div className="flex shrink-0 items-center gap-2.5">
              <LangToggle className="h-10 min-w-[2.75rem] rounded-xl border border-white/30 bg-white/25 px-4 text-white shadow-md hover:bg-white/35 [&_span]:bg-white/30 [&_span]:text-white [&_svg]:text-white" />
              <ThemeToggle className="h-10 w-10 rounded-xl border border-white/30 bg-white/25 text-white shadow-md hover:bg-white/35 [&_span]:bg-white/30 [&_svg]:text-white" />
            </div>
          </div>
        </header>
      )}

      {/* ── Scrollable content: content wrapper min-h-full so footer always at bottom of viewport ── */}
      <main className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden pb-[5.5rem]">
        <div className="min-h-full flex-1 flex flex-col">
          {children}
        </div>
        <footer className="mt-auto shrink-0 border-t border-line/50 bg-surface/50 px-4 py-3 text-center text-xs text-muted">
          {t("dashboard.subtitle")}
        </footer>
      </main>

      {/* ── Sticky bottom nav: always at viewport bottom ── */}
      <nav className="safe-area-bottom z-50 shrink-0 border-t border-line bg-surface shadow-[0_-4px_24px_rgba(0,0,0,0.06)]">
        <div className="mx-auto flex h-[4.5rem] max-w-lg items-stretch gap-2 px-4 py-3">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href ||
              (item.href !== "/" && pathname.startsWith(item.href));
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "relative flex flex-1 flex-col items-center justify-center gap-1 rounded-xl transition-all duration-200 active:scale-[0.98]",
                  isActive
                    ? "text-on-page"
                    : "text-muted hover:bg-subtle hover:text-on-surface"
                )}
                style={
                  isActive
                    ? {
                        backgroundColor: `${themeColor}14`,
                        boxShadow: `inset 0 0 0 2px ${themeColor}50`,
                      }
                    : undefined
                }
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    isActive ? "bg-white/0" : "bg-subtle/80"
                  )}
                  style={isActive ? { backgroundColor: `${themeColor}22` } : undefined}
                >
                  <Icon className="h-5 w-5" style={isActive ? { color: themeColor } : undefined} />
                </div>
                <span className="text-[11px] font-semibold leading-tight">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      <PoweredByDigitalFactory className="bottom-[calc(5.5rem+env(safe-area-inset-bottom,0px)+0.375rem)]" />

      <style jsx global>{`
        .safe-area-top { padding-top: env(safe-area-inset-top, 0px); }
        .safe-area-bottom { padding-bottom: env(safe-area-inset-bottom, 0px); }
      `}</style>
    </div>
  );
}
