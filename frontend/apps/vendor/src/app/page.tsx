"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Activity, ArrowRightLeft, PlusCircle, TrendingUp, RefreshCcw } from "lucide-react";
import { StatCard, useApi, useI18n, EventTimeline, type TimelineEvent } from "@hanover/ui";

const ACCENT = "#1d4ed8";

export default function VendorDashboard() {
  const api = useApi();
  const { t } = useI18n();
  const [stats, setStats] = useState({ totalSkis: 0, recentEvents: 0, activeTransfers: 0 });
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [statsRes, eventsRes] = await Promise.allSettled([
        api.get<{ totalSkis: number; recentEvents: number; activeTransfers: number }>(
          "/stats?participant=vendor"
        ),
        api.get<TimelineEvent[]>("/events?participant=vendor&limit=5"),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [api]);

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-surface px-5 py-4">
        <h1 className="text-lg font-bold text-on-page">{t("vendor.workshopTitle")}</h1>
        <button
          onClick={() => { setLoading(true); load(); }}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-line text-on-page transition hover:bg-subtle disabled:opacity-50"
          title={t("common.refresh")}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-6 px-4 py-5">
        {/* Stats */}
        {loading ? (
          <div className="grid grid-cols-2 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`h-28 animate-pulse rounded-2xl bg-subtle ${i === 3 ? "col-span-2" : ""}`} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <StatCard label={t("vendor.passportsIssued")} value={stats.totalSkis} icon={Package} accentColor={ACCENT} />
            <StatCard label={t("vendor.recentEvents")} value={stats.recentEvents} icon={Activity} accentColor="#7c3aed" />
            <StatCard
              label={t("vendor.activeTransfers")}
              value={stats.activeTransfers}
              icon={ArrowRightLeft}
              accentColor="#ea580c"
              className="col-span-2"
            />
          </div>
        )}

        {/* Activity */}
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-page">{t("vendor.recentActivity")}</h2>
            <TrendingUp className="h-4 w-4 text-ghost" />
          </div>
          <div className="rounded-2xl border border-line bg-surface p-4">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-14 animate-pulse rounded-xl bg-subtle" />
                ))}
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
