"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <LoginForm
        title="VaultA"
        subtitle="Sign in to your sovereign inventory"
        accentColor="#059669"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
