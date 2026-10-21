"use client";

import { useI18n, type Locale } from "../providers/i18n-provider";
import { cn } from "../lib/utils";

interface LangToggleProps {
  className?: string;
}

export function LangToggle({ className }: LangToggleProps) {
  const { locale, setLocale } = useI18n();
  const next: Locale = locale === "en" ? "de" : "en";

  return (
    <button
      type="button"
      onClick={() => setLocale(next)}
      title={locale === "en" ? "Switch to German (DE)" : "Auf Englisch wechseln (EN)"}
      className={cn(
        "flex h-10 min-w-[2.75rem] items-center justify-center rounded-xl border border-line bg-surface px-3.5 shadow-sm transition",
        "hover:bg-subtle hover:border-line hover:shadow",
        "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-page focus:ring-blue-500/50",
        className
      )}
      aria-label={locale === "en" ? "Switch to German" : "Switch to English"}
    >
      <span className="text-xs font-extrabold uppercase tracking-wider text-on-page">
        {locale === "en" ? "DE" : "EN"}
      </span>
    </button>
  );
}
