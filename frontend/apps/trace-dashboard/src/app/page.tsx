"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { RefreshCcw, Activity, Loader2, Filter, ChevronDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, Trash2 } from "lucide-react";
import { useApi } from "@hanover/ui";

const ACCENT = "#E30613";

interface TraceEvent {
  id: string;
  trace_id: string;
  span_id: string;
  parent_span_id: string | null;
  event_type: string;
  source: string;
  participant_id: string | null;
  serial_number: string | null;
  payload: Record<string, unknown> | null;
  timestamp: string;
}

const EVENT_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  qr_scanned:                     { bg: "bg-blue-500/10",    text: "text-blue-600 dark:text-blue-400",      dot: "bg-blue-500" },
  edc_catalog_query:              { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  edc_catalog_received:           { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  edc_contract_negotiation:       { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",  dot: "bg-indigo-500" },
  edc_agreement_reached:          { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",  dot: "bg-indigo-500" },
  edc_negotiation_timeout:        { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_negotiation_requested:      { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",  dot: "bg-indigo-500" },
  edc_negotiation_accepted:       { bg: "bg-indigo-500/10",  text: "text-indigo-600 dark:text-indigo-400",  dot: "bg-indigo-500" },
  edc_negotiation_agreed:         { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_negotiation_finalized:      { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_negotiation_terminated:     { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_did_resolution:             { bg: "bg-sky-500/10",     text: "text-sky-600 dark:text-sky-400",        dot: "bg-sky-500" },
  edc_transfer_started:           { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",  dot: "bg-violet-500" },
  edc_edr_received:               { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",  dot: "bg-violet-500" },
  edc_data_plane_fetch:           { bg: "bg-purple-500/10",  text: "text-purple-600 dark:text-purple-400",  dot: "bg-purple-500" },
  edc_data_plane_received:        { bg: "bg-purple-500/10",  text: "text-purple-600 dark:text-purple-400",  dot: "bg-purple-500" },
  edc_data_plane_error:           { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_negotiation_reused:         { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_transfer_failed:            { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_transfer_process_started:   { bg: "bg-violet-500/10",  text: "text-violet-600 dark:text-violet-400",  dot: "bg-violet-500" },
  edc_transfer_process_completed: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_transfer_process_terminated:{ bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  gaiax_edc_policy_evaluation:    { bg: "bg-orange-500/10",  text: "text-orange-600 dark:text-orange-400",  dot: "bg-orange-500" },
  gaiax_vc_generation:            { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",    dot: "bg-amber-500" },
  gaiax_vp_creation:              { bg: "bg-amber-500/10",   text: "text-amber-600 dark:text-amber-400",    dot: "bg-amber-500" },
  gaiax_compliance_submission:    { bg: "bg-yellow-500/10",  text: "text-yellow-600 dark:text-yellow-400",  dot: "bg-yellow-500" },
  gaiax_compliance_verified:      { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  gaiax_compliance_rejected:      { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  gaiax_compliance_error:         { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  gaiax_credential_verified:      { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_catalog_error:              { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_catalog_empty:              { bg: "bg-yellow-500/10",  text: "text-yellow-600 dark:text-yellow-400",  dot: "bg-yellow-500" },
  edc_negotiation_error:          { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_negotiation_failed:         { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_transfer_error:             { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  edc_transfer_completed:         { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_handshake_complete:         { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400",dot: "bg-emerald-500" },
  edc_handshake_skipped:          { bg: "bg-yellow-500/10",  text: "text-yellow-600 dark:text-yellow-400",  dot: "bg-yellow-500" },
  aas_data_fetch:                 { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  aas_service_data_received:      { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  aas_product_model_received:     { bg: "bg-cyan-500/10",    text: "text-cyan-600 dark:text-cyan-400",      dot: "bg-cyan-500" },
  data_request_received:          { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",    dot: "bg-green-500" },
  data_response_sent:             { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",    dot: "bg-green-500" },
  dpp_data_returned:              { bg: "bg-green-500/10",   text: "text-green-600 dark:text-green-400",    dot: "bg-green-500" },
  lookup_error:                   { bg: "bg-red-500/10",     text: "text-red-600 dark:text-red-400",        dot: "bg-red-500" },
  maintenance_report_sent:        { bg: "bg-teal-500/10",    text: "text-teal-600 dark:text-teal-400",      dot: "bg-teal-500" },
  maintenance_report_created:     { bg: "bg-teal-500/10",    text: "text-teal-600 dark:text-teal-400",      dot: "bg-teal-500" },
};

const DEFAULT_COLOR = { bg: "bg-gray-500/10", text: "text-gray-600 dark:text-gray-400", dot: "bg-gray-500" };

function getColor(type: string) {
  return EVENT_COLORS[type] ?? DEFAULT_COLOR;
}

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleString(undefined, {
      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch { return ts; }
}

function Pagination({ page, setPage, total, pageSize }: {
  page: number;
  setPage: (p: number | ((prev: number) => number)) => void;
  total: number;
  pageSize: number;
}) {
  if (total <= pageSize) return null;
  const totalPages = Math.ceil(total / pageSize);

  const pageNumbers: (number | "ellipsis")[] = [];
  const visible = Array.from({ length: totalPages }, (_, i) => i)
    .filter((i) => i === 0 || i === totalPages - 1 || Math.abs(i - page) <= 2);
  for (let idx = 0; idx < visible.length; idx++) {
    if (idx > 0 && visible[idx] - visible[idx - 1] > 1) pageNumbers.push("ellipsis");
    pageNumbers.push(visible[idx]);
  }

  const btnBase = "flex h-8 w-8 items-center justify-center rounded-md border border-line bg-surface text-muted transition hover:bg-subtle disabled:opacity-30 disabled:cursor-not-allowed";

  return (
    <div className="mt-4 flex items-center justify-between">
      <p className="text-xs text-muted">
        Page {page + 1} of {totalPages}
      </p>
      <div className="flex items-center gap-1">
        <button onClick={() => setPage(0)} disabled={page === 0} className={btnBase} title="First page">
          <ChevronsLeft className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className={btnBase} title="Previous page">
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {pageNumbers.map((item, idx) =>
          item === "ellipsis" ? (
            <span key={`e-${idx}`} className="px-1 text-xs text-ghost">…</span>
          ) : (
            <button
              key={item}
              onClick={() => setPage(item)}
              className={`flex h-8 min-w-[2rem] items-center justify-center rounded-md border px-2 text-xs font-medium transition ${
                page === item
                  ? "border-red-500/50 bg-red-500/10 text-red-600 dark:text-red-400"
                  : "border-line bg-surface text-muted hover:bg-subtle"
              }`}
            >
              {item + 1}
            </button>
          )
        )}

        <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className={btnBase} title="Next page">
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setPage(totalPages - 1)} disabled={page >= totalPages - 1} className={btnBase} title="Last page">
          <ChevronsRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}

export default function EventLogPage() {
  const api = useApi();
  const router = useRouter();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [page, setPage] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [resetting, setResetting] = useState(false);
  const PAGE_SIZE = 50;

  const load = useCallback(async () => {
    try {
      const offset = page * PAGE_SIZE;
      const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });
      if (filterType !== "all") params.set("event_type", filterType);
      const raw = await api.get<{ events?: TraceEvent[]; total?: number } | TraceEvent[]>(`/traces?${params}`);
      if (Array.isArray(raw)) {
        setEvents(raw.map((e) => ({ ...e, payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload })));
        setTotalEvents(raw.length);
      } else {
        const list = raw.events ?? [];
        setEvents(list.map((e) => ({ ...e, payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload })));
        setTotalEvents(raw.total ?? list.length);
      }
    } catch {
      setEvents([]);
      setTotalEvents(0);
    } finally {
      setLoading(false);
    }
  }, [api, filterType, page]);

  const handleReset = useCallback(async () => {
    if (!confirm("Clear all events, agreements, and credential sessions?\n\nThis restarts EDC connectors and may take ~30 seconds.")) return;
    setResetting(true);
    try {
      await api.post("/reset", {});
      setPage(0);
      setFilterType("all");
      await load();
    } catch {
      alert("Reset failed — check that the backend is reachable.");
    } finally {
      setResetting(false);
    }
  }, [api, load]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(load, 5000);
    return () => clearInterval(interval);
  }, [autoRefresh, load]);

  const uniqueTypes = Array.from(new Set(events.map((e) => e.event_type))).sort();
  const traceGroups = new Map<string, string>();
  const traceColors = [
    "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#3b82f6",
    "#ef4444", "#8b5cf6", "#10b981", "#f97316", "#06b6d4",
  ];
  let colorIdx = 0;
  events.forEach((e) => {
    if (!traceGroups.has(e.trace_id)) {
      traceGroups.set(e.trace_id, traceColors[colorIdx % traceColors.length]);
      colorIdx++;
    }
  });

  return (
    <div className="animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
        <div>
          <h1 className="text-2xl font-extrabold text-on-page">Event Log</h1>
          <p className="mt-1 text-sm text-muted">
            {totalEvents} total events across {traceGroups.size} traces
            {totalEvents > PAGE_SIZE && ` · showing ${page * PAGE_SIZE + 1}–${Math.min((page + 1) * PAGE_SIZE, totalEvents)}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="relative">
            <button
              onClick={() => setFilterOpen((o) => !o)}
              className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-sm font-medium text-on-page transition hover:bg-subtle"
            >
              <Filter className="h-3.5 w-3.5 text-muted" />
              {filterType === "all" ? "All Events" : filterType}
              <ChevronDown className={`h-3.5 w-3.5 text-muted transition ${filterOpen ? "rotate-180" : ""}`} />
            </button>
            {filterOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setFilterOpen(false)} />
                <div className="absolute right-0 top-full z-50 mt-1 max-h-72 w-64 overflow-y-auto rounded-xl border border-line bg-surface py-1 shadow-xl">
                  <button
                    onClick={() => { setFilterType("all"); setPage(0); setFilterOpen(false); }}
                    className={`flex w-full items-center px-4 py-2.5 text-sm hover:bg-subtle ${filterType === "all" ? "font-bold text-red-600 dark:text-red-400" : "text-on-page"}`}
                  >
                    All Events
                  </button>
                  {uniqueTypes.map((t) => (
                    <button
                      key={t}
                      onClick={() => { setFilterType(t); setPage(0); setFilterOpen(false); }}
                      className={`flex w-full items-center gap-2 px-4 py-2.5 text-sm hover:bg-subtle ${filterType === t ? "font-bold text-red-600 dark:text-red-400" : "text-on-page"}`}
                    >
                      <span className={`h-2 w-2 rounded-full ${getColor(t).dot}`} />
                      {t}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Auto-refresh */}
          <button
            onClick={() => setAutoRefresh((a) => !a)}
            className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition ${
              autoRefresh
                ? "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400"
                : "border-line bg-surface text-muted hover:bg-subtle"
            }`}
          >
            <span className={`h-2 w-2 rounded-full ${autoRefresh ? "bg-red-500 animate-pulse-dot" : "bg-ghost"}`} />
            Live
          </button>

          <button
            onClick={() => { setLoading(true); load(); }}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-subtle hover:text-on-page disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>

          <button
            onClick={handleReset}
            disabled={resetting}
            className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-surface px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-50 dark:text-red-400"
            title="Clear all events and reset sessions"
          >
            <Trash2 className={`h-3.5 w-3.5 ${resetting ? "animate-spin" : ""}`} />
            {resetting ? "Clearing…" : "Clear"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-20">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: ACCENT }} />
            <span className="text-sm text-muted">Loading events…</span>
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-subtle">
              <Activity className="h-7 w-7 text-ghost" />
            </div>
            <p className="text-lg font-semibold text-on-page">No trace events yet</p>
            <p className="mt-1 text-sm text-muted">Perform a lookup in the Repair Shop to generate events</p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line bg-subtle/40 text-left text-xs font-bold uppercase tracking-wider text-muted">
                    <th className="px-5 py-3.5">Time</th>
                    <th className="px-5 py-3.5">Event Type</th>
                    <th className="px-5 py-3.5">Source</th>
                    <th className="px-5 py-3.5">Serial</th>
                    <th className="px-5 py-3.5">Trace</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => {
                    const color = getColor(event.event_type);
                    const traceColor = traceGroups.get(event.trace_id) ?? "#999";
                    return (
                      <tr
                        key={event.id}
                        onClick={() => router.push(`/trace/${event.trace_id}`)}
                        className="cursor-pointer border-b border-line-subtle transition hover:bg-subtle/40"
                      >
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-ghost">
                          {formatTime(event.timestamp)}
                        </td>
                        <td className="px-5 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${color.bg} ${color.text}`}>
                            <span className={`h-1.5 w-1.5 rounded-full ${color.dot}`} />
                            {event.event_type}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 text-xs text-muted">
                          {event.source}
                        </td>
                        <td className="whitespace-nowrap px-5 py-3.5 font-mono text-xs text-muted">
                          {event.serial_number ?? "—"}
                        </td>
                        <td className="px-5 py-3.5">
                          <span
                            className="inline-block rounded px-2 py-0.5 font-mono text-[11px] font-bold text-white"
                            style={{ backgroundColor: traceColor }}
                          >
                            {event.trace_id.slice(0, 8)}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <Pagination page={page} setPage={setPage} total={totalEvents} pageSize={PAGE_SIZE} />
          </>
        )}
      </div>
    </div>
  );
}
