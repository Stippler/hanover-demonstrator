"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, Activity, ArrowRightLeft, RefreshCcw, ChevronRight } from "lucide-react";
import { StatCard, useApi, useAuth, useI18n, EventTimeline, type TimelineEvent } from "@hanover/ui";

const ACCENT = "#7c3aed";

export default function VaultBDashboard() {
  const api = useApi();
  const auth = useAuth();
  const { t } = useI18n();
  const [stats, setStats] = useState({ ownedSkis: 0, recentEvents: 0, pendingTransfers: 0 });
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const [statsRes, eventsRes] = await Promise.allSettled([
        api.get<{ ownedSkis: number; recentEvents: number; pendingTransfers: number }>(
          `/stats?participant=${auth.participantId}`
        ),
        api.get<TimelineEvent[]>(`/events?participant=${auth.participantId}&limit=5`),
      ]);
      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (eventsRes.status === "fulfilled") setEvents(eventsRes.value);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [api, auth.participantId]);

  return (
    <div className="animate-fade-in min-h-full">
      <div className="flex items-center justify-between gap-4 border-b border-line-subtle bg-surface px-5 py-4">
        <h1 className="text-lg font-bold text-on-page">{auth.participantName || t("vault.vault")}</h1>
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
            <StatCard label={t("vault.mySkis")} value={stats.ownedSkis} icon={Package} accentColor={ACCENT} />
            <StatCard label={t("vault.events")} value={stats.recentEvents} icon={Activity} accentColor="#0284c7" />
            <StatCard
              label={t("vault.pendingTransfers")}
              value={stats.pendingTransfers}
              icon={ArrowRightLeft}
              accentColor="#d97706"
              className="col-span-2"
            />
          </div>
        )}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-on-page">{t("vendor.recentActivity")}</h2>
            <Link href="/inventory" className="flex items-center gap-0.5 text-xs font-semibold" style={{ color: ACCENT }}>
              {t("vault.viewAll")} <ChevronRight className="h-3.5 w-3.5" />
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
