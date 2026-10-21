"use client";

import { useEffect, useState, useMemo } from "react";
import { Package, Search } from "lucide-react";
import { PassportCard, useApi, useAuth, useI18n } from "@hanover/ui";

const ACCENT = "#7c3aed";

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
  const auth = useAuth();
  const { t } = useI18n();
  const [skis, setSkis] = useState<Ski[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const data = await api.get<Ski[]>(`/skis?owner=${auth.participantId}`);
        setSkis(data);
      } catch {
        //
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [api, auth.participantId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return skis;
    const q = search.toLowerCase();
    return skis.filter(
      (s) => s.model.toLowerCase().includes(q) || s.serial_number.toLowerCase().includes(q)
    );
  }, [skis, search]);

  return (
    <div className="animate-fade-in min-h-full">
      <div className="border-b border-line-subtle bg-surface px-5 py-4">
        <h2 className="text-lg font-bold text-on-page">{t("vault.vault")}</h2>
        <p className="text-sm text-muted">
          {loading ? t("common.loading") : `${skis.length} ${skis.length === 1 ? t("vault.ski") : t("vault.skis")} ${t("vault.skisInCollection")}`}
        </p>
      </div>

      <div className="space-y-4 p-4">
        {skis.length > 0 && !loading && (
          <div className="relative">
            <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("vault.searchPlaceholder")}
              className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-sm font-medium text-on-page placeholder:text-ghost transition focus:border-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-500/20"
            />
          </div>
        )}

        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-2xl bg-subtle" />
          ))
        ) : filtered.length === 0 && !search ? (
          <div className="flex flex-col items-center py-20 text-center">
            <div
              className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl"
              style={{ backgroundColor: `${ACCENT}18` }}
            >
              <Package className="h-9 w-9" style={{ color: ACCENT }} />
            </div>
            <p className="text-base font-bold text-on-surface">{t("vault.vaultEmpty")}</p>
            <p className="mt-1.5 max-w-xs text-sm text-muted">
              Skis will appear here once transferred to your vault.
            </p>
          </div>
        ) : (
          <>
            {filtered.map((ski) => (
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
            ))}
            {filtered.length === 0 && search && (
              <p className="py-10 text-center text-sm text-muted">
                No results for &ldquo;{search}&rdquo;
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
