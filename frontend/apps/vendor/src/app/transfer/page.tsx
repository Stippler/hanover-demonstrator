"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Loader2, Send, ChevronDown } from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#1d4ed8";

interface Ski {
  id: string;
  model: string;
  serial_number: string;
}

export default function VendorTransferPage() {
  const api = useApi();
  const { t } = useI18n();
  const [skis, setSkis] = useState<Ski[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSki, setSelectedSki] = useState("");
  const [buyerParticipantId, setBuyerParticipantId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const data = await api.get<Ski[]>("/skis");
        setSkis(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedSki || !buyerParticipantId.trim()) return;
    setSubmitting(true);
    try {
      await api.post("/transfers", {
        ski_id: selectedSki,
        buyer_participant_id: buyerParticipantId.trim(),
      });
      setSelectedSki("");
      setBuyerParticipantId("");
    } catch {
      //
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-bold text-on-page">{t("vendor.sellTransfer")}</h2>
        <p className="text-sm text-muted">{t("vendor.sellToCustomer")}</p>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-4">
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-sm"
        >
          <div>
            <label className="mb-2 block text-xs font-bold uppercase tracking-widest text-muted">
              {t("vendor.selectSki")}
            </label>
            <div className="relative">
              <select
                value={selectedSki}
                onChange={(e) => setSelectedSki(e.target.value)}
                required
                className="w-full appearance-none rounded-xl border border-line bg-subtle px-4 py-3 text-sm font-medium text-on-page transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">{t("vault.chooseSki")}</option>
                {skis.map((ski) => (
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
              {t("vendor.buyerParticipant")}
            </label>
            <input
              type="text"
              value={buyerParticipantId}
              onChange={(e) => setBuyerParticipantId(e.target.value)}
              placeholder={t("vendor.buyerPlaceholder")}
              required
              className="w-full rounded-xl border border-line bg-subtle px-4 py-3 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || loading}
            className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-xl text-sm font-bold text-white shadow-md transition active:scale-[0.98] disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${ACCENT}, #1e40af)`,
              boxShadow: `0 4px 14px ${ACCENT}30`,
            }}
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-4 w-4" />}
            {t("vendor.initiateTransfer")}
          </button>
        </form>
        <p className="text-sm text-muted">
          After initiating, the buyer opens their vault (VaultA or VaultB), goes to Transfers, and accepts the incoming transfer.
        </p>
      </div>
    </div>
  );
}
