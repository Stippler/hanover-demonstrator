"use client";

import { cn } from "../lib/utils";
import {
  Snowflake,
  Factory,
  User,
  Wrench,
  Shield,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  ArrowRightLeft,
} from "lucide-react";
import { useState } from "react";
import { useI18n } from "../providers/i18n-provider";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

export interface FullPassport {
  ski?: {
    id: string;
    serial_number: string;
    model: string;
    manufacturer?: string;
    production_batch?: string;
    created_at?: string;
    qr_payload?: string;
  };
  identity?: {
    serial_number?: string;
    model?: string;
    manufacturer?: string;
    category?: string;
    year?: number;
    length_cm?: number;
    width_mm?: number;
    radius_m?: number;
    weight_kg?: number;
    skill_level?: string;
    terrain?: string;
    color?: string;
    material?: string;
    country_of_origin?: string;
    [key: string]: unknown;
  };
  manufacturer?: {
    vendor?: string;
    production_batch?: string;
    binding_model?: string;
    binding_din_range?: string;
    year?: number;
    [key: string]: unknown;
  };
  ownership?: {
    current_owner?: {
      id: string;
      name: string;
      role: string;
      gaiax_compliant?: boolean;
    };
    history?: Array<{
      id: string;
      seller_name?: string;
      buyer_name?: string;
      status: string;
      created_at?: string;
      completed_at?: string;
    }>;
  };
  service?: {
    total_services?: number;
    last_service?: {
      type?: string;
      date?: string;
      technician?: string;
    };
    records?: Array<{
      id: string;
      service_type: string;
      description?: string;
      technician_name?: string;
      notes?: string;
      service_participant_name?: string;
      created_at?: string;
    }>;
  };
  events?: Array<{
    id: string;
    ski_id: string;
    event_type: string;
    actor_participant_id: string;
    actor_name?: string;
    payload?: Record<string, unknown>;
    created_at?: string;
  }>;
  meta?: {
    version?: number;
    created_at?: string;
    updated_at?: string;
  };
}

interface PassportDetailProps {
  passport: FullPassport;
  accentColor?: string;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function fmt(val: unknown): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") {
    // ISO date string
    if (/^\d{4}-\d{2}-\d{2}T/.test(val)) {
      try {
        return new Date(val).toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      } catch {
        return val;
      }
    }
    return val;
  }
  return JSON.stringify(val);
}

function Row({ label, value, accent }: { label: string; value: unknown; accent?: string }) {
  const display = fmt(value);
  if (display === "—") return null;
  return (
    <div className="flex items-start justify-between gap-3 px-4 py-3 text-sm border-b border-line-subtle last:border-0">
      <span className="font-medium text-muted shrink-0">{label}</span>
      <span
        className="font-semibold text-right text-on-surface truncate max-w-[58%]"
        style={accent ? { color: accent } : undefined}
      >
        {display}
      </span>
    </div>
  );
}

