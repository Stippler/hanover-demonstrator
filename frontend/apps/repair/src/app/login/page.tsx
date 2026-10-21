"use client";

import { useRouter } from "next/navigation";
import { LoginForm, LoginLayout, useI18n } from "@hanover/ui";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useI18n();
  return (
    <LoginLayout>
      <div className="mb-6 flex flex-col items-center gap-3">
        <img
              src="/wintersteiger-logo.svg"
          alt="Wintersteiger"
          className="h-10 object-contain dark:brightness-[1.15]"
        />
      </div>
      <LoginForm
        title={t("repair.loginTitle")}
        subtitle={t("repair.loginSubtitle")}
        accentColor="#86b817"
        onSuccess={() => router.replace("/")}
      />
    </LoginLayout>
  );
}
