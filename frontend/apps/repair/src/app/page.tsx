"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Camera, Keyboard, Snowflake, AlertCircle, Zap } from "lucide-react";
import { useApi, QrScanner, useI18n } from "@hanover/ui";

const ACCENT = "#86b817";

interface LookupResponse {
  traceId: string;
  serialNumber: string;
  source: string;
  passport: Record<string, unknown>;
}

export default function ScanPage() {
  const api = useApi();
  const router = useRouter();
  const { t } = useI18n();
  const [serial, setSerial] = useState("");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doLookup = useCallback(
    async (serialNumber: string) => {
      const trimmed = serialNumber.trim();
      if (!trimmed) return;
      setSearching(true);
      setError(null);
      try {
        const data = await api.post<LookupResponse>("/lookup", { serialNumber: trimmed });
        sessionStorage.setItem(`passport-${trimmed}`, JSON.stringify(data));
        router.push(`/result?serial=${encodeURIComponent(trimmed)}`);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "Lookup failed");
      } finally {
        setSearching(false);
      }
    },
    [api, router]
  );

  const handleQrScan = useCallback(
    (result: string) => {
      let id = result;
      if (result.includes("wseqr.amersports.com")) {
        try {
          const url = new URL(result);
          id = url.searchParams.get("sn") || result;
        } catch { /* use raw */ }
      } else if (result.includes("/")) {
        id = result.split("/").pop()!;
      }
      setSerial(id);
      doLookup(id);
    },
    [doLookup]
  );

  return (
    <div className="animate-fade-in px-6 py-6">
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-xl font-extrabold text-on-page">{t("repair.scan.title")}</h1>
        <p className="mt-0.5 text-sm text-muted">{t("repair.scan.subtitle")}</p>
      </div>

      <div className="flex gap-8">
        {/* Left column — Scanner / Input */}
        <div className="flex-1 min-w-0 space-y-5">
          {/* Mode toggle */}
          <div className="inline-flex rounded-lg border border-line bg-surface p-1">
            {(["camera", "manual"] as const).map((m) => (
              <button
                key={m}
                onClick={() => { setMode(m); setError(null); }}
                className="flex items-center gap-1.5 rounded-md px-4 py-2 text-sm font-semibold transition-all"
                style={
                  mode === m
                    ? { backgroundColor: ACCENT, color: "white", boxShadow: `0 2px 8px ${ACCENT}40` }
                    : { color: "var(--t-muted)" }
                }
              >
                {m === "camera" ? <Camera className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
                {m === "camera" ? t("repair.scan.camera") : t("repair.scan.manual")}
              </button>
            ))}
          </div>

          {/* Camera mode */}
          {!searching && mode === "camera" && (
            <div className="flex justify-center">
              <div className="w-full max-w-md overflow-hidden rounded-xl border border-line shadow-md">
                <QrScanner
                  onScan={handleQrScan}
                  themeColor={ACCENT}
                  className="aspect-[4/3] w-full"
                />
              </div>
            </div>
          )}

          {/* Manual mode */}
          {!searching && mode === "manual" && (
            <div className="max-w-lg space-y-4">
              <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-ghost">
                  {t("repair.scan.serialLabel")}
                </label>
                <form
                  onSubmit={(e) => { e.preventDefault(); doLookup(serial); }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={serial}
                    onChange={(e) => setSerial(e.target.value)}
                    placeholder="e.g. 99999999"
                    className="flex-1 rounded-lg border border-line bg-page px-4 py-2.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-[#86b817] focus:outline-none focus:ring-2 focus:ring-[#86b817]/20"
                  />
                  <button
                    type="submit"
                    disabled={searching || !serial.trim()}
                    className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)`,
                      boxShadow: `0 4px 12px ${ACCENT}30`,
                    }}
                  >
                    <Search className="h-4 w-4" />
                    {t("repair.scan.lookup")}
                  </button>
                </form>
              </div>

              <div className="flex flex-wrap gap-2">
                {[
                  { sn: "44444444", label: "BENT 110" },
                  { sn: "99999999", label: "REDSTER G7" },
                  { sn: "55555555", label: "Demo 55" },
                ].map(({ sn, label }) => (
                  <button
                    key={sn}
                    onClick={() => { setSerial(sn); doLookup(sn); }}
                    disabled={searching}
                    className="flex items-center gap-2 rounded-lg border border-line bg-surface px-4 py-2 text-sm font-medium text-muted transition hover:bg-subtle hover:text-on-page"
                  >
                    <Zap className="h-3.5 w-3.5" />
                    {label} ({sn})
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Loading state */}
          {searching && (
            <div className="animate-fade-in flex max-w-lg flex-col items-center gap-4 rounded-xl border border-line bg-surface py-12 shadow-sm">
              <div
                className="flex h-14 w-14 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${ACCENT}15` }}
              >
                <Snowflake className="h-7 w-7 animate-spin" style={{ color: ACCENT }} />
              </div>
              <div className="text-center">
                <p className="font-bold text-on-page">{t("repair.scan.retrieving")}</p>
                <p className="mt-1 text-sm text-muted">{t("repair.scan.connecting")}</p>
              </div>
              <div className="flex items-center gap-3 rounded-lg bg-subtle px-5 py-2.5">
                <Loader2 className="h-4 w-4 animate-spin text-muted" />
                <div className="space-y-1.5">
                  <div className="h-2 w-36 animate-pulse rounded bg-line" />
                  <div className="h-2 w-24 animate-pulse rounded bg-line" />
                </div>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="animate-fade-in max-w-lg rounded-xl border border-red-500/20 bg-red-500/5 p-5">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
                <div>
                  <p className="font-semibold text-red-600 dark:text-red-400">{t("repair.scan.lookupFailed")}</p>
                  <p className="mt-1 text-sm text-muted">{error}</p>
                  <button
                    onClick={() => { setError(null); setSerial(""); }}
                    className="mt-3 text-sm font-semibold text-red-600 hover:underline dark:text-red-400"
                  >
                    {t("repair.scan.tryAgain")}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right column — How it works */}
        <div className="hidden w-72 shrink-0 xl:block">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-xl border border-line bg-surface p-5 shadow-sm">
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ghost">
                {t("repair.scan.howItWorks")}
              </p>
              <div className="space-y-3">
                {[
                  { n: 1, text: t("repair.scan.step1") },
                  { n: 2, text: t("repair.scan.step2") },
                  { n: 3, text: t("repair.scan.step3") },
                  { n: 4, text: t("repair.scan.step4") },
                ].map(({ n, text }) => (
                  <div key={n} className="flex items-start gap-2.5">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                      style={{ backgroundColor: ACCENT }}
                    >
                      {n}
                    </span>
                    <span className="text-xs text-muted leading-relaxed">{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
