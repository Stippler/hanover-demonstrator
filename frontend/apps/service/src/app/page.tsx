"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Wrench, Activity, ScanLine, RefreshCcw, ChevronRight } from "lucide-react";
import { StatCard, useApi, useI18n, EventTimeline, type TimelineEvent } from "@hanover/ui";

const ACCENT = "#ea580c";

export default function ServiceDashboard() {
  const api = useApi();
  const { t } = useI18n();
  const [stats, setStats] = useState({ servicesCompleted: 0, thisWeek: 0, skisScanned: 0, lastServiceAt: null as string | null });
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [statsRes, eventsRes] = await Promise.allSettled([
        api.get<{ servicesCompleted: number; thisWeek: number; skisScanned: number; lastServiceAt?: string | null }>("/stats"),
        api.get<{ items: TimelineEvent[] }>("/events?limit=5"),
      ]);
      if (statsRes.status === "fulfilled") {
        const v = statsRes.value;
        setStats({
          servicesCompleted: v.servicesCompleted ?? 0,
          thisWeek: v.thisWeek ?? 0,
          skisScanned: v.skisScanned ?? 0,
          lastServiceAt: v.lastServiceAt ?? null,
        });
      }
      if (eventsRes.status === "fulfilled") {
        const data = eventsRes.value;
        setEvents(Array.isArray(data) ? data : (data?.items ?? []));
      }
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [api]);

  return (
    <div className="animate-fade-in min-h-full">
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-surface px-5 py-4">
        <h1 className="text-lg font-bold text-on-page">{t("service.workshop")}</h1>
        <button
          onClick={() => { setLoading(true); load(); }}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-on-page transition hover:bg-subtle disabled:opacity-50"
          title={t("common.refresh")}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-5 px-4 py-5">
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-28 animate-pulse rounded-2xl bg-subtle ${i === 3 ? "col-span-2" : ""}`} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("service.servicesDone")} value={stats.servicesCompleted} icon={Wrench} accentColor={ACCENT} />
            <StatCard label={t("service.thisWeek")} value={stats.thisWeek} icon={Activity} accentColor="#d97706" />
            <StatCard label={t("service.skisScanned")} value={stats.skisScanned} icon={ScanLine} accentColor="#0284c7" className="col-span-2" />
          </div>
        )}
        {!loading && (
          <p className="text-xs text-muted">
            {stats.lastServiceAt
              ? `${t("service.lastService")}: ${new Date(stats.lastServiceAt).toLocaleString()}`
              : t("service.noServicesYet")}
          </p>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-page">{t("service.recentServices")}</h2>
            <Link href="/history" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: ACCENT }}>
              {t("service.allHistory")} <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          <div className="rounded-2xl border border-line-subtle bg-surface p-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-subtle" />)}
              </div>
            ) : (
              <EventTimeline events={events} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
