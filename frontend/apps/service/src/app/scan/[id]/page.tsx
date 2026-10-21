"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Snowflake, Wrench } from "lucide-react";
import { EventTimeline, PassportDetail, useApi, useI18n, type FullPassport, type TimelineEvent } from "@hanover/ui";

const ACCENT = "#ea580c";

export default function SkiPassportPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { t } = useI18n();
  const [passport, setPassport] = useState<FullPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    api
      .get<FullPassport>(`/skis/${id}/full-passport`)
      .then(setPassport)
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [api, id]);

  const events: TimelineEvent[] = (passport?.events ?? []).map((e) => ({
    id: e.id,
    type: e.event_type,
    actor: e.actor_name ?? e.actor_participant_id,
    timestamp: e.created_at ?? "",
    description: e.payload ? JSON.stringify(e.payload) : e.event_type,
  }));

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <div className="h-9 w-24 animate-pulse rounded-xl bg-subtle" />
        <div className="h-40 animate-pulse rounded-2xl bg-subtle" />
        <div className="h-56 animate-pulse rounded-2xl bg-subtle" />
        <div className="h-48 animate-pulse rounded-2xl bg-subtle" />
      </div>
    );
  }

  if (notFound || !passport?.ski) {
    return (
      <div className="p-5">
        <button
          onClick={() => router.back()}
          className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="mt-12 flex flex-col items-center gap-3 text-center">
          <div
            className="flex h-20 w-20 items-center justify-center rounded-2xl"
            style={{ backgroundColor: `${ACCENT}18` }}
          >
            <Snowflake className="h-10 w-10" style={{ color: ACCENT }} />
          </div>
          <p className="font-bold text-on-page">{t("service.skiNotFound")}</p>
          <p className="text-sm text-muted">{t("service.noPassportForSki")}</p>
          <button
            onClick={() => router.push("/scan")}
            className="mt-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #c2410c)` }}
          >
            {t("service.scanAgain")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line-subtle bg-surface px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-on-page"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <button
          onClick={() => router.push(`/scan/${id}/service`)}
          className="flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold text-white transition active:scale-95"
          style={{
            background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`,
            boxShadow: `0 4px 12px ${ACCENT}40`,
          }}
        >
          <Wrench className="h-4 w-4" />
          {t("service.record")}
        </button>
      </div>

      <div className="space-y-4 p-5">
        {/* Passport hero */}
        <div
          className="relative overflow-hidden rounded-2xl p-5 text-white"
          style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #c2410c 60%, #9a3412 100%)` }}
        >
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Snowflake className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold">{passport.ski.model}</h2>
              <p className="font-mono text-xs uppercase tracking-widest text-orange-100/60">
                {passport.ski.serial_number}
              </p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <div className="flex flex-col gap-0.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-orange-100/50">
                {t("passport.digitalPassport")}
              </p>
              <p className="text-[10px] text-orange-100/40">{t("passport.lifeCycleData")}</p>
            </div>
            {passport.meta?.version && (
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                v{passport.meta.version}
              </span>
            )}
          </div>
        </div>

        {/* Service CTA banner */}
        <div
          className="flex items-center justify-between rounded-2xl p-4"
          style={{ backgroundColor: `${ACCENT}10`, border: `1px solid ${ACCENT}30` }}
        >
          <div>
            <p className="text-sm font-bold text-on-page">{t("service.readyToService")}</p>
            <p className="text-xs text-muted">{t("service.passportSubtitle")}</p>
          </div>
          <button
            onClick={() => router.push(`/scan/${id}/service`)}
            className="flex h-10 items-center gap-1.5 rounded-xl px-4 text-sm font-bold text-white"
            style={{ background: `linear-gradient(135deg, ${ACCENT}, #c2410c)` }}
          >
            <Wrench className="h-4 w-4" />
            {t("service.record")}
          </button>
        </div>

        {/* Rich passport detail */}
        <PassportDetail passport={passport} accentColor={ACCENT} />

        {/* Event timeline */}
        {events.length > 0 && (
          <div>
            <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
              {t("passport.passportHistory")}
            </h3>
            <div className="rounded-2xl border border-line-subtle bg-surface p-4">
              <EventTimeline events={events} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
