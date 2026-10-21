"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, BarChart3, Shield, LogOut, BookOpen } from "lucide-react";
import { ThemeToggle, LangToggle, useSession, PoweredByDigitalFactory } from "@hanover/ui";

const ACCENT = "#E30613";

const NAV = [
  { href: "/", label: "Event Log", icon: Activity },
  { href: "/stats", label: "Statistics", icon: BarChart3 },
  { href: "/access", label: "Access Control", icon: Shield },
  { href: "/observability", label: "How it works", icon: BookOpen },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { logout } = useSession();

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-page text-on-page">
      <header className="sticky top-0 z-50 shrink-0 border-b border-line bg-surface/95 backdrop-blur-sm">
        <div className="flex h-14 items-center gap-6 px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div
              className="flex h-8 items-center justify-center rounded-lg px-2.5 text-sm font-black tracking-wider text-white"
              style={{ background: ACCENT }}
            >
              ATOMIC
            </div>
            <span className="font-bold text-on-page">Trace Dashboard</span>
          </Link>

          {/* Nav */}
          <nav className="flex items-center gap-1">
            {NAV.map((item) => {
              const isActive = item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-red-500/10 text-red-600 dark:text-red-400"
                      : "text-muted hover:bg-subtle hover:text-on-page"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Controls */}
          <div className="flex items-center gap-2">
            <LangToggle className="h-9 rounded-lg border border-line bg-subtle/60 px-2.5 text-xs" />
            <ThemeToggle className="h-9 w-9 rounded-lg border border-line bg-subtle/60" />
            <div className="mx-1 h-5 w-px bg-line" />
            <button
              onClick={() => logout()}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition hover:bg-subtle hover:text-on-page"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-auto">{children}</main>
      <PoweredByDigitalFactory />
    </div>
  );
}
