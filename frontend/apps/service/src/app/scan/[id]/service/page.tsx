"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { CheckCircle2, Loader2, ArrowLeft, Wrench, ChevronDown } from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#ea580c";

const SERVICE_TYPES = [
  "Edge Sharpening",
  "Base Repair",
  "Wax Application",
  "Binding Adjustment",
  "Full Tune-Up",
  "Structural Repair",
];

export default function ServiceFormPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { t } = useI18n();

  const [serviceType, setServiceType] = useState("");
  const [description, setDescription] = useState("");
  const [technician, setTechnician] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/skis/${id}/service`, {
        service_type: serviceType,
        description,
        technician,
        notes,
        participant_id: "service_shop",
      });
      setSuccess(true);
      setTimeout(() => router.push("/history"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to record service");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="animate-pop-in flex flex-col items-center justify-center px-8 py-24 text-center">
        <div
          className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{ backgroundColor: "#d1fae518" }}
        >
          <CheckCircle2 className="h-12 w-12 text-emerald-500 dark:text-emerald-400" />
        </div>
        <h2 className="text-2xl font-extrabold text-on-page">{t("service.recorded")}</h2>
        <p className="mt-2 text-sm text-muted">{t("service.passportUpdated")}</p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-ghost">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("service.redirectingToHistory")}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full">
      <div className="flex items-center gap-3 border-b border-line-subtle bg-surface px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-on-page"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div
          className="flex h-9 w-9 items-center justify-center rounded-xl"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <Wrench className="h-4.5 w-4.5" style={{ color: ACCENT }} />
        </div>
        <div>
          <p className="text-sm font-bold text-on-page">{t("service.record")}</p>
          <p className="font-mono text-[11px] text-muted">Ski {id}</p>
        </div>
      </div>

      <div className="p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              {t("service.serviceType")}
            </label>
            <div className="relative">
              <select
                value={serviceType}
                onChange={(e) => setServiceType(e.target.value)}
                required
                className="w-full appearance-none rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
              >
                <option value="">{t("service.selectServiceType")}</option>
                {SERVICE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              {t("service.description")}
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              rows={3}
              placeholder={t("service.describePlaceholder")}
              className="w-full rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              {t("service.technician")}
            </label>
            <input
              type="text"
              value={technician}
              onChange={(e) => setTechnician(e.target.value)}
              required
              placeholder="e.g. Max Müller"
              className="w-full rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>

          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              {t("service.notes")} <span className="normal-case text-ghost">({t("service.notesHint")})</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={t("service.notesHint")}
              className="w-full rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 resize-none"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm font-medium text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`,
              boxShadow: `0 4px 16px ${ACCENT}40`,
            }}
          >
            {submitting ? (
              <><Loader2 className="h-5 w-5 animate-spin" /> {t("service.saving")}</>
            ) : (
              <><Wrench className="h-5 w-5" /> {t("service.record")}</>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
