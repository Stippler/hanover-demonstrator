"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2, Snowflake, Camera, Keyboard, ScanLine } from "lucide-react";
import { useApi, useI18n, PassportCard, QrScanner } from "@hanover/ui";

const ACCENT = "#ea580c";

interface Ski {
  id: string;
  model: string;
  serial_number: string;
  owner_name: string;
  status: "active" | "transferring" | "servicing";
  last_event?: string;
  last_event_date?: string;
}

export default function ScanPage() {
  const api = useApi();
  const { t } = useI18n();
  const router = useRouter();
  const [skiId, setSkiId] = useState("");
  const [searching, setSearching] = useState(false);
  const [ski, setSki] = useState<Ski | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [mode, setMode] = useState<"camera" | "manual">("camera");

  const searchSki = useCallback(async (id: string) => {
    if (!id.trim()) return;
    setSearching(true);
    setNotFound(false);
    setSki(null);
    try {
      const data = await api.get<Ski>(`/skis/${id.trim()}`);
      setSki(data);
    } catch {
      setNotFound(true);
    } finally {
      setSearching(false);
    }
  }, [api]);

  const handleQrScan = useCallback((result: string) => {
    const id = result.includes("/") ? result.split("/").pop()! : result;
    setSkiId(id);
    searchSki(id);
  }, [searchSki]);

  return (
    <div className="animate-fade-in min-h-full">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-extrabold text-on-page">{t("service.scan")}</h2>
        <p className="text-sm text-muted">{t("service.scanSubtitle")}</p>
      </div>

      <div className="space-y-5 p-4">
        <div className="flex gap-2 rounded-2xl bg-subtle p-1.5">
          {(["camera", "manual"] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setSki(null); setNotFound(false); setSkiId(""); }}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-all duration-200"
              style={
                mode === m
                  ? { backgroundColor: ACCENT, color: "white", boxShadow: `0 2px 8px ${ACCENT}40` }
                  : { color: "var(--t-muted)" }
              }
            >
              {m === "camera" ? <Camera className="h-4 w-4" /> : <Keyboard className="h-4 w-4" />}
              {m === "camera" ? t("service.camera") : t("service.manual")}
            </button>
          ))}
        </div>

        {!ski && mode === "camera" && (
          <div className="overflow-hidden rounded-2xl shadow-lg">
            <QrScanner
              onScan={handleQrScan}
              themeColor={ACCENT}
              className="aspect-[4/3] w-full"
            />
          </div>
        )}

        {!ski && mode === "manual" && (
          <form
            onSubmit={(e) => { e.preventDefault(); searchSki(skiId); }}
            className="flex gap-2"
          >
            <input
              type="text"
              value={skiId}
              onChange={(e) => setSkiId(e.target.value)}
              placeholder={t("service.enterSkiId")}
              className="flex-1 rounded-xl border border-line bg-surface px-4 py-3.5 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
            <button
              type="submit"
              disabled={searching || !skiId.trim()}
              className="flex min-h-[52px] min-w-[52px] items-center justify-center rounded-xl text-white transition active:scale-95 disabled:opacity-50"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`,
                boxShadow: `0 4px 12px ${ACCENT}30`,
              }}
            >
              {searching ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Search className="h-5 w-5" />
              )}
            </button>
          </form>
        )}

        {searching && (
          <div className="flex items-center justify-center gap-2.5 py-8 text-sm text-muted">
            <Loader2 className="h-5 w-5 animate-spin" style={{ color: ACCENT }} />
            {t("service.lookingUp")}
          </div>
        )}

        {ski && (
          <div className="animate-slide-up space-y-3">
            <PassportCard
              id={ski.id}
              model={ski.model}
              serialNumber={ski.serial_number}
              ownerName={ski.owner_name}
              status={ski.status}
              lastEvent={ski.last_event}
              lastEventDate={ski.last_event_date}
              accentColor={ACCENT}
            />
            <button
              onClick={() => router.push(`/scan/${ski.id}`)}
              className="flex min-h-[52px] w-full items-center justify-center gap-2.5 rounded-xl text-sm font-bold text-white shadow-lg transition active:scale-[0.98]"
              style={{
                background: `linear-gradient(135deg, ${ACCENT}, #c2410c)`,
                boxShadow: `0 4px 16px ${ACCENT}40`,
              }}
            >
              <Snowflake className="h-5 w-5" />
              {t("service.viewPassport")}
            </button>
            <button
              onClick={() => { setSki(null); setSkiId(""); setNotFound(false); }}
              className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-line text-sm font-semibold text-muted transition hover:text-on-page"
            >
              <ScanLine className="mr-1.5 h-4 w-4" />
              {t("service.scanAgain")}
            </button>
          </div>
        )}

        {notFound && (
          <div className="animate-fade-in rounded-2xl border border-red-500/20 bg-red-500/10 p-5 text-center">
            <p className="font-semibold text-red-500 dark:text-red-400">{t("service.skiNotFound")}</p>
            <p className="mt-1 text-sm text-muted">{t("service.checkIdTryAgain")}</p>
            <button
              onClick={() => { setNotFound(false); setSkiId(""); }}
              className="mt-3 text-xs font-semibold text-muted hover:text-on-page"
            >
              {t("service.clear")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
