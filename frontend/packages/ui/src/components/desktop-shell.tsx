"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type LucideIcon, Menu, X, ExternalLink } from "lucide-react";
import { cn } from "../lib/utils";
import { ParticipantBadge } from "./participant-badge";
import { ThemeToggle } from "./theme-toggle";
import { LangToggle } from "./lang-toggle";
import { PoweredByDigitalFactory } from "./powered-by-digital-factory";

export interface DesktopNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface AppLink {
  href: string;
  label: string;
  color: string;
  initial: string;
}

interface Participant {
  id: string;
  name: string;
  compliant: boolean;
}

interface DesktopShellProps {
  children: React.ReactNode;
  navItems: DesktopNavItem[];
  title: string;
  subtitle?: string;
  accentColor?: string;
  participants?: Participant[];
  appLinks?: AppLink[];
  appLinksTitle?: string;
  networkTitle?: string;
}

export function DesktopShell({
  children,
  navItems,
  title,
  subtitle,
  accentColor = "#3b82f6",
  participants,
  appLinks,
  appLinksTitle = "Apps",
  networkTitle = "Network",
}: DesktopShellProps) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex h-dvh overflow-hidden bg-page text-on-page">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── Sidebar: on mobile full-width overlay when open; desktop fixed width ── */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-full max-w-full flex-col border-r border-line bg-surface shadow-xl transition-transform duration-300 lg:static lg:w-64 lg:max-w-[16rem] lg:translate-x-0 lg:shadow-none",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Brand header */}
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-4">
          <div
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-black text-white"
            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}99)` }}
          >
            {title.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-on-page">{title}</p>
            {subtitle && <p className="truncate text-[10px] text-ghost">{subtitle}</p>}
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-ghost hover:bg-subtle hover:text-on-page lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable nav area */}
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-3 py-4">
          {/* Main navigation */}
          <nav className="space-y-0.5">
            {navItems.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(item.href));
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                    isActive
                      ? "text-on-page"
                      : "text-ghost hover:bg-subtle hover:text-on-surface"
                  )}
                  style={
                    isActive
                      ? { backgroundColor: `${accentColor}18`, color: accentColor }
                      : undefined
                  }
                >
                  {isActive && (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full"
                      style={{ backgroundColor: accentColor }}
                    />
                  )}
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* App links section */}
          {appLinks && appLinks.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {appLinksTitle}
              </p>
              <div className="space-y-0.5">
                {appLinks.map((app) => (
                  <a
                    key={app.href}
                    href={app.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-subtle hover:text-on-page"
                  >
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-black text-white"
                      style={{ backgroundColor: app.color }}
                    >
                      {app.initial}
                    </span>
                    <span className="min-w-0 flex-1 break-words overflow-visible whitespace-normal">
                      {app.label}
                    </span>
                    <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Network participants */}
          {participants && participants.length > 0 && (
            <div>
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-wider text-muted">
                {networkTitle}
              </p>
              <div className="space-y-1.5">
                {participants.map((p) => (
                  <ParticipantBadge key={p.id} name={p.name} compliant={p.compliant} />
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* ── Main column: hidden when mobile menu open so sidebar has full focus ── */}
      <div
        className={cn(
          "flex min-w-0 flex-1 flex-col overflow-hidden",
          sidebarOpen && "hidden lg:flex"
        )}
      >
        {/* Fixed top header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-4 shadow-sm backdrop-blur-xl">
          <button
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted transition hover:bg-subtle hover:text-on-page lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="flex-1 text-sm font-bold text-on-page lg:hidden">{title}</h1>
          <div className="hidden flex-1 lg:block" />
          <div className="flex items-center gap-2">
            <LangToggle className="h-10 min-w-[2.75rem] rounded-xl border border-line bg-subtle/80 px-3.5 shadow-sm" />
            <ThemeToggle className="h-10 w-10 rounded-xl border border-line bg-subtle/80 shadow-sm [&_span]:bg-white/50 dark:[&_span]:bg-black/20" />
          </div>
        </header>

        {/* Scrollable content */}
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>

      <PoweredByDigitalFactory />
    </div>
  );
}
