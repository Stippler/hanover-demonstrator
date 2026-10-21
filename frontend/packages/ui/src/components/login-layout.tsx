"use client";

import { cn } from "../lib/utils";
import { PoweredByDigitalFactory } from "./powered-by-digital-factory";

interface LoginLayoutProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * Full-page centered layout for login screens.
 * Provides safe-area padding and a subtle gradient background so the form stands out.
 */
export function LoginLayout({ children, className }: LoginLayoutProps) {
  return (
    <div
      className={cn(
        "relative flex min-h-dvh flex-col items-center justify-center bg-page px-4 py-8",
        "pl-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))]",
        "pt-[max(2rem,env(safe-area-inset-top))] pb-[max(2rem,env(safe-area-inset-bottom))]",
        className
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-40"
        aria-hidden
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, var(--color-subtle) 0%, transparent 70%)",
        }}
      />
      {children}
      <PoweredByDigitalFactory />
    </div>
  );
}
