"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  RefreshCcw, Loader2, ShieldCheck, ShieldX,
  FileText, Lock, Handshake, Fingerprint, Globe, ChevronDown, ChevronRight,
  Clock, CheckCircle2, AlertTriangle, Timer, Zap,
} from "lucide-react";
import { useApi } from "@hanover/ui";

const ACCENT = "#E30613";
const GREEN = "#059669";
const ORANGE = "#ea580c";
const BLUE = "#3b82f6";

interface Constraint {
  left: string;
  op: string;
  right: string;
}

interface Policy {
  id: string;
  constraints: Constraint[];
  gaiax_required: boolean;
}

interface Asset {
  id: string;
  description: string;
}

interface ContractDef {
  id: string;
  access_policy_id: string;
  contract_policy_id: string;
}

interface Agreement {
  id: string;
  provider_id: string;
  consumer_id: string;
  consumer_name: string;
  consumer_did: string;
  consumer_country: string;
  asset_id: string;
  signed_at: number | null;
}

interface Identity {
  did: string;
  legal_name: string;
  country: string;
  type: string;
  did_document: Record<string, unknown>;
  participant_json: Record<string, unknown>;
}

interface CredentialStatus {
  active: boolean;
  status: string;
  message: string;
  expired?: boolean;
  remaining_seconds?: number | null;
  agreement_id?: string;
  asset_id?: string;
  negotiation_id?: string;
  edr_endpoint?: string;
  edr_obtained_at?: number;
  edr_obtained_at_iso?: string;
  edr_expires_at?: number | null;
  edr_expires_at_iso?: string | null;
  gaiax_verified?: boolean;
  gaiax_verified_at?: number;
  gaiax_verified_at_iso?: string;
  elapsed_seconds?: number;
}

interface Provider {
  name: string;
  role?: string;
  reachable: boolean;
  identity: Identity;
  assets: Asset[];
  policies: Policy[];
  contract_definitions: ContractDef[];
  agreements: Agreement[];
  credential_status?: CredentialStatus | null;
}

type AccessData = { providers: Record<string, Provider> };

export default function AccessControlPage() {
  const api = useApi();
  const [data, setData] = useState<Record<string, Provider> | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const load = useCallback(async (background = false) => {
    if (!background) setLoading(true);
    try {
      const raw = await api.get<AccessData>("/access-matrix");
      setData(raw.providers);
    } catch {
      if (!background) setData(null);
    } finally {
      setLoading(false);
    }
  }, [api]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => load(true), 5000);
    return () => clearInterval(id);
  }, [autoRefresh, load]);

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between border-b border-line bg-surface px-6 py-5">
        <div>
          <h1 className="text-2xl font-extrabold text-on-page">Access Control</h1>
          <p className="mt-1 text-sm text-muted">
            Gaia-X identity, credential sessions, and EDC connector status for each dataspace participant
          </p>
        </div>
        <div className="flex items-center gap-2">
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
            onClick={() => load()}
            disabled={loading}
            className="flex h-10 w-10 items-center justify-center rounded-lg border border-line bg-surface text-muted transition hover:bg-subtle hover:text-on-page disabled:opacity-50"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2.5 py-20">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: ACCENT }} />
            <span className="text-sm text-muted">Querying EDC connectors…</span>
          </div>
        ) : !data || Object.keys(data).length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <ShieldX className="mb-4 h-12 w-12 text-ghost" />
            <p className="text-lg font-semibold text-on-page">No data providers found</p>
            <p className="mt-1 text-sm text-muted">EDC connectors may be unreachable or have no assets registered</p>
          </div>
        ) : (
          <div className="space-y-8">
            {(() => {
              const consumerStatus = Object.values(data).find((p) => p.role === "consumer")?.credential_status;
              const activeAgreementId = consumerStatus?.active ? consumerStatus.agreement_id ?? null : null;
              return Object.entries(data).map(([pid, provider]) => (
                <ProviderCard key={pid} pid={pid} provider={provider} activeAgreementId={activeAgreementId} />
              ));
            })()}
          </div>
        )}
      </div>
    </div>
  );
}

