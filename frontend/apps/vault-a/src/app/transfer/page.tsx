"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowRightLeft, Loader2, Send, X, CheckCircle2, ChevronDown, ScanLine } from "lucide-react";
import { useApi, useAuth, useI18n, QrScanner } from "@hanover/ui";

const ACCENT = "#059669";

interface Transfer {
  id: string;
  ski_id: string;
  ski_model: string;
  seller_participant_id: string;
  buyer_participant_id: string;
  status: "pending" | "completed" | "cancelled" | "rejected";
  created_at: string;
}

interface Ski {
  id: string;
  model: string;
  serial_number: string;
}

const STATUS_PILL: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-slate-500/15 text-slate-500",
  rejected: "bg-red-500/15 text-red-500 dark:text-red-400",
};

export default function TransferPage() {
  const api = useApi();
  const auth = useAuth();
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [mySkis, setMySkis] = useState<Ski[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [selectedSki, setSelectedSki] = useState("");
  const [toParticipant, setToParticipant] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [showScan, setShowScan] = useState(false);

  const handleQrScan = useCallback((result: string) => {
    const id = result.includes("/") ? result.split("/").pop()! : result.trim();
    if (id) {
      setSelectedSki(id);
      setShowForm(true);
      setShowScan(false);
    }
  }, []);

  async function loadAll() {
    setLoading(true);
    try {
      const [transfersRes, skisRes] = await Promise.allSettled([
        api.get<Transfer[]>(`/transfers?participant=${auth.participantId}`),
        api.get<Ski[]>(`/skis?owner=${auth.participantId}`),
      ]);
      if (transfersRes.status === "fulfilled") setTransfers(transfersRes.value);
      if (skisRes.status === "fulfilled") setMySkis(skisRes.value);
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadAll(); }, [api, auth.participantId]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.post("/transfers", {
        ski_id: selectedSki,
        buyer_participant_id: toParticipant,
      });
      setShowForm(false);
      setSelectedSki("");
      setToParticipant("");
      await loadAll();
    } catch {
      //
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAccept(id: string) {
    setActionId(id);
    try {
      await api.post(`/transfers/${id}/accept`, {});
      await loadAll();
    } catch {
      //
    } finally {
      setActionId(null);
    }
  }

  async function handleCancel(id: string) {
    setActionId(id);
    try {
      await api.post(`/transfers/${id}/cancel`, {});
      await loadAll();
    } catch {
      //
    } finally {
      setActionId(null);
    }
  }

  const incoming = transfers.filter(
    (t) => t.status === "pending" && t.buyer_participant_id === auth.participantId
  );
  const outgoing = transfers.filter(
    (t) => t.status === "pending" && t.seller_participant_id === auth.participantId
  );
  const history = transfers.filter((t) => t.status !== "pending");

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      {/* Header */}
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-page">{t("vault.transfersLabel")}</h2>
            <p className="text-sm text-muted">{t("vault.sendReceiveSubtitle")}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowScan((v) => !v); if (showForm) setShowForm(false); }}
              className="flex items-center gap-1.5 rounded-xl border-2 border-white/50 bg-white/20 px-3.5 py-2 text-sm font-bold text-white transition active:scale-95 hover:bg-white/30"
            >
              <ScanLine className="h-4 w-4" />
              {showScan ? t("common.cancel") : t("vault.scanToTransfer")}
            </button>
            <button
              onClick={() => { setShowForm((v) => !v); if (showScan) setShowScan(false); }}
              className="flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white transition active:scale-95"
              style={{ backgroundColor: ACCENT }}
            >
              {showForm ? <X className="h-4 w-4" /> : <Send className="h-4 w-4" />}
              {showForm ? t("common.cancel") : t("common.send")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6 p-4">
        {/* Scan QR to select ski for transfer */}
        {showScan && (
          <div className="animate-slide-up space-y-3 rounded-2xl border border-line bg-surface p-4 shadow-sm">
            <h3 className="font-bold text-on-page">{t("vault.scanToTransfer")}</h3>
            <p className="text-sm text-muted">{t("vault.scanSkiToTransferSubtitle")}</p>
            <div className="overflow-hidden rounded-xl shadow-lg">
              <QrScanner
                onScan={handleQrScan}
                onClose={() => setShowScan(false)}
                themeColor={ACCENT}
                className="aspect-[4/3] w-full"
              />
            </div>
          </div>
        )}

        {/* New transfer form */}
        {showForm && (
          <form
            onSubmit={handleSend}
            className="animate-slide-up space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
          >
            <h3 className="font-bold text-on-page">{t("vault.sendSki")}</h3>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
                {t("vault.selectSki")}
              </label>
              <div className="relative">
                <select
                  value={selectedSki}
                  onChange={(e) => setSelectedSki(e.target.value)}
                  required
                  className="w-full appearance-none rounded-xl border border-line bg-subtle px-4 py-3 text-sm font-medium text-on-page transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">{t("vault.chooseSki")}</option>
                  {selectedSki && !mySkis.some((s) => s.id === selectedSki) && (
                    <option value={selectedSki}>{t("vault.scanToTransfer")}: {selectedSki}</option>
                  )}
                  {mySkis.map((ski) => (
                    <option key={ski.id} value={ski.id}>
                      {ski.model} · {ski.serial_number}
                    </option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              </div>
            </div>
            <div>
              <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
                {t("vault.transferTo")}
              </label>
              <input
                type="text"
                value={toParticipant}
                onChange={(e) => setToParticipant(e.target.value)}
                required
                placeholder={t("vault.participantIdPlaceholder")}
                className="w-full rounded-xl border border-line bg-subtle px-4 py-3 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #047857)`,
                boxShadow: `0 4px 14px ${ACCENT}30`,
              }}
            >
              {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : t("vault.initiateTransfer")}
            </button>
          </form>
        )}

        {loading ? (
          Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-subtle" />
          ))
        ) : (
          <>
            {/* Incoming transfers needing action */}
            {incoming.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                  {t("vault.incomingCount")} ({incoming.length})
                </p>
                {incoming.map((tr) => (
                  <div
                    key={tr.id}
                    className="rounded-2xl border border-amber-500/20 bg-surface p-4"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-on-page">{tr.ski_model || tr.ski_id}</p>
                        <p className="mt-0.5 text-xs text-muted">{t("transfers.fromLabel")}: {tr.seller_participant_id}</p>
                      </div>
                      <span className="rounded-full bg-amber-500/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-600 dark:text-amber-400">
                        {t("vault.pending")}
                      </span>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => handleAccept(tr.id)}
                        disabled={actionId === tr.id}
                        className="flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl text-sm font-bold text-white transition active:scale-[0.98] disabled:opacity-50"
                        style={{
                          background: `linear-gradient(135deg, ${ACCENT}, #047857)`,
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
                        onClick={() => handleCancel(tr.id)}
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
            )}

            {/* Outgoing pending */}
            {outgoing.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">
                  {t("vault.pendingOutgoing")} ({outgoing.length})
                </p>
                {outgoing.map((tr) => (
                  <div key={tr.id} className="rounded-2xl border border-line-subtle bg-surface p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-bold text-on-page">{tr.ski_model || tr.ski_id}</p>
                        <p className="mt-0.5 text-xs text-muted">{t("transfers.toLabel")}: {tr.buyer_participant_id}</p>
                      </div>
                      <button
                        onClick={() => handleCancel(tr.id)}
                        disabled={actionId === tr.id}
                        className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-3 text-xs font-semibold text-muted transition hover:text-on-page disabled:opacity-50"
                      >
                        {actionId === tr.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                        {t("common.cancel")}
                      </button>
                    </div>
                    <p className="mt-2 text-[11px] tabular-nums text-ghost">{tr.created_at}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Empty state */}
            {incoming.length === 0 && outgoing.length === 0 && history.length === 0 && (
              <div className="flex flex-col items-center py-20 text-center">
                <div
                  className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
                  style={{ backgroundColor: `${ACCENT}18` }}
                >
                  <ArrowRightLeft className="h-9 w-9" style={{ color: ACCENT }} />
                </div>
                <p className="font-bold text-on-surface">{t("vault.noTransfersYet")}</p>
                <p className="mt-1 text-sm text-muted">{t("vault.sendOrWait")}</p>
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
                        <p className="truncate font-bold text-on-page">{tr.ski_model || tr.ski_id}</p>
                        <p className="mt-0.5 text-xs text-muted">
                          {tr.seller_participant_id} → {tr.buyer_participant_id}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_PILL[tr.status] ?? "text-muted"}`}>
                        {tr.status}
                      </span>
                    </div>
                    <p className="mt-2 text-[11px] tabular-nums text-ghost">{tr.created_at}</p>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
