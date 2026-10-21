"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <LoginForm
        title="Peak Service"
        subtitle="Sign in to scan and record services"
        accentColor="#ea580c"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
