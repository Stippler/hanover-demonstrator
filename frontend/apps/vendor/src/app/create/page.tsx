"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Snowflake, ChevronDown, ChevronUp } from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#1d4ed8";

const CATEGORIES = ["Carving", "Freeride", "All-Mountain", "Race", "Touring", "Freestyle", "Beginner"];
const SKILL_LEVELS = ["Beginner", "Intermediate", "Advanced", "Expert"];
const TERRAIN_TYPES = ["Groomed Piste", "All-Mountain", "Off-Piste / Powder", "Moguls", "Park & Pipe"];

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
        {hint && <span className="ml-1.5 normal-case font-normal text-ghost">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls =
  "w-full rounded-xl border border-line bg-subtle px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20";

export default function CreateSkiPage() {
  const api = useApi();
  const router = useRouter();
  const { t } = useI18n();

  // Core fields
  const [model, setModel] = useState("");
  const [manufacturer, setManufacturer] = useState("Alpine Ski Manufacturing");
  const [productionBatch, setProductionBatch] = useState("");
  const [category, setCategory] = useState("");
  const [year, setYear] = useState("");

  // Physical specs
  const [lengthCm, setLengthCm] = useState("");
  const [widthMm, setWidthMm] = useState("");
  const [radiusM, setRadiusM] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [skillLevel, setSkillLevel] = useState("");
  const [terrain, setTerrain] = useState("");
  const [color, setColor] = useState("");
  const [material, setMaterial] = useState("");
  const [countryOfOrigin, setCountryOfOrigin] = useState("Austria");

  // Binding
  const [bindingModel, setBindingModel] = useState("");
  const [bindingDin, setBindingDin] = useState("");
  const [notes, setNotes] = useState("");

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/skis", {
        model,
        manufacturer,
        production_batch: productionBatch || undefined,
        category: category || undefined,
        year: year ? Number(year) : undefined,
        length_cm: lengthCm ? Number(lengthCm) : undefined,
        width_mm: widthMm ? Number(widthMm) : undefined,
        radius_m: radiusM ? Number(radiusM) : undefined,
        weight_kg: weightKg ? Number(weightKg) : undefined,
        skill_level: skillLevel || undefined,
        terrain: terrain || undefined,
        color: color || undefined,
        material: material || undefined,
        country_of_origin: countryOfOrigin || undefined,
        binding_model: bindingModel || undefined,
        binding_din_range: bindingDin || undefined,
        notes: notes.trim() || undefined,
      });
      setSuccess(true);
      setTimeout(() => router.push("/inventory"), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create ski");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="animate-pop-in flex flex-col items-center justify-center px-8 py-24 text-center">
        <div
          className="mb-5 flex h-24 w-24 items-center justify-center rounded-3xl"
          style={{ backgroundColor: `${ACCENT}18` }}
        >
          <CheckCircle2 className="h-12 w-12" style={{ color: ACCENT }} />
        </div>
        <h2 className="text-2xl font-extrabold text-on-page">{t("vendor.created")}</h2>
        <p className="mt-2 text-sm text-muted">{t("vendor.createdMsg")}</p>
        <div className="mt-6 flex items-center gap-1.5 text-xs text-ghost">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("vendor.redirecting")}
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-bold text-on-page">{t("vendor.newPassport")}</h2>
        <p className="text-sm text-muted">{t("vendor.registerSki")}</p>
      </div>

      <div className="mx-auto max-w-4xl p-5">
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* ── Core identity ── */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Identity</p>
            </div>
            <div className="space-y-4 p-4">
              <Field label="Ski Model" required>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  required
                  placeholder="e.g. Alpine Pro X1"
                  className={inputCls}
                />
              </Field>
              <Field label="Manufacturer" required>
                <input
                  type="text"
                  value={manufacturer}
                  onChange={(e) => setManufacturer(e.target.value)}
                  required
                  placeholder="e.g. Alpine Ski Manufacturing"
                  className={inputCls}
                />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Category">
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className={inputCls + " appearance-none pr-8"}
                    >
                      <option value="">Select…</option>
                      {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </Field>
                <Field label="Year">
                  <input
                    type="number"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                    placeholder="2026"
                    min={2000}
                    max={2030}
                    className={inputCls}
                  />
                </Field>
              </div>
              <Field label="Country of Origin">
                <input
                  type="text"
                  value={countryOfOrigin}
                  onChange={(e) => setCountryOfOrigin(e.target.value)}
                  placeholder="e.g. Austria"
                  className={inputCls}
                />
              </Field>
              <Field label={t("passport.notes")} hint={t("service.notesHint")}>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("form.notesPlaceholder")}
                  rows={2}
                  className={inputCls + " resize-none"}
                />
              </Field>
            </div>
          </div>

          {/* ── Physical specs ── */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <div className="border-b border-line px-4 py-3">
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Physical Specs</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="grid grid-cols-2 gap-4">
                <Field label="Length" hint="cm">
                  <input type="number" value={lengthCm} onChange={(e) => setLengthCm(e.target.value)} placeholder="170" className={inputCls} />
                </Field>
                <Field label="Waist Width" hint="mm">
                  <input type="number" value={widthMm} onChange={(e) => setWidthMm(e.target.value)} placeholder="72" className={inputCls} />
                </Field>
                <Field label="Turn Radius" hint="m">
                  <input type="number" value={radiusM} onChange={(e) => setRadiusM(e.target.value)} placeholder="13.5" step="0.1" className={inputCls} />
                </Field>
                <Field label="Weight" hint="kg pair">
                  <input type="number" value={weightKg} onChange={(e) => setWeightKg(e.target.value)} placeholder="3.2" step="0.1" className={inputCls} />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Skill Level">
                  <div className="relative">
                    <select value={skillLevel} onChange={(e) => setSkillLevel(e.target.value)} className={inputCls + " appearance-none pr-8"}>
                      <option value="">Any</option>
                      {SKILL_LEVELS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </Field>
                <Field label="Terrain">
                  <div className="relative">
                    <select value={terrain} onChange={(e) => setTerrain(e.target.value)} className={inputCls + " appearance-none pr-8"}>
                      <option value="">Any</option>
                      {TERRAIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  </div>
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Color">
                  <input type="text" value={color} onChange={(e) => setColor(e.target.value)} placeholder="e.g. Red / Black" className={inputCls} />
                </Field>
                <Field label="Material">
                  <input type="text" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="e.g. Titanal" className={inputCls} />
                </Field>
              </div>
            </div>
          </div>

          {/* ── Manufacturing / advanced ── */}
          <div className="overflow-hidden rounded-2xl border border-line bg-surface">
            <button
              type="button"
              onClick={() => setShowAdvanced((v) => !v)}
              className="flex w-full items-center justify-between border-b border-line px-4 py-3 transition hover:bg-subtle"
            >
              <p className="text-xs font-bold uppercase tracking-widest text-muted">Manufacturing &amp; Binding</p>
              {showAdvanced ? <ChevronUp className="h-4 w-4 text-ghost" /> : <ChevronDown className="h-4 w-4 text-ghost" />}
            </button>
            {showAdvanced && (
              <div className="space-y-4 p-4">
                <Field label="Production Batch">
                  <input type="text" value={productionBatch} onChange={(e) => setProductionBatch(e.target.value)} placeholder="e.g. BATCH-2026-001" className={inputCls} />
                </Field>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Binding Model">
                    <input type="text" value={bindingModel} onChange={(e) => setBindingModel(e.target.value)} placeholder="e.g. Tyrolia Attack" className={inputCls} />
                  </Field>
                  <Field label="DIN Range">
                    <input type="text" value={bindingDin} onChange={(e) => setBindingDin(e.target.value)} placeholder="e.g. 3–12" className={inputCls} />
                  </Field>
                </div>
              </div>
            )}
          </div>

          {error && (
            <div className="rounded-xl border border-red-400/30 bg-red-500/10 p-4 text-sm font-medium text-red-500 dark:text-red-400">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-2 flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #1e40af)`,
              boxShadow: `0 4px 16px ${ACCENT}40`,
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                {t("vendor.creating")}
              </>
            ) : (
              <>
                <Snowflake className="h-5 w-5" />
                {t("form.createPassport")}
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
