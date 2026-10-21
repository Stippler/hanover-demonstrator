"use client";

import { useEffect, useState } from "react";
import { RefreshCcw, Loader2, BarChart3, Activity, Server } from "lucide-react";
import { useApi } from "@hanover/ui";

const ACCENT = "#E30613";

interface StatsData {
  total_events: number;
  by_type: Record<string, number>;
  by_source: Record<string, number>;
}

interface RawStatRow {
  event_type: string;
  cnt: number;
}

const TYPE_COLORS: Record<string, string> = {
  qr_scanned: "#3b82f6",
  edc_catalog_query: "#06b6d4",
  edc_catalog_received: "#06b6d4",
  edc_contract_negotiation: "#6366f1",
  edc_agreement_reached: "#6366f1",
  edc_negotiation_timeout: "#ef4444",
  edc_transfer_started: "#8b5cf6",
  edc_edr_received: "#8b5cf6",
  edc_data_plane_fetch: "#a855f7",
  edc_transfer_failed: "#ef4444",
  gaiax_edc_policy_evaluation: "#f97316",
  gaiax_vc_generation: "#f59e0b",
  gaiax_vp_creation: "#f59e0b",
  gaiax_compliance_submission: "#eab308",
  gaiax_compliance_verified: "#10b981",
  gaiax_compliance_rejected: "#ef4444",
  gaiax_compliance_error: "#ef4444",
  edc_catalog_error: "#ef4444",
  edc_negotiation_error: "#ef4444",
  edc_negotiation_failed: "#ef4444",
  edc_transfer_error: "#ef4444",
  edc_transfer_completed: "#10b981",
  edc_handshake_complete: "#10b981",
  edc_handshake_skipped: "#eab308",
  aas_data_fetch: "#0891b2",
  aas_service_data_received: "#0891b2",
  aas_product_model_received: "#0891b2",
  data_request_received: "#22c55e",
  data_response_sent: "#22c55e",
  dpp_data_returned: "#22c55e",
  lookup_error: "#ef4444",
  maintenance_report_sent: "#14b8a6",
  maintenance_report_created: "#14b8a6",
};

const SOURCE_COLORS: Record<string, string> = {
  repair_api: "#3b82f6",
  repair_shop_edc: "#818cf8",
  edc_cp_repair_shop: "#6366f1",
  edc_cp_dpp: "#10b981",
  dpp_api: "#059669",
  dpp_data_path: "#0891b2",
  "gx-compliance": "#ea580c",
  gaiax_bridge: "#ea580c",
};

export default function StatsPage() {
  const api = useApi();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const raw = await api.get<StatsData & { stats?: RawStatRow[] }>("/traces/stats");
      const byType = raw.by_type ?? {};
      const bySource = raw.by_source ?? {};
      let total = raw.total_events ?? 0;
      if ((!Object.keys(byType).length) && Array.isArray(raw.stats)) {
        for (const row of raw.stats) { byType[row.event_type] = row.cnt; total += row.cnt; }
      }
      setStats({ total_events: total, by_type: byType, by_source: bySource });
    } catch {
      setStats(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [api]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-24">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: ACCENT }} />
        <span className="text-sm text-muted">Loading statistics…</span>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex flex-col items-center py-24 text-center">
        <BarChart3 className="mb-3 h-8 w-8 text-ghost" />
        <p className="font-semibold text-on-page">Could not load statistics</p>
      </div>
    );
  }

  const maxTypeCount = Math.max(...Object.values(stats.by_type), 1);
  const maxSourceCount = Math.max(...Object.values(stats.by_source), 1);

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
        <div>
          <h1 className="text-2xl font-extrabold text-on-page">Statistics</h1>
          <p className="mt-1 text-sm text-muted">Overview of all trace activity</p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-subtle hover:text-on-page disabled:opacity-50"
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="p-6 space-y-6">
        {/* Summary cards */}
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Total Events", value: stats.total_events, icon: Activity, color: ACCENT },
            { label: "Event Types", value: Object.keys(stats.by_type).length, icon: BarChart3, color: "#06b6d4" },
            { label: "Sources", value: Object.keys(stats.by_source).length, icon: Server, color: "#10b981" },
          ].map((card) => (
            <div key={card.label} className="flex items-center gap-4 rounded-xl border border-line bg-surface p-5">
              <div
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${card.color}12` }}
              >
                <card.icon className="h-5 w-5" style={{ color: card.color }} />
              </div>
              <div>
                <p className="text-2xl font-extrabold text-on-page">{card.value}</p>
                <p className="text-xs text-muted">{card.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Two-column charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* By type */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-5 text-sm font-bold text-on-page">Events by Type</h2>
            <div className="space-y-3">
              {Object.entries(stats.by_type)
                .sort(([, a], [, b]) => b - a)
                .map(([type, count]) => (
                  <div key={type} className="flex items-center gap-3">
                    <span className="w-44 shrink-0 truncate text-xs font-medium text-muted">{type}</span>
                    <div className="min-w-0 flex-1">
                      <div className="h-6 overflow-hidden rounded bg-subtle">
                        <div
                          className="h-6 rounded transition-all duration-500"
                          style={{
                            width: `${(count / maxTypeCount) * 100}%`,
                            backgroundColor: TYPE_COLORS[type] ?? "#6b7280",
                          }}
                        />
                      </div>
                    </div>
                    <span className="w-10 shrink-0 text-right font-mono text-xs font-bold text-on-surface">{count}</span>
                  </div>
                ))}
            </div>
          </div>

          {/* By source */}
          <div className="rounded-xl border border-line bg-surface p-5">
            <h2 className="mb-5 text-sm font-bold text-on-page">Events by Source</h2>
            {Object.keys(stats.by_source).length === 0 ? (
              <p className="py-8 text-center text-sm text-ghost">No source data available</p>
            ) : (
              <div className="space-y-3">
                {Object.entries(stats.by_source)
                  .sort(([, a], [, b]) => b - a)
                  .map(([source, count]) => (
                    <div key={source} className="flex items-center gap-3">
                      <span className="w-44 shrink-0 truncate text-xs font-medium text-muted">{source}</span>
                      <div className="min-w-0 flex-1">
                        <div className="h-6 overflow-hidden rounded bg-subtle">
                          <div
                            className="h-6 rounded transition-all duration-500"
                            style={{
                              width: `${(count / maxSourceCount) * 100}%`,
                              backgroundColor: SOURCE_COLORS[source] ?? "#6b7280",
                            }}
                          />
                        </div>
                      </div>
                      <span className="w-10 shrink-0 text-right font-mono text-xs font-bold text-on-surface">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
