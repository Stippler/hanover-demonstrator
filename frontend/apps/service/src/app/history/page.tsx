"use client";

import { useEffect, useState, useMemo } from "react";
import { Wrench, Search } from "lucide-react";
import { useApi, useI18n } from "@hanover/ui";

const ACCENT = "#ea580c";

interface ServiceRecord {
  id: string;
  ski_id: string;
  ski_model: string;
  service_type: string;
  description: string;
  technician: string;
  created_at: string;
}

export default function HistoryPage() {
  const api = useApi();
  const { t } = useI18n();
  const [records, setRecords] = useState<ServiceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<ServiceRecord[]>("/services?participant=service_shop");
        setRecords(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api]);

  const filtered = useMemo(() => {
    if (!search.trim()) return records;
    const q = search.toLowerCase();
    return records.filter(
      (r) =>
        r.ski_model.toLowerCase().includes(q) ||
        r.service_type.toLowerCase().includes(q) ||
        r.technician.toLowerCase().includes(q)
    );
  }, [records, search]);

  return (
    <div className="animate-fade-in min-h-full">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-extrabold text-on-page">{t("service.history")}</h2>
        <p className="text-sm text-muted">
          {loading ? t("common.loading") : `${records.length} ${records.length === 1 ? t("service.servicesRecorded") : t("service.servicesRecorded_other")}`}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {!loading && records.length > 0 && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("service.historySearchPlaceholder")}
              className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
            />
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-subtle" />
          ))
        ) : filtered.length === 0 && !search ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ backgroundColor: `${ACCENT}18` }}
            >
              <Wrench className="h-9 w-9" style={{ color: ACCENT }} />
            </div>
            <p className="font-bold text-on-surface">{t("service.noServiceRecordsYet")}</p>
            <p className="mt-1.5 text-sm text-muted">
              {t("service.noServiceRecordsHint")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((record) => (
              <div
                key={record.id}
                className="overflow-hidden rounded-2xl border border-line-subtle bg-surface transition hover:bg-surface-hover"
              >
                <div
                  className="h-1"
                  style={{ background: `linear-gradient(90deg, ${ACCENT}, transparent)` }}
                />
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-bold text-on-page">{record.ski_model}</p>
                      <p
                        className="mt-0.5 text-sm font-semibold"
                        style={{ color: ACCENT }}
                      >
                        {record.service_type}
                      </p>
                    </div>
                    <div
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${ACCENT}18` }}
                    >
                      <Wrench className="h-4 w-4" style={{ color: ACCENT }} />
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-muted line-clamp-2">{record.description}</p>
                  <div className="mt-3 flex items-center justify-between border-t border-line-subtle pt-3 text-[11px] text-ghost">
                    <span className="font-medium">{record.technician}</span>
                    <span className="tabular-nums">{record.created_at}</span>
                  </div>
                </div>
              </div>
            ))}
            {filtered.length === 0 && search && (
              <p className="py-10 text-center text-sm text-muted">
                {t("events.noResultsFor")} &ldquo;{search}&rdquo;
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
