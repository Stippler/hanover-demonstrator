"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <LoginForm
        title="Demonstrator Dashboard"
        subtitle="Sign in to manage the network"
        accentColor="#475569"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
