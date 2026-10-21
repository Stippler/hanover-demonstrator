"use client";

import { useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Send, CheckCircle2, Loader2, Wrench } from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#86b817";

const SERVICE_TYPES = [
  "Kantenschleifen",
  "Wachsen",
  "Belagsreparatur",
  "Bindungsmontage",
  "Bindungseinstellung",
  "Inspektion",
  "Sonstiges",
];

function ReportContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const api = useApi();
  const { t } = useI18n();
  const serial = searchParams.get("serial") ?? "";

  const [serialInput, setSerialInput] = useState(serial);
  const [serviceType, setServiceType] = useState(SERVICE_TYPES[0]);
  const [message, setMessage] = useState("");
  const [performedBy, setPerformedBy] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!serialInput.trim()) return;
    setSending(true);
    setError(null);
    try {
      await api.post("/maintenance-report", {
        serialNumber: serialInput.trim(),
        serviceType,
        message: message || `${serviceType} durchgeführt`,
        performedBy: performedBy || "Repair Shop",
      });
      setSent(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to send report");
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="animate-fade-in flex min-h-[60vh] flex-col items-center justify-center px-6 py-12 text-center">
        <div
          className="mb-5 flex h-16 w-16 items-center justify-center rounded-xl"
          style={{ backgroundColor: "rgba(16,185,129,0.1)" }}
        >
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-xl font-extrabold text-on-page">{t("repair.report.submitted")}</h2>
        <p className="mt-2 max-w-md text-sm text-muted">
          {t("repair.report.submittedDesc").replace("{serial}", serialInput)}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => router.push("/")}
            className="rounded-lg border border-line px-5 py-2.5 text-sm font-semibold text-muted transition hover:text-on-page"
          >
            {t("repair.report.backToScanner")}
          </button>
          <button
            onClick={() => { setSent(false); setMessage(""); }}
            className="rounded-lg px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)` }}
          >
            {t("repair.report.newReport")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in px-6 py-6">
      <div className="mb-6 flex items-center gap-2">
        <Wrench className="h-5 w-5" style={{ color: ACCENT }} />
        <h1 className="text-xl font-extrabold text-on-page">{t("repair.report.title")}</h1>
      </div>

      <div className="mx-auto max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-on-page">
              {t("repair.report.serialNumber")}
            </label>
            <input
              type="text"
              value={serialInput}
              onChange={(e) => setSerialInput(e.target.value)}
              placeholder="e.g. 99999999"
              required
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-on-page placeholder:text-ghost transition focus:border-[#86b817] focus:outline-none focus:ring-2 focus:ring-[#86b817]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-on-page">
              {t("repair.report.serviceType")}
            </label>
            <div className="flex flex-wrap gap-2">
              {SERVICE_TYPES.map((type) => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setServiceType(type)}
                  className="rounded-md border px-3 py-1.5 text-sm font-medium transition"
                  style={
                    serviceType === type
                      ? { backgroundColor: ACCENT, color: "white", borderColor: ACCENT }
                      : { borderColor: "var(--t-line)", color: "var(--t-muted)" }
                  }
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-on-page">
              {t("repair.report.notes")}
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t("repair.report.notesPlaceholder")}
              rows={3}
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-on-page placeholder:text-ghost transition focus:border-[#86b817] focus:outline-none focus:ring-2 focus:ring-[#86b817]/20"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-on-page">
              {t("repair.report.performedBy")}
            </label>
            <input
              type="text"
              value={performedBy}
              onChange={(e) => setPerformedBy(e.target.value)}
              placeholder={t("repair.report.performedByPlaceholder")}
              className="w-full rounded-lg border border-line bg-surface px-4 py-2.5 text-sm text-on-page placeholder:text-ghost transition focus:border-[#86b817] focus:outline-none focus:ring-2 focus:ring-[#86b817]/20"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={sending || !serialInput.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white shadow-lg transition hover:opacity-90 active:scale-[0.99] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #5a8a00)`,
              boxShadow: `0 4px 16px ${ACCENT}30`,
            }}
          >
            {sending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> {t("repair.report.sending")}</>
            ) : (
              <><Send className="h-4 w-4" /> {t("repair.report.send")}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4 p-6">
          <div className="h-10 w-32 animate-pulse rounded-lg bg-subtle" />
          <div className="h-64 animate-pulse rounded-xl bg-subtle" />
        </div>
      }
    >
      <ReportContent />
    </Suspense>
  );
}
