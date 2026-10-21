"use client";

import { Home, Package, ArrowRightLeft } from "lucide-react";
import { MobileShell, useI18n } from "@hanover/ui";

export function OwnerBShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <MobileShell
      navItems={[
        { href: "/", label: t("nav.dashboard"), icon: Home },
        { href: "/inventory", label: t("nav.vault"), icon: Package },
        { href: "/transfer", label: t("nav.transfers"), icon: ArrowRightLeft },
      ]}
      themeColor="#7c3aed"
      title="VaultB"
      logo="B"
    >
      {children}
    </MobileShell>
  );
}