function Section({
  icon: Icon,
  title,
  accent,
  defaultOpen = true,
  children,
}: {
  icon: React.ElementType;
  title: string;
  accent?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-2xl border border-line-subtle bg-surface">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left transition hover:bg-subtle"
      >
        <div className="flex items-center gap-2.5">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg"
            style={{ backgroundColor: accent ? `${accent}18` : "rgba(100,100,100,0.1)" }}
          >
            <Icon className="h-3.5 w-3.5" style={{ color: accent ?? "#6b7280" }} />
          </div>
          <span className="text-xs font-bold uppercase tracking-widest text-muted">{title}</span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-ghost" />
        ) : (
          <ChevronDown className="h-4 w-4 text-ghost" />
        )}
      </button>
      {open && <div className="border-t border-line-subtle">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

export function PassportDetail({ passport, accentColor, className }: PassportDetailProps) {
  const { t } = useI18n();
  const ski = passport.ski;
  const identity = passport.identity ?? {};
  const manufacturer = passport.manufacturer ?? {};
  const ownership = passport.ownership ?? {};
  const service = passport.service ?? {};
  const meta = passport.meta ?? {};

  return (
    <div className={cn("space-y-3", className)}>
      {/* ── Identity Block ── */}
      <Section icon={Snowflake} title={t("passport.identity")} accent={accentColor} defaultOpen>
        <Row label={t("passport.productIdentifier")} value={identity.serial_number ?? ski?.serial_number} />
        <Row label={t("stats.model")} value={identity.model ?? ski?.model} />
        <Row label={t("form.category")} value={identity.category} />
        <Row label={t("form.year")} value={identity.year} />
        <Row label={t("stats.length")} value={identity.length_cm ? `${identity.length_cm} cm` : undefined} />
        <Row label={t("stats.waistWidth")} value={identity.width_mm ? `${identity.width_mm} mm` : undefined} />
        <Row label={t("stats.radius")} value={identity.radius_m ? `${identity.radius_m} m` : undefined} />
        <Row label={t("stats.weightPair")} value={identity.weight_kg ? `${identity.weight_kg} kg` : undefined} />
        <Row label={t("stats.skillLevel")} value={identity.skill_level} />
        <Row label={t("form.terrain")} value={identity.terrain} />
        <Row label={t("stats.color")} value={identity.color} />
        <Row label={t("stats.material")} value={identity.material} />
        <Row label={t("stats.origin")} value={identity.country_of_origin} />
        <Row label={t("passport.notes")} value={identity.notes} />
      </Section>

      {/* ── Manufacturer Block ── */}
      <Section icon={Factory} title={t("passport.manufacturing")} accent={accentColor} defaultOpen>
        <Row label={t("stats.manufacturer")} value={identity.manufacturer ?? ski?.manufacturer} />
        <Row label={t("stats.vendor")} value={manufacturer.vendor} />
        <Row label={t("stats.productionBatch")} value={manufacturer.production_batch ?? ski?.production_batch} />
        <Row label={t("stats.prodYear")} value={manufacturer.year} />
        <Row label={t("stats.bindingModel")} value={manufacturer.binding_model} />
        <Row label={t("stats.bindingDin")} value={manufacturer.binding_din_range} />
        <Row label={t("stats.issued")} value={ski?.created_at} />
      </Section>

      {/* ── Ownership Block ── */}
      <Section icon={User} title={t("passport.ownership")} accent={accentColor} defaultOpen>
        {ownership.current_owner && (
          <div className="flex items-center justify-between px-4 py-3.5 text-sm border-b border-line-subtle">
            <span className="font-medium text-muted">{t("passport.currentOwner")}</span>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-on-surface">{ownership.current_owner.name}</span>
              {ownership.current_owner.gaiax_compliant && (
                <span title="Gaia-X compliant">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                </span>
              )}
            </div>
          </div>
        )}
        <Row label={t("passport.ownerRole")} value={ownership.current_owner?.role} />
        <Row label={t("passport.version")} value={meta.version ? `v${meta.version}` : undefined} />
        <Row label={t("passport.lastUpdated")} value={meta.updated_at} />
        {(ownership.history?.length ?? 0) > 0 && (
          <div className="px-4 py-3 text-sm">
            <p className="mb-2.5 font-medium text-muted">{t("passport.transferHistory")}</p>
            <div className="space-y-2">
              {ownership.history!.map((t_item) => (
                <div key={t_item.id} className="flex items-center gap-2 text-xs">
                  <ArrowRightLeft className="h-3 w-3 shrink-0 text-ghost" />
                  <span className="text-muted">{t_item.seller_name}</span>
                  <span className="text-ghost">→</span>
                  <span className="font-semibold text-on-surface">{t_item.buyer_name}</span>
                  <span
                    className={cn(
                      "ml-auto shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
                      t_item.status === "completed"
                        ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                        : t_item.status === "pending"
                        ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                        : "bg-surface text-ghost",
                    )}
                  >
                    {t_item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      {/* ── Service Block ── */}
      <Section icon={Wrench} title={t("passport.serviceHistory")} accent={accentColor} defaultOpen={false}>
        <Row label={t("passport.totalServices")} value={service.total_services} />
        {service.last_service?.type && (
          <>
            <Row label={t("passport.lastServiceType")} value={service.last_service.type} />
            <Row label={t("passport.lastServiceDate")} value={service.last_service.date} />
            <Row label={t("passport.technician")} value={service.last_service.technician} />
          </>
        )}
        {(service.records?.length ?? 0) > 0 && (
          <div className="px-4 py-3 space-y-3">
            {service.records!.map((r) => (
              <div key={r.id} className="rounded-xl border border-line-subtle bg-subtle p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <span className="font-bold text-on-surface">{r.service_type}</span>
                  <span className="shrink-0 text-xs text-ghost">{fmt(r.created_at)}</span>
                </div>
                {r.description && (
                  <p className="mt-1 text-xs text-muted">{r.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ghost">
                  {r.technician_name && <span>Tech: {r.technician_name}</span>}
                  {r.service_participant_name && <span>By: {r.service_participant_name}</span>}
                  {r.notes && <span className="italic">{r.notes}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
        {!service.total_services && (
          <div className="px-4 py-5 text-center text-sm text-ghost">{t("passport.noServiceRecords")}</div>
        )}
      </Section>

      {/* ── Audit Block ── */}
      <Section icon={Shield} title={t("passport.audit")} accent={accentColor} defaultOpen={false}>
        <Row label={t("passport.passportCreated")} value={meta.created_at} />
        <Row label={t("passport.lastModified")} value={meta.updated_at} />
        <Row label={t("common.version")} value={meta.version} />
        <Row label={t("passport.skiId")} value={ski?.id} />
      </Section>
    </div>
  );
}
