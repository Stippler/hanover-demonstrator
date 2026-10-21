"use client";

import { Home, ScanLine, History } from "lucide-react";
import { MobileShell, useI18n } from "@hanover/ui";

export function ServiceShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <MobileShell
      navItems={[
        { href: "/", label: t("nav.dashboard"), icon: Home },
        { href: "/scan", label: t("nav.scan"), icon: ScanLine },
        { href: "/history", label: t("nav.history"), icon: History },
      ]}
      themeColor="#ea580c"
      title="Peak Service"
      logo="S"
    >
      {children}
    </MobileShell>
  );
}