function ProviderCard({ pid, provider, activeAgreementId }: { pid: string; provider: Provider; activeAgreementId: string | null }) {
  const hasGaiax = provider.policies.some((p) => p.gaiax_required);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      {/* Provider header */}
      <div className="flex items-center gap-4 border-b border-line bg-subtle/40 px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg text-white" style={{ background: pid === "repair_shop" ? `linear-gradient(135deg, ${BLUE}, #1d4ed8)` : `linear-gradient(135deg, ${ACCENT}, #b91c1c)` }}>
          <Fingerprint className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-on-page">{provider.name}</h2>
            {provider.role === "consumer" && (
              <span className="rounded-md bg-blue-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-400">
                Consumer
              </span>
            )}
            {provider.role === "provider" && (
              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${ACCENT}15`, color: ACCENT }}>
                Provider
              </span>
            )}
          </div>
          {provider.identity.did && (
            <p className="mt-0.5 truncate font-mono text-xs text-muted">{provider.identity.did}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {hasGaiax ? (
            <span className="flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Gaia-X Enforced
            </span>
          ) : provider.role === "consumer" ? (
            <span className="flex items-center gap-1.5 rounded-md bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-3.5 w-3.5" /> Gaia-X Verified
            </span>
          ) : (
            <span className="flex items-center gap-1.5 rounded-md bg-gray-500/10 px-2.5 py-1 text-xs font-semibold text-gray-500">
              Open Policy
            </span>
          )}
          <span className={`h-2 w-2 rounded-full ${provider.reachable ? "bg-emerald-500" : "bg-red-500"}`} />
        </div>
      </div>

      <div className="divide-y divide-line-subtle">
        {/* Credential Status */}
        {provider.credential_status && (
          <CredentialStatusSection
            status={provider.credential_status}
            role={provider.role}
          />
        )}

        {/* Identity section */}
        <IdentitySection identity={provider.identity} />

        {/* Assets & ODRL Policies */}
        <div className="grid gap-0 divide-y divide-line-subtle lg:grid-cols-2 lg:divide-x lg:divide-y-0">
          <div className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
              <FileText className="h-3.5 w-3.5" /> Registered Assets
            </h3>
            {provider.assets.length === 0 ? (
              <p className="text-xs text-ghost">
                {provider.role === "consumer"
                  ? "No assets on this connector — it consumes datasets published by Atomic."
                  : "No assets registered"}
              </p>
            ) : (
              <div className="space-y-2">
                {provider.assets.map((a) => (
                  <div key={a.id} className="rounded-lg bg-subtle/50 px-3 py-2">
                    <p className="truncate font-mono text-xs font-semibold text-on-page">{a.id}</p>
                    {a.description && <p className="mt-0.5 text-xs text-muted">{a.description}</p>}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="p-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
              <Lock className="h-3.5 w-3.5" /> ODRL Access Policies
            </h3>
            {provider.policies.length === 0 ? (
              <p className="text-xs text-ghost">
                {provider.role === "consumer" ? "Policies are defined on the Atomic provider connector." : "No policies configured"}
              </p>
            ) : (
              <div className="space-y-2">
                {provider.policies.map((p) => (
                  <div key={p.id} className="rounded-lg border border-line-subtle bg-surface px-3 py-2">
                    <div className="flex items-center gap-2">
                      <Lock className="h-3 w-3 text-muted" />
                      <p className="truncate font-mono text-xs font-semibold text-on-page">{p.id}</p>
                      {p.gaiax_required && (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Gaia-X
                        </span>
                      )}
                    </div>
                    {p.constraints.length > 0 && (
                      <div className="mt-1.5 space-y-1">
                        {p.constraints.map((c, i) => (
                          <p key={i} className="font-mono text-[11px] text-muted">
                            <span className="text-indigo-500">{c.left}</span>{" "}
                            <span className="text-ghost">{c.op}</span>{" "}
                            <span className="text-emerald-500">{c.right}</span>
                          </p>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Consumers with Access */}
        <div className="p-5">
          <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
            <Handshake className="h-3.5 w-3.5" /> {provider.role === "consumer" ? "Agreements (this connector as consumer)" : "Consumers with Access"}
          </h3>
          {provider.agreements.length === 0 ? (
            <p className="text-xs text-ghost">
              {provider.role === "consumer"
                ? "No agreements stored on this view — successful lookups create agreements on the Atomic provider connector."
                : "No active agreements — no consumer has been granted access"}
            </p>
          ) : (
            <div className="space-y-3">
              {[...provider.agreements]
                .sort((a, b) => (b.signed_at ?? 0) - (a.signed_at ?? 0))
                .map((ag) => {
                const isActiveAgreement = activeAgreementId !== null && activeAgreementId === ag.id;
                const isExpiredAgreement = !isActiveAgreement && activeAgreementId !== null;

                return (
                  <div
                    key={ag.id}
                    className={`rounded-lg border px-4 py-3 transition-colors ${
                      isActiveAgreement
                        ? "border-emerald-500/40 bg-emerald-500/[0.03]"
                        : isExpiredAgreement
                          ? "border-red-500/20 bg-red-500/[0.02] opacity-60"
                          : "border-line-subtle bg-surface"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                        isActiveAgreement
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : isExpiredAgreement
                            ? "bg-red-500/10 text-red-500"
                            : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}>
                        {isActiveAgreement ? <Zap className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-on-page text-sm">{ag.consumer_name}</p>
                          {isActiveAgreement && (
                            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
                              </span>
                              Active
                            </span>
                          )}
                          {isExpiredAgreement && (
                            <span className="rounded-md bg-red-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-red-500">
                              Expired
                            </span>
                          )}
                        </div>
                        {ag.consumer_did && (
                          <p className="truncate font-mono text-[11px] text-muted">{ag.consumer_did}</p>
                        )}
                      </div>
                      {ag.consumer_country && (
                        <span className="rounded bg-subtle px-2 py-0.5 text-xs font-medium text-muted">
                          {ag.consumer_country}
                        </span>
                      )}
                    </div>
                    <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted sm:grid-cols-4">
                      <div>
                        <span className="text-ghost">Asset</span>
                        <p className="truncate font-mono font-medium text-on-surface">{ag.asset_id}</p>
                      </div>
                      <div>
                        <span className="text-ghost">Agreement</span>
                        <p className="truncate font-mono font-medium text-on-surface">{ag.id.slice(0, 12)}…</p>
                      </div>
                      <div>
                        <span className="text-ghost">Provider</span>
                        <p className="font-medium text-on-surface">{ag.provider_id}</p>
                      </div>
                      <div>
                        <span className="text-ghost">Signed</span>
                        <p className="font-medium text-on-surface">
                          {ag.signed_at ? new Date(ag.signed_at * 1000).toLocaleString() : "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CredentialStatusSection({ status: initialStatus, role }: { status: CredentialStatus; role?: string }) {
  const isConsumer = role === "consumer";
  const noSession = initialStatus.status === "no_session";
  const alwaysVerify = initialStatus.status === "always_verify";

  const [remaining, setRemaining] = useState<number | null>(() => {
    if (initialStatus.edr_expires_at) {
      return Math.max(0, initialStatus.edr_expires_at - Math.floor(Date.now() / 1000));
    }
    return initialStatus.remaining_seconds ?? null;
  });

  const expiresAtRef = useRef(initialStatus.edr_expires_at);
  const obtainedAtRef = useRef(initialStatus.edr_obtained_at);

  useEffect(() => {
    expiresAtRef.current = initialStatus.edr_expires_at;
    obtainedAtRef.current = initialStatus.edr_obtained_at;
    if (initialStatus.edr_expires_at) {
      setRemaining(Math.max(0, initialStatus.edr_expires_at - Math.floor(Date.now() / 1000)));
    } else {
      setRemaining(initialStatus.remaining_seconds ?? null);
    }
  }, [initialStatus.edr_expires_at, initialStatus.edr_obtained_at, initialStatus.remaining_seconds]);

  useEffect(() => {
    if (!expiresAtRef.current || noSession || alwaysVerify) return;
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, (expiresAtRef.current ?? now) - now));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [noSession, alwaysVerify]);

  const liveExpired = remaining !== null && remaining <= 0;
  const isActive = !liveExpired && initialStatus.active && initialStatus.status === "active";
  const isExpired = liveExpired || initialStatus.expired === true || initialStatus.status === "expired";

  const statusColor = isActive ? GREEN : isExpired ? ACCENT : alwaysVerify ? ORANGE : "#6b7280";
  const StatusIcon = isActive ? CheckCircle2 : isExpired ? AlertTriangle : alwaysVerify ? ShieldCheck : Clock;

  const totalLifetime = (obtainedAtRef.current && expiresAtRef.current)
    ? expiresAtRef.current - obtainedAtRef.current
    : 0;

  function formatTime(iso?: string | null) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleString();
    } catch {
      return iso;
    }
  }

  function formatDuration(seconds?: number | null) {
    if (seconds == null || seconds <= 0) return "Expired";
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
  }

  const liveMessage = isActive
    ? initialStatus.message
    : isExpired
      ? "EDR token has expired — next lookup will trigger Gaia-X re-verification"
      : initialStatus.message;

  return (
    <div className="p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
        <ShieldCheck className="h-3.5 w-3.5" /> Credential Session
      </h3>

      <div className="rounded-xl border bg-surface p-4" style={{ borderColor: `${statusColor}40` }}>
        {/* Status header */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${statusColor}15` }}>
            <StatusIcon className="h-4.5 w-4.5" style={{ color: statusColor }} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide" style={{ backgroundColor: `${statusColor}15`, color: statusColor }}>
                {isActive ? "Active" : isExpired ? "Expired" : noSession ? "No Session" : alwaysVerify ? "Always Verify" : initialStatus.status}
              </span>
              {isConsumer && isActive && remaining != null && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <Timer className="h-3 w-3" />
                  {formatDuration(remaining)} remaining
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-muted">{liveMessage}</p>
          </div>
        </div>

        {/* Consumer: detailed session info */}
        {isConsumer && !noSession && !alwaysVerify && (
          <div className="mt-4 space-y-3">
            {/* Progress bar for remaining time (only if expiry is known) */}
            {!isExpired && obtainedAtRef.current && expiresAtRef.current && remaining != null && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-ghost">
                  <span>EDR Token Lifetime</span>
                  <span>{formatDuration(remaining)}</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div
                    className="h-full rounded-full transition-all duration-1000 ease-linear"
                    style={{
                      backgroundColor: statusColor,
                      width: `${Math.max(0, Math.min(100, totalLifetime > 0 ? (remaining / totalLifetime) * 100 : 0))}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {isExpired && obtainedAtRef.current && expiresAtRef.current && (
              <div>
                <div className="mb-1 flex items-center justify-between text-[11px] text-ghost">
                  <span>EDR Token Lifetime</span>
                  <span style={{ color: ACCENT }}>Expired</span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-subtle">
                  <div className="h-full w-0 rounded-full" />
                </div>
              </div>
            )}

            {/* Active time indicator when no expiry is set */}
            {isActive && !expiresAtRef.current && initialStatus.elapsed_seconds != null && (
              <div className="flex items-center gap-2 text-[11px] text-muted">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-75" style={{ backgroundColor: GREEN }} />
                  <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: GREEN }} />
                </span>
                Active for {formatDuration(initialStatus.elapsed_seconds)}
                <span className="text-ghost">— token validated per request by the provider data plane</span>
              </div>
            )}

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-[11px] text-ghost">Gaia-X Verified</span>
                <p className="flex items-center gap-1 text-xs font-semibold" style={{ color: initialStatus.gaiax_verified ? GREEN : ACCENT }}>
                  {initialStatus.gaiax_verified ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                  {initialStatus.gaiax_verified ? "Yes" : "No"}
                </p>
                {initialStatus.gaiax_verified_at_iso && (
                  <p className="mt-0.5 text-[10px] text-ghost">{formatTime(initialStatus.gaiax_verified_at_iso)}</p>
                )}
              </div>
              <div>
                <span className="text-[11px] text-ghost">EDR Obtained</span>
                <p className="text-xs font-medium text-on-surface">{formatTime(initialStatus.edr_obtained_at_iso)}</p>
              </div>
              <div>
                <span className="text-[11px] text-ghost">EDR Expires</span>
                <p className="text-xs font-medium" style={{ color: isExpired ? ACCENT : undefined }}>
                  {initialStatus.edr_expires_at_iso ? formatTime(initialStatus.edr_expires_at_iso) : (
                    <span className="text-muted">No expiry — validated per request</span>
                  )}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-ghost">Agreement</span>
                <p className="truncate font-mono text-xs font-medium text-on-surface">
                  {initialStatus.agreement_id ? `${initialStatus.agreement_id.slice(0, 16)}…` : "—"}
                </p>
              </div>
            </div>

            {initialStatus.edr_endpoint && (
              <div>
                <span className="text-[11px] text-ghost">Data Plane Endpoint</span>
                <p className="truncate font-mono text-[11px] text-muted">{initialStatus.edr_endpoint}</p>
              </div>
            )}

            {/* Explanation */}
            <div className="rounded-lg bg-subtle/50 px-3 py-2.5 text-xs text-muted">
              {isActive ? (
                <>
                  <strong className="text-on-surface">Cached session:</strong> Gaia-X verification was performed when this EDR was first negotiated.
                  Subsequent lookups reuse this token without re-verification.
                  {expiresAtRef.current
                    ? " When the token expires, the next lookup will trigger a full Gaia-X re-verification automatically."
                    : " The provider data plane validates the token on each request. If the provider invalidates the agreement, the next lookup will trigger a full Gaia-X re-verification automatically."
                  }
                </>
              ) : isExpired ? (
                <>
                  <strong style={{ color: ACCENT }}>Session expired:</strong> The EDR token is no longer valid.
                  The next passport lookup will automatically trigger a new contract negotiation with fresh Gaia-X credential verification.
                </>
              ) : null}
            </div>
          </div>
        )}

        {/* Provider: always verify explanation */}
        {alwaysVerify && (
          <div className="mt-3 rounded-lg bg-subtle/50 px-3 py-2.5 text-xs text-muted">
            <strong className="text-on-surface">Provider policy:</strong> This connector&apos;s ODRL policy requires{" "}
            <code className="rounded bg-surface px-1 py-0.5 font-mono text-[11px]">gaiaxCompliant = true</code>.
            Every new contract negotiation triggers the provider&apos;s control plane to verify the consumer&apos;s Verifiable Presentation (VP-JWT)
            against the Gaia-X compliance service. There is no caching on the provider side — trust is re-evaluated for each new agreement.
          </div>
        )}
      </div>
    </div>
  );
}

