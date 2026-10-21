"use client";

import { useState } from "react";
import { useSession } from "../providers/session-provider";
import { useI18n } from "../providers/i18n-provider";
import { cn } from "../lib/utils";

interface LoginFormProps {
  title?: string;
  subtitle?: string;
  onSuccess?: () => void;
  className?: string;
  /** Optional accent color for the login button (e.g. app theme). Falls back to blue. */
  accentColor?: string;
}

export function LoginForm({
  title = "Sign in",
  subtitle,
  onSuccess,
  className,
  accentColor,
}: LoginFormProps) {
  const { login } = useSession();
  const { t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("auth.loginFailed"));
    } finally {
      setLoading(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 dark:focus:border-blue-400 dark:focus:ring-blue-400/20";

  return (
    <div className={cn("flex w-full max-w-md flex-col gap-8", className)}>
      {/* Header: title and subtitle */}
      <header className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-on-page">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-2 text-base text-muted">{subtitle}</p>
        )}
      </header>

      {/* Card: form with username, password, and Login button */}
      <form
        onSubmit={handleSubmit}
        className={cn(
          "flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-xl shadow-black/5 dark:shadow-black/20 sm:p-8",
          "ring-1 ring-line-subtle/50"
        )}
      >
        {error && (
          <div
            role="alert"
            className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-medium text-red-600 dark:bg-red-400/90 dark:text-red-50"
          >
            {error}
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <label
              htmlFor="login-username"
              className="block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {t("auth.username")}
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              disabled={loading}
              className={inputCls}
              placeholder={t("auth.username")}
            />
          </div>
          <div className="space-y-2">
            <label
              htmlFor="login-password"
              className="block text-xs font-semibold uppercase tracking-wider text-muted"
            >
              {t("auth.password")}
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              disabled={loading}
              className={inputCls}
              placeholder="••••••••"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={cn(
            "mt-2 w-full rounded-xl px-4 py-3.5 text-base font-semibold text-white transition focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-surface disabled:opacity-50",
            accentColor ? "hover:opacity-95 active:opacity-90" : "bg-blue-600 hover:bg-blue-700 focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600"
          )}
          style={accentColor ? { backgroundColor: accentColor } : undefined}
        >
          {loading ? t("auth.signingIn") : t("auth.login")}
        </button>
      </form>

      <p className="text-center text-sm text-muted">
        For testing, username and password is{" "}
        <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs font-semibold text-on-surface">demo</code>
        {" / "}
        <code className="rounded bg-subtle px-1.5 py-0.5 font-mono text-xs font-semibold text-on-surface">demo</code>
      </p>
    </div>
  );
}
