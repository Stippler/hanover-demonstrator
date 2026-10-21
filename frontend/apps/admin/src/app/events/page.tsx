"use client";

import { useEffect, useState, useMemo } from "react";
import { Search, RefreshCcw, Activity } from "lucide-react";
import { EventTimeline, useApi, useI18n, type TimelineEvent } from "@hanover/ui";

export default function EventsPage() {
  const api = useApi();
  const { t } = useI18n();
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await api.get<any>("/events?limit=50");
      // API returns { items: [...], total: N } or plain array
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const raw: any[] = Array.isArray(data) ? data : (data.items ?? []);
      setEvents(
        raw.map((e) => ({
          id: String(e.id ?? ""),
          type: String(e.event_type ?? ""),
          actor: String(e.actor_name ?? e.actor_participant_id ?? ""),
          timestamp: e.created_at ? new Date(String(e.created_at)).toLocaleString() : "",
          description: `${String(e.event_type ?? "").replace(/_/g, " ")} — ${String(e.serial_number ?? "")}`,
        }))
      );
    } catch {
      //
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return events;
    const q = search.toLowerCase();
    return events.filter(
      (e) =>
        e.description.toLowerCase().includes(q) ||
        e.actor.toLowerCase().includes(q) ||
        e.type.toLowerCase().includes(q)
    );
  }, [events, search]);

  return (
    <div className="animate-fade-in space-y-6 p-5 lg:p-8">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10">
            <Activity className="h-5 w-5 text-cyan-500 dark:text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-extrabold text-on-page lg:text-2xl">{t("events.title")}</h1>
            <p className="text-sm text-muted">{t("events.subtitle")}</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line text-muted transition hover:bg-subtle hover:text-on-page disabled:opacity-50"
          title={t("common.refresh")}
        >
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("events.searchPlaceholder")}
          className="w-full rounded-xl border border-line bg-surface py-3 pl-10 pr-4 text-sm text-on-page placeholder:text-ghost transition focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5 sm:p-6">
          {filtered.length > 0 ? (
            <EventTimeline events={filtered} />
          ) : search ? (
            <p className="py-8 text-center text-sm text-muted">
              {t("events.noMatch")} &ldquo;{search}&rdquo;
            </p>
          ) : (
            <p className="py-8 text-center text-sm text-muted">{t("common.noData")}</p>
          )}
        </div>
      )}
    </div>
  );
}
