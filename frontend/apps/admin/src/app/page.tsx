"use client";

import { useEffect, useRef, useState } from "react";
import {
  Package, Users, Activity, ArrowRightLeft, Wrench, ShieldCheck, RefreshCcw, Radio,
  Server, Cpu, CheckCircle2, XCircle, ExternalLink,
} from "lucide-react";
import { StatCard, useApi, useI18n, EventTimeline, type TimelineEvent, ParticipantBadge } from "@hanover/ui";

const POLL_INTERVAL = 15_000;
const DOMAIN = "imx.vactory-projects.com";
const APP_LINKS = [
  { href: `https://vendor.${DOMAIN}`, label: "Ski Vendor", color: "#1d4ed8" },
  { href: `https://vault-a.${DOMAIN}`, label: "VaultA", color: "#059669" },
  { href: `https://vault-b.${DOMAIN}`, label: "VaultB", color: "#7c3aed" },
  { href: `https://service.${DOMAIN}`, label: "Peak Service", color: "#ea580c" },
];

interface SystemStats {
  totalSkis: number;
  totalParticipants: number;
  totalEvents: number;
  activeTransfers: number;
  totalServices: number;
  gaiaXCompliant: number;
}

interface GaiaXParticipant {
  id: string;
  name: string;
  role: string;
  gaiax_compliant: boolean;
}

interface ConnectorHealth {
  participant_id: string;
  host: string;
  health: { status: string; status_code?: number; error?: string };
}

