"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <LoginForm
        title="Ski Vendor"
        subtitle="Sign in to manage product passes"
        accentColor="#1d4ed8"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
