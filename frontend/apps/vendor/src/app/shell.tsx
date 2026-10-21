"use client";

import { Home, Package, PlusCircle, ArrowRightLeft } from "lucide-react";
import { MobileShell, useI18n } from "@hanover/ui";

export function VendorShell({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <MobileShell
      navItems={[
        { href: "/", label: t("nav.dashboard"), icon: Home },
        { href: "/inventory", label: t("nav.inventory"), icon: Package },
        { href: "/create", label: t("nav.create"), icon: PlusCircle },
        { href: "/transfer", label: t("vendor.sellTransfer"), icon: ArrowRightLeft },
      ]}
      themeColor="#1d4ed8"
      title="Ski Vendor"
      logo="V"
    >
      {children}
    </MobileShell>
  );
}
