"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Loader2, ChevronDown, ChevronUp, Clock, Layers } from "lucide-react";
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

/** Timeline / badge color follows event semantics (not ingest `source`). */
function getEventTypeColor(eventType: string): string {
  if (eventType === "lookup_error" || eventType === "edc_transfer_failed" || eventType === "edc_negotiation_timeout" || eventType === "edc_data_plane_error") return "#ef4444";
  if (eventType.startsWith("gaiax_")) return "#ea580c";
  if (eventType.startsWith("edc_")) return "#6366f1";
  if (eventType === "qr_scanned") return "#3b82f6";
  if (eventType.startsWith("aas_")) return "#0891b2";
  if (eventType.startsWith("data_") || eventType.includes("dpp")) return "#059669";
  if (eventType === "maintenance_report_sent" || eventType === "maintenance_report_created") return "#14b8a6";
  return "#6b7280";
}

const CATEGORY_LEGEND: { prefix: string; label: string; color: string }[] = [
  { prefix: "edc_", label: "EDC (catalog, contract, transfer, data plane)", color: "#6366f1" },
  { prefix: "gaiax_", label: "Gaia-X compliance & credentials", color: "#ea580c" },
  { prefix: "aas_", label: "AAS / PASSAT (product data, grinding parameters)", color: "#0891b2" },
  { prefix: "dpp", label: "Passport / DPP API", color: "#059669" },
  { prefix: "data_", label: "DPP data path", color: "#059669" },
  { prefix: "qr_", label: "Repair app entry", color: "#3b82f6" },
];

const EVENT_LABELS: Record<string, string> = {
  qr_scanned: "QR Code Scanned",
  edc_catalog_query: "EDC → Catalog Request",
  edc_catalog_received: "EDC ← Catalog Response",
  edc_contract_negotiation: "EDC → Contract Negotiation",
  edc_agreement_reached: "EDC ← Contract Agreement Finalized",
  edc_negotiation_timeout: "EDC Negotiation Timeout",
  edc_negotiation_requested: "EDC CP ← Negotiation Request Received",
  edc_negotiation_accepted: "EDC CP → Negotiation Accepted",
  edc_negotiation_agreed: "EDC CP ← Agreement Reached",
  edc_negotiation_finalized: "EDC CP → Negotiation Finalized",
  edc_negotiation_terminated: "EDC CP ✕ Negotiation Terminated",
  edc_did_resolution: "DID Resolution: /.well-known/did.json",
  edc_transfer_started: "EDC → Data Transfer Initiated",
  edc_edr_received: "EDC ← Endpoint Data Reference",
  edc_data_plane_fetch: "EDC Data Plane → Fetch Passport",
  edc_data_plane_received: "EDC Data Plane ← Passport Received",
  edc_data_plane_error: "EDC Data Plane Error",
  edc_negotiation_reused: "EDC → Reusing Cached Agreement",
  edc_transfer_failed: "EDC Transfer Failed",
  edc_transfer_process_started: "EDC CP → Transfer Process Started",
  edc_transfer_process_completed: "EDC CP ← Transfer Process Completed",
  edc_transfer_process_terminated: "EDC CP ✕ Transfer Process Terminated",
  gaiax_edc_policy_evaluation: "EDC Policy: Gaia-X Constraint Check",
  gaiax_vc_generation: "Gaia-X: Generating Verifiable Credentials",
  gaiax_vp_creation: "Gaia-X: Creating Verifiable Presentation",
  gaiax_compliance_submission: "Gaia-X → Submitting VP to Compliance Service",
  gaiax_compliance_verified: "Gaia-X ← Compliance Verified",
  gaiax_compliance_rejected: "Gaia-X ← Compliance Rejected",
  gaiax_compliance_error: "Gaia-X Compliance Error",
  gaiax_credential_verified: "Gaia-X Credential Verified",
  gaiax_verify_credential_request: "Gaia-X Credential Verification Request",
  gaiax_compliance_db_lookup: "Gaia-X Compliance Registry Lookup",
  gaiax_verify_success: "Gaia-X Verification Passed",
  gaiax_verify_failed: "Gaia-X Verification Failed",
  edc_catalog_error: "EDC Catalog Request Error",
  edc_catalog_empty: "EDC Catalog — No Valid Offer",
  edc_negotiation_error: "EDC Negotiation Error",
  edc_negotiation_failed: "EDC Negotiation Failed",
  edc_transfer_error: "EDC Transfer Error",
  edc_transfer_completed: "EDC ← Transfer Completed",
  edc_handshake_complete: "EDC Handshake Complete — Trust Established",
  edc_handshake_skipped: "EDC Handshake Skipped — Direct Access",
  aas_data_fetch: "AAS → Invoking Product Data Operation",
  aas_service_data_received: "AAS ← Grinding Parameters Received",
  aas_product_model_received: "AAS ← Product Model & Item Data",
  data_request_received: "DPP API ← Data Request Received",
  data_response_sent: "DPP API → Passport Data Returned",
  dpp_data_returned: "Data Returned — Digital Product Passport",
  lookup_error: "Lookup Error",
  maintenance_report_sent: "Maintenance Report Sent",
  maintenance_report_created: "Maintenance Report Created",
};

