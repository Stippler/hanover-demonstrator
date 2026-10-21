"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "../providers/theme-provider";
import { cn } from "../lib/utils";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface shadow-sm transition",
        "hover:bg-subtle hover:border-line hover:shadow",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-page focus:ring-blue-500/50",
        className
      )}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-subtle/90 dark:bg-white/10">
        {isDark ? (
          <Sun className="h-5 w-5 text-amber-500 dark:text-amber-400" />
        ) : (
          <Moon className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        )}
      </span>
    </button>
  );
}
