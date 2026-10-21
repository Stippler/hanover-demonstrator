"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  return (
    <LoginLayout>
      <div className="mb-6 flex items-center justify-center gap-3">
        <div
          className="flex h-10 items-center justify-center rounded-xl px-4 text-base font-black tracking-widest text-white shadow-lg"
          style={{ background: "#E30613" }}
        >
          ATOMIC
        </div>
      </div>
      <LoginForm
        title="Trace Dashboard"
        subtitle="Sign in to view trace events"
        accentColor="#E30613"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