function IdentitySection({ identity }: { identity: Identity }) {
  const [expandDid, setExpandDid] = useState(false);
  const [expandParticipant, setExpandParticipant] = useState(false);
  const hasDid = identity.did_document && Object.keys(identity.did_document).length > 0;
  const hasPart = identity.participant_json && Object.keys(identity.participant_json).length > 0;

  if (!identity.did && !hasDid && !hasPart) return null;

  return (
    <div className="p-5">
      <h3 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-muted">
        <Fingerprint className="h-3.5 w-3.5" /> Gaia-X Identity
      </h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <span className="text-[11px] text-ghost">Legal Name</span>
          <p className="font-semibold text-on-page text-sm">{identity.legal_name || "—"}</p>
        </div>
        <div>
          <span className="text-[11px] text-ghost">Country</span>
          <p className="font-semibold text-on-page text-sm">{identity.country || "—"}</p>
        </div>
        <div>
          <span className="text-[11px] text-ghost">Type</span>
          <p className="font-semibold text-on-page text-sm">{identity.type || "—"}</p>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {hasDid && (
          <CollapsibleJson
            label="did.json"
            sublabel={identity.did}
            expanded={expandDid}
            onToggle={() => setExpandDid(!expandDid)}
            data={identity.did_document}
          />
        )}
        {hasPart && (
          <CollapsibleJson
            label="participant.json"
            sublabel={identity.type}
            expanded={expandParticipant}
            onToggle={() => setExpandParticipant(!expandParticipant)}
            data={identity.participant_json}
          />
        )}
      </div>
    </div>
  );
}

function CollapsibleJson({
  label, sublabel, expanded, onToggle, data,
}: {
  label: string; sublabel?: string; expanded: boolean; onToggle: () => void; data: Record<string, unknown>;
}) {
  const Chevron = expanded ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-lg border border-line-subtle bg-subtle/30">
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs transition hover:bg-subtle/60"
      >
        <Chevron className="h-3.5 w-3.5 text-muted" />
        <span className="font-bold text-on-page">{label}</span>
        {sublabel && <span className="truncate font-mono text-[11px] text-muted">{sublabel}</span>}
      </button>
      {expanded && (
        <pre className="max-h-64 overflow-auto border-t border-line-subtle px-4 py-3 font-mono text-[11px] leading-relaxed text-muted">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