function formatTime(ts: string) {
  try {
    return new Date(ts).toLocaleTimeString(undefined, {
      hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3,
    });
  } catch { return ts; }
}

const HIDDEN_PAYLOAD_KEYS = new Set(["message"]);

function PayloadValue({ value }: { value: unknown }) {
  if (value === null || value === undefined) return <span className="text-ghost">—</span>;
  if (typeof value === "boolean") return <span className={value ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-red-600 dark:text-red-400 font-semibold"}>{String(value)}</span>;
  if (typeof value === "number") return <span className="font-mono font-semibold text-on-surface">{value}</span>;
  if (typeof value === "object") return <span className="font-mono text-muted">{JSON.stringify(value)}</span>;
  const s = String(value);
  if (s.startsWith("http://") || s.startsWith("https://") || s.startsWith("did:")) return <span className="font-mono break-all text-muted">{s}</span>;
  return <span className="text-on-surface">{s}</span>;
}

function ExpandedPanel({ event, offsetMs, color }: { event: TraceEvent; offsetMs: number; color: string }) {
  const payload = (event.payload ?? {}) as Record<string, unknown>;
  const message = typeof payload.message === "string" ? payload.message : null;

  const dataKeys = Object.keys(payload).filter((k) => !HIDDEN_PAYLOAD_KEYS.has(k));

  return (
    <div className="animate-fade-in border-b border-line-subtle px-12 py-5">
      {message && (
        <div className="mb-4 flex items-start gap-2.5 rounded-lg border-l-4 px-4 py-3 text-sm leading-relaxed text-on-surface" style={{ borderColor: color, backgroundColor: `${color}08` }}>
          <span>{message}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Event type</p>
          <p className="mt-1 font-mono font-semibold text-on-surface">{event.event_type}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Reporter (ingest)</p>
          <p className="mt-1 font-semibold text-on-surface">{event.source.replace(/_/g, " ")}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Participant</p>
          <p className="mt-1 font-semibold text-on-surface">{event.participant_id ?? "—"}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Timestamp</p>
          <p className="mt-1 font-mono font-semibold text-on-surface">{formatTime(event.timestamp)}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Span ID</p>
          <p className="mt-1 font-mono text-muted">{event.span_id.slice(0, 16)}…</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Parent Span</p>
          <p className="mt-1 font-mono text-muted">{event.parent_span_id?.slice(0, 16) ?? "root"}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Serial</p>
          <p className="mt-1 font-mono text-muted">{event.serial_number ?? "—"}</p>
        </div>
        <div>
          <p className="font-bold uppercase tracking-widest text-ghost">Offset</p>
          <p className="mt-1 font-mono text-muted">+{offsetMs}ms from start</p>
        </div>
      </div>

      {dataKeys.length > 0 && (
        <div className="mt-5">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-ghost">Transferred data</p>
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-xs">
              <tbody>
                {dataKeys.map((key) => {
                  const val = payload[key];
                  const isNested = typeof val === "object" && val !== null && !Array.isArray(val);
                  return isNested ? (
                    <>
                      <tr key={key} className="border-b border-line-subtle bg-subtle/30">
                        <td colSpan={2} className="px-4 py-2 font-bold text-on-surface">{key}</td>
                      </tr>
                      {Object.entries(val as Record<string, unknown>).map(([subKey, subVal]) => (
                        <tr key={`${key}.${subKey}`} className="border-b border-line-subtle last:border-0">
                          <td className="w-1/3 px-4 py-2 pl-8 font-mono text-ghost">{subKey}</td>
                          <td className="px-4 py-2"><PayloadValue value={subVal} /></td>
                        </tr>
                      ))}
                    </>
                  ) : (
                    <tr key={key} className="border-b border-line-subtle last:border-0">
                      <td className="w-1/3 px-4 py-2 font-mono text-ghost">{key}</td>
                      <td className="px-4 py-2"><PayloadValue value={val} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TraceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const [events, setEvents] = useState<TraceEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ events?: TraceEvent[] } | TraceEvent[]>(`/traces/${id}`)
      .then((raw) => {
        const list = Array.isArray(raw) ? raw : (raw as { events?: TraceEvent[] }).events ?? [];
        setEvents(list.map((e) => ({
          ...e,
          payload: typeof e.payload === "string" ? JSON.parse(e.payload) : e.payload,
        })));
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [api, id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2.5 py-24">
        <Loader2 className="h-5 w-5 animate-spin" style={{ color: ACCENT }} />
        <span className="text-sm text-muted">Loading trace…</span>
      </div>
    );
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  const firstTs = sorted.length > 0 ? new Date(sorted[0].timestamp).getTime() : 0;
  const lastTs = sorted.length > 0 ? new Date(sorted[sorted.length - 1].timestamp).getTime() : 0;
  const totalMs = Math.max(lastTs - firstTs, 1);
  const serial = sorted.find((e) => e.serial_number)?.serial_number ?? "—";

  return (
    <div className="animate-fade-in">
      <div className="border-b border-line bg-surface px-6 py-5">
        <button
          onClick={() => router.push("/")}
          className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-on-page"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Event Log
        </button>
        <div className="flex items-center gap-6">
          <div>
            <h1 className="text-2xl font-extrabold text-on-page">Trace Waterfall</h1>
            <p className="mt-0.5 font-mono text-xs text-ghost">{id}</p>
          </div>
          <div className="flex items-center gap-5 text-sm text-muted">
            <div className="flex items-center gap-1.5">
              <Layers className="h-4 w-4" />
              {sorted.length} spans
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="h-4 w-4" />
              {totalMs}ms total
            </div>
            <div className="rounded-md bg-subtle px-2.5 py-1 font-mono text-xs">
              SN: {serial}
            </div>
          </div>
        </div>

        <p className="mt-3 max-w-3xl text-xs text-muted">
          Rows follow <strong className="text-on-page">time</strong>. The primary column is <strong className="text-on-page">event_type</strong> (what happened).{" "}
          <span className="text-ghost">Reporter</span> (which service posted the span) is only in the expanded panel — use the type prefix (<span className="font-mono">edc_</span>, <span className="font-mono">gaiax_</span>, …) to see where in the stack the step belongs.
        </p>

        <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
          {CATEGORY_LEGEND.map((c) => (
            <div key={c.label} className="flex items-center gap-2 text-xs text-muted">
              <span className="h-3 w-3 shrink-0 rounded" style={{ backgroundColor: c.color }} />
              <span>{c.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="p-6">
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <p className="text-lg font-semibold text-on-page">No events found for this trace</p>
            <p className="mt-1 text-sm text-muted">The trace may have been purged or the ID is invalid</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-line">
            <div className="flex items-center border-b border-line bg-subtle/40 px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-muted">
              <span className="w-8 shrink-0 text-center">#</span>
              <span className="min-w-0 flex-[1.1] px-2">Event type</span>
              <span className="hidden min-w-0 flex-1 px-2 sm:block">Summary</span>
              <span className="min-w-0 flex-1 px-2">Timeline</span>
              <span className="w-20 shrink-0 px-2 text-right">Offset</span>
              <span className="w-8 shrink-0" />
            </div>

            {sorted.map((event, idx) => {
              const offsetMs = new Date(event.timestamp).getTime() - firstTs;
              const leftPct = (offsetMs / totalMs) * 100;
              const widthPct = Math.max(100 - leftPct, 3);
              const color = getEventTypeColor(event.event_type);
              const isExpanded = expandedId === event.id;
              const label = EVENT_LABELS[event.event_type] ?? event.event_type;

              return (
                <div key={event.id} className={isExpanded ? "bg-subtle/30" : ""}>
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : event.id)}
                    className="flex w-full items-center px-4 py-3 text-left transition hover:bg-subtle/40 border-b border-line-subtle"
                  >
                    <span className="w-8 shrink-0 text-center font-mono text-xs text-ghost">
                      {idx + 1}
                    </span>

                    <div className="min-w-0 flex-[1.1] px-2">
                      <span
                        className="inline-block max-w-full truncate rounded px-2 py-0.5 font-mono text-[11px] font-bold text-white"
                        style={{ backgroundColor: color }}
                        title={event.event_type}
                      >
                        {event.event_type}
                      </span>
                      <p className="mt-1 truncate text-xs text-muted sm:hidden">{label}</p>
                    </div>

                    <div className="hidden min-w-0 flex-1 px-2 sm:block">
                      <p className="truncate text-sm font-medium text-on-surface">{label}</p>
                      {(() => {
                        const msg = event.payload?.message;
                        return msg ? <p className="mt-0.5 truncate text-[11px] text-ghost">{String(msg)}</p> : null;
                      })()}
                    </div>

                    <div className="min-w-0 flex-1 px-2">
                      <div className="relative h-7 w-full rounded bg-subtle/50">
                        <div
                          className="absolute top-0.5 bottom-0.5 rounded"
                          style={{
                            left: `${leftPct}%`,
                            width: `${widthPct}%`,
                            backgroundColor: `${color}25`,
                            borderLeft: `3px solid ${color}`,
                          }}
                        />
                      </div>
                    </div>

                    <span className="w-20 shrink-0 px-2 text-right font-mono text-xs text-ghost">
                      +{offsetMs}ms
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-8 shrink-0 h-4 text-ghost" />
                    ) : (
                      <ChevronDown className="w-8 shrink-0 h-4 text-ghost" />
                    )}
                  </button>

                  {isExpanded && (
                    <ExpandedPanel event={event} offsetMs={offsetMs} color={color} />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