export default function AdminDashboard() {
  const api = useApi();
  const { t } = useI18n();
  const [stats, setStats] = useState<SystemStats>({
    totalSkis: 0, totalParticipants: 0, totalEvents: 0,
    activeTransfers: 0, totalServices: 0, gaiaXCompliant: 0,
  });
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [participants, setParticipants] = useState<GaiaXParticipant[]>([]);
  const [connectorHealth, setConnectorHealth] = useState<{
    participant_apis: ConnectorHealth[];
    edc_connectors: ConnectorHealth[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [livePoll, setLivePoll] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function load(showLoading = false) {
    if (showLoading) setLoading(true);
    try {
      const [statsRes, eventsRes, participantsRes, connectorRes] = await Promise.allSettled([
        api.get<Record<string, number>>("/stats"),
        api.get<{ items: unknown[]; total: number }>("/events?limit=10"),
        api.get<GaiaXParticipant[]>("/participants"),
        api.get<{ participant_apis: ConnectorHealth[]; edc_connectors: ConnectorHealth[] }>("/connector-health"),
      ]);
      if (connectorRes.status === "fulfilled") setConnectorHealth(connectorRes.value);

      const parts: GaiaXParticipant[] =
        participantsRes.status === "fulfilled" ? participantsRes.value : [];
      setParticipants(parts);

      if (statsRes.status === "fulfilled") {
        const s = statsRes.value;
        setStats({
          totalSkis: s.total_skis ?? 0,
          totalParticipants: parts.length,
          totalEvents: s.total_events ?? 0,
          activeTransfers: s.total_transfers ?? 0,
          totalServices: s.total_services ?? 0,
          gaiaXCompliant: parts.filter((p) => p.gaiax_compliant).length,
        });
      }

      if (eventsRes.status === "fulfilled") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = Array.isArray(eventsRes.value)
          ? eventsRes.value
          : ((eventsRes.value as any).items ?? []);
        setEvents(
          raw.map((e) => ({
            id: String(e.id ?? ""),
            type: String(e.event_type ?? ""),
            actor: String(e.actor_name ?? e.actor_participant_id ?? ""),
            timestamp: e.created_at ? new Date(String(e.created_at)).toLocaleString() : "",
            description: `${String(e.event_type ?? "").replace(/_/g, " ")} — ${String(e.serial_number ?? "")}`,
          }))
        );
      }

      setLastUpdated(new Date());
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(true); }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (livePoll) {
      intervalRef.current = setInterval(() => load(), POLL_INTERVAL);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [livePoll]);

  const STAT_CONFIG = [
    { labelKey: "dashboard.totalSkis", key: "totalSkis" as const, icon: Package, color: "#3b82f6" },
    { labelKey: "dashboard.participants", key: "totalParticipants" as const, icon: Users, color: "#8b5cf6" },
    { labelKey: "dashboard.totalEvents", key: "totalEvents" as const, icon: Activity, color: "#06b6d4" },
    { labelKey: "dashboard.transfers", key: "activeTransfers" as const, icon: ArrowRightLeft, color: "#f59e0b" },
    { labelKey: "dashboard.services", key: "totalServices" as const, icon: Wrench, color: "#10b981" },
    { labelKey: "dashboard.gaiaXOk", key: "gaiaXCompliant" as const, icon: ShieldCheck, color: "#22c55e" },
  ];

  return (
    <div className="animate-fade-in space-y-10 p-5 lg:p-8">
      {/* 1. APPS card */}
      <section className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-sm">
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">APPS</h2>
        <div className="flex flex-col gap-2">
          {APP_LINKS.map((app) => (
            <a
              key={app.href}
              href={app.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-subtle/30 px-4 py-3 transition hover:bg-subtle"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span
                  className="h-2 w-8 shrink-0 rounded-full"
                  style={{ backgroundColor: app.color }}
                />
                <span className="font-medium text-on-page">{app.label}</span>
              </div>
              <ExternalLink className="h-4 w-4 shrink-0 text-muted" />
            </a>
          ))}
        </div>
      </section>

      {/* 2. NETWORK (participant cards – single place for network / Gaia-X) */}
      <section>
        <h2 className="mb-4 text-xs font-bold uppercase tracking-widest text-muted">NETWORK</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl bg-subtle" />
            ))}
          </div>
        ) : participants.length === 0 ? (
          <p className="text-sm text-muted">{t("common.noData")}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {participants.map((p) => (
              <div
                key={p.id}
                className="flex min-w-0 items-center justify-between gap-3 rounded-2xl border border-line-subtle bg-surface p-4 shadow-sm"
              >
                <div className="min-w-0 flex-1">
                  <ParticipantBadge name={p.name} compliant={p.gaiax_compliant} className="w-full" />
                </div>
                <span className="shrink-0 text-xs font-medium text-muted">
                  {p.role === "service_shop" ? "Service" : p.role.replace(/_/g, " ")}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. System Overview: title, stats, connector health, recent events */}
      <section className="space-y-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-on-page lg:text-2xl">{t("dashboard.title")}</h2>
            <p className="mt-1 text-sm text-muted">{t("dashboard.subtitle")}</p>
            {lastUpdated && (
              <p className="mt-2 text-xs text-muted tabular-nums">
                {t("common.lastUpdated")}: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setLivePoll((v) => !v)}
              className={`flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                livePoll
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "border-line bg-subtle text-muted hover:text-on-page"
              }`}
            >
              <Radio className={`h-3.5 w-3.5 ${livePoll ? "animate-pulse" : ""}`} />
              {livePoll ? t("common.live") : t("common.paused")}
            </button>
            <button
              onClick={() => load(true)}
              disabled={loading}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted shadow-sm transition hover:bg-subtle hover:text-on-page disabled:opacity-50"
              title={t("common.refresh")}
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* Stats grid */}
        <div className="space-y-4">
          <h3 className="sr-only">{t("dashboard.title")} stats</h3>
          {loading ? (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-32 animate-pulse rounded-2xl bg-subtle" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              {STAT_CONFIG.map(({ labelKey, key, icon, color }) => (
                <StatCard key={key} label={t(labelKey)} value={stats[key]} icon={icon} accentColor={color} />
              ))}
            </div>
          )}
        </div>

        {/* Connector health (inside System Overview) */}
        <div>
          <h3 className="mb-4 text-sm font-bold text-on-page">EDC Activity & Connector Health</h3>
          {connectorHealth ? (
            <div className="space-y-5">
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">Participant APIs</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connectorHealth.participant_apis.map((item) => (
                    <div
                      key={item.participant_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface px-4 py-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Server className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate font-medium text-on-surface">{item.participant_id}</span>
                      </div>
                      {item.health.status === "up" ? (
                        <span title="Up"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /></span>
                      ) : (
                        <span title={item.health.error ?? "Down"}><XCircle className="h-5 w-5 shrink-0 text-red-500" /></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <p className="mb-2 text-xs font-bold uppercase tracking-widest text-muted">EDC Control Planes</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {connectorHealth.edc_connectors.map((item) => (
                    <div
                      key={item.participant_id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line-subtle bg-surface px-4 py-3 shadow-sm"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Cpu className="h-4 w-4 shrink-0 text-muted" />
                        <span className="truncate font-medium text-on-surface">{item.participant_id}</span>
                      </div>
                      {item.health.status === "up" ? (
                        <span title="Up"><CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" /></span>
                      ) : (
                        <span title={item.health.error ?? "Down"}><XCircle className="h-5 w-5 shrink-0 text-red-500" /></span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-subtle" />
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted">Connector health unavailable.</p>
          )}
        </div>

        {/* Recent events */}
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-bold text-on-page">{t("dashboard.recentEvents")}</h3>
            <span className="rounded-full bg-subtle px-2.5 py-1 text-[11px] font-semibold text-muted">
              {t("dashboard.last10")}
            </span>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-line-subtle bg-surface p-5 shadow-sm sm:p-6">
              {events.length > 0 ? (
                <EventTimeline events={events} />
              ) : (
                <p className="py-4 text-center text-sm text-muted">{t("common.noData")}</p>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
