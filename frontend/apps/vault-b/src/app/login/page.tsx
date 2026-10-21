"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <LoginForm
        title="VaultB"
        subtitle="Sign in to your sovereign inventory"
        accentColor="#7c3aed"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
