"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Snowflake, Share2, QrCode, Download } from "lucide-react";
import { EventTimeline, PassportDetail, QrCodeImage, useApi, useI18n, type FullPassport, type QrCodeImageHandle, type TimelineEvent } from "@hanover/ui";

const ACCENT = "#1d4ed8";

export default function SkiDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const api = useApi();
  const { t } = useI18n();
  const qrRef = useRef<QrCodeImageHandle>(null);
  const [passport, setPassport] = useState<FullPassport | null>(null);
  const [loading, setLoading] = useState(true);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    api
      .get<FullPassport>(`/skis/${id}/full-passport`)
      .then(setPassport)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api, id]);

  async function handleShare() {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: passport?.ski?.model ?? "Product Pass", url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
    }
  }

  function getQrValue(): string {
    if (!passport?.ski) return "";
    const lookupBase = typeof process !== "undefined" ? process.env.NEXT_PUBLIC_DPP_LOOKUP_BASE : "";
    if (lookupBase && passport.ski.id) {
      return `${lookupBase.replace(/\/$/, "")}/p/${passport.ski.id}`;
    }
    try {
      if (passport.ski.qr_payload) {
        const p = JSON.parse(passport.ski.qr_payload);
        return p.serial ?? passport.ski.serial_number;
      }
    } catch {}
    return passport.ski.serial_number;
  }

  const events: TimelineEvent[] = (passport?.events ?? []).map((e) => ({
    id: e.id,
    type: e.event_type,
    actor: e.actor_name ?? e.actor_participant_id,
    timestamp: e.created_at ?? "",
    description: e.payload ? JSON.stringify(e.payload) : e.event_type,
  }));

  if (loading) {
    return (
      <div className="space-y-4 p-5">
        <div className="h-9 w-24 animate-pulse rounded-xl bg-subtle" />
        <div className="h-40 animate-pulse rounded-2xl bg-subtle" />
        <div className="h-56 animate-pulse rounded-2xl bg-subtle" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      {/* Top bar */}
      <div className="flex items-center justify-between border-b border-line-subtle bg-surface px-4 py-3">
        <button
          onClick={() => router.back()}
          className="flex min-h-[44px] items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-on-page"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("common.back")}
        </button>
        <div className="flex items-center gap-2">
          {passport && (
            <button
              onClick={() => setShowQr((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-subtle hover:text-on-page"
              title="Show QR code"
            >
              <QrCode className="h-4 w-4" />
            </button>
          )}
          {passport && (
            <button
              onClick={handleShare}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-subtle hover:text-on-page"
            >
              <Share2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-4 p-5">
        {passport?.ski ? (
          <>
            {/* Passport hero */}
            <div
              className="relative overflow-hidden rounded-2xl p-5 text-white"
              style={{ background: `linear-gradient(135deg, ${ACCENT} 0%, #1e40af 60%, #312e81 100%)` }}
            >
              <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/5" />
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <Snowflake className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold">{passport.ski.model}</h2>
                  <p className="font-mono text-xs uppercase tracking-widest text-blue-100/60">
                    {passport.ski.serial_number}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex flex-col gap-0.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-100/50">
                    {t("passport.digitalPassport")}
                  </p>
                  <p className="text-[10px] text-blue-100/40">{t("passport.lifeCycleData")}</p>
                </div>
                {passport.meta?.version && (
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white/70">
                    v{passport.meta.version}
                  </span>
                )}
              </div>
            </div>

            {/* QR Code panel */}
            {showQr && (
              <div className="animate-slide-up flex flex-col items-center gap-3 rounded-2xl border border-line bg-surface p-6">
                <p className="text-xs font-bold uppercase tracking-widest text-muted">{t("passport.digitalNameplate")}</p>
                <p className="text-[11px] text-ghost">{t("passport.accessViaQr")}</p>
                <div className="overflow-hidden rounded-xl bg-white p-2 shadow-sm">
                  <QrCodeImage ref={qrRef} value={getQrValue()} size={180} />
                </div>
                <p className="font-mono text-xs text-ghost">{passport.ski.serial_number}</p>
                <button
                  type="button"
                  onClick={() => qrRef.current?.downloadPng(`ski-${passport.ski?.serial_number ?? "unknown"}.png`)}
                  className="flex items-center gap-2 rounded-xl border border-line bg-subtle px-4 py-2.5 text-sm font-semibold text-on-page transition hover:bg-surface"
                >
                  <Download className="h-4 w-4" />
                  {t("vendor.downloadPng")}
                </button>
              </div>
            )}

            {/* Rich passport detail */}
            <PassportDetail passport={passport} accentColor={ACCENT} />

            {/* Event timeline */}
            {events.length > 0 && (
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-widest text-muted">
                  {t("passport.passportHistory")}
                </h3>
                <div className="rounded-2xl border border-line bg-surface p-4">
                  <EventTimeline events={events} />
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="py-20 text-center">
            <p className="font-medium text-muted">{t("common.skiNotFound")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
