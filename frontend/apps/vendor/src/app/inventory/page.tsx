"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Package, PlusCircle } from "lucide-react";
import { PassportCard, useApi, useI18n } from "@hanover/ui";

const ACCENT = "#1d4ed8";

interface Ski {
  id: string;
  model: string;
  serial_number: string;
  owner_name: string;
  status: "active" | "transferring" | "servicing";
  last_event?: string;
  last_event_date?: string;
}

export default function InventoryPage() {
  const api = useApi();
  const { t } = useI18n();
  const [skis, setSkis] = useState<Ski[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Ski[]>("/skis?participant=vendor");
        setSkis(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api]);

  return (
    <div className="animate-fade-in min-h-full bg-page text-on-page">
      {/* Header strip */}
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-on-page">{t("vendor.inventoryTitle")}</h2>
            <p className="text-sm text-muted">
              {loading ? t("common.loading") : `${skis.length} ${t("vendor.passportsIssuedCount")}`}
            </p>
          </div>
          <Link
            href="/create"
            className="inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-bold text-white transition active:scale-95"
            style={{ backgroundColor: ACCENT }}
          >
            <PlusCircle className="h-4 w-4" />
            {t("vendor.new")}
          </Link>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-3 p-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-36 animate-pulse rounded-2xl bg-subtle" />
          ))
        ) : skis.length === 0 ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-subtle">
              <Package className="h-9 w-9 text-ghost" />
            </div>
            <p className="text-base font-bold text-on-surface">{t("vendor.noPassportsYet")}</p>
            <p className="mt-1 text-sm text-muted">{t("vendor.createFirstHint")}</p>
            <Link
              href="/create"
              className="mt-5 inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 active:scale-95"
              style={{ backgroundColor: ACCENT }}
            >
              <PlusCircle className="h-4 w-4" />
              {t("form.createPassport")}
            </Link>
          </div>
        ) : (
          skis.map((ski) => (
            <PassportCard
              key={ski.id}
              id={ski.id}
              model={ski.model}
              serialNumber={ski.serial_number}
              ownerName={ski.owner_name}
              status={ski.status}
              lastEvent={ski.last_event}
              lastEventDate={ski.last_event_date}
              href={`/ski/${ski.id}`}
              accentColor={ACCENT}
            />
          ))
        )}
      </div>
    </div>
  );
}
