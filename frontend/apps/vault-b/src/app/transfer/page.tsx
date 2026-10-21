"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2, X, CheckCircle2 } from "lucide-react";
import { useApi, useAuth, useI18n } from "@hanover/ui";

const ACCENT = "#7c3aed";

interface Transfer {
  id: string;
  ski_id: string;
  ski_model: string;
  from_participant: string;
  to_participant: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  accepted: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected: "bg-red-500/15 text-red-500 dark:text-red-400",
};

export default function TransferPage() {
  const api = useApi();
  const auth = useAuth();
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  async function loadTransfers() {
    setLoading(true);
    try {
      const data = await api.get<Transfer[]>(`/transfers?participant=${auth.participantId}`);
      setTransfers(data);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadTransfers(); }, []);

  async function act(id: string, status: "accepted" | "rejected") {
    setActionId(id);
    try {
      await api.put(`/transfers/${id}`, { status });
      await loadTransfers();
    } catch {
      //
    } finally {
      setActionId(null);
    }
  }

  const incoming = transfers.filter(
    (t) => t.status === "pending" && t.to_participant === auth.participantId
  );
  const history = transfers.filter((t) => t.status !== "pending");

  return (
    <div className="animate-fade-in min-h-full">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-bold text-on-page">{t("vault.incomingTransfers")}</h2>
        <p className="text-sm text-muted">{t("vault.acceptOrRejectSubtitle")}</p>
      </div>

      <div className="space-y-6 p-4">
        {/* Incoming */}
        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-subtle" />
          ))
        ) : incoming.length > 0 ? (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              {t("vault.pending")} ({incoming.length})
            </p>
            {incoming.map((tr) => (
              <div
                key={tr.id}
                className="rounded-2xl border border-amber-500/20 bg-surface p-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-on-page">{tr.ski_model}</p>
                    <p className="mt-0.5 text-xs text-muted">{t("transfers.fromLabel")}: {tr.from_participant}</p>
                  </div>
                  <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                    {t("vault.pending")}
                  </span>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => act(tr.id, "accepted")}
                    disabled={actionId === tr.id}
                    className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                    style={{
                      background: `linear-gradient(135deg, ${ACCENT}, #6d28d9)`,
                      boxShadow: `0 4px 12px ${ACCENT}30`,
                    }}
                  >
                    {actionId === tr.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <><CheckCircle2 className="h-4 w-4" /> {t("common.accept")}</>
                    )}
                  </button>
                  <button
                    onClick={() => act(tr.id, "rejected")}
                    disabled={actionId === tr.id}
                    className="flex min-h-[48px] items-center justify-center gap-2 rounded-xl border border-line px-4 text-sm font-semibold text-muted transition hover:text-on-page disabled:opacity-50"
                  >
                    <X className="h-4 w-4" />
                    {t("common.reject")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center py-14 text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ backgroundColor: `${ACCENT}18` }}
            >
              <ArrowRightLeft className="h-9 w-9" style={{ color: ACCENT }} />
            </div>
            <p className="font-bold text-on-surface">{t("vault.noPendingTransfers")}</p>
            <p className="mt-1 text-sm text-muted">{t("vault.incomingWillAppear")}</p>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-muted">{t("vault.historyLabel")}</p>
            {history.map((tr) => (
              <div
                key={tr.id}
                className="rounded-2xl border border-line-subtle bg-surface p-4 transition hover:bg-surface-hover"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-bold text-on-page">{tr.ski_model}</p>
                    <p className="mt-0.5 text-xs text-muted">
                      {tr.from_participant} → {tr.to_participant}
                    </p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_PILL[tr.status] ?? ""}`}>
                    {tr.status}
                  </span>
                </div>
                <p className="mt-2 text-[11px] tabular-nums text-ghost">{tr.created_at}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
