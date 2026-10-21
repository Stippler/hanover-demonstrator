"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useSession } from "@hanover/ui";
import { DashboardShell } from "./shell";

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token, isLoading } = useSession();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (pathname === "/login") return;
    if (!token) {
      router.replace("/login");
    }
  }, [token, isLoading, pathname, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-page">
        <div className="text-muted">Loading…</div>
      </div>
    );
  }
  if (pathname === "/login") {
    return <>{children}</>;
  }
  if (!token) {
    return null;
  }
  return <DashboardShell>{children}</DashboardShell>;
}
