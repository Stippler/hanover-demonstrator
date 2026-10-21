"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column, useApi, useI18n } from "@hanover/ui";
import { ScrollText } from "lucide-react";

interface LogEntry {
  id: string;
  created_at: string;
  level: string;
  source: string;
  action: string;
  participant_id?: string;
  details?: Record<string, unknown> | string;
}

/** Recursively parse nested JSON strings for pretty-print. */
function deepParse(obj: unknown): unknown {
  if (obj == null) return obj;
  if (typeof obj === "string") {
    const t = obj.trim();
    if ((t.startsWith("{") && t.endsWith("}")) || (t.startsWith("[") && t.endsWith("]"))) {
      try {
        return deepParse(JSON.parse(obj) as unknown);
      } catch {
        return obj;
      }
    }
    return obj;
  }
  if (Array.isArray(obj)) return obj.map(deepParse);
  if (typeof obj === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = deepParse(v);
    return out;
  }
  return obj;
}

/** Pretty-print details, handling double-encoded JSON from the API. */
function formatDetails(details: Record<string, unknown> | string | null | undefined): string {
  if (details == null) return "—";
  let obj: unknown;
  if (typeof details === "string") {
    try {
      obj = JSON.parse(details) as unknown;
    } catch {
      return details;
    }
  } else {
    obj = details;
  }
  obj = deepParse(obj);
  try {
    return JSON.stringify(obj, null, 2);
  } catch {
    return String(details);
  }
}

const LEVEL_PILL: Record<string, string> = {
  info:  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  warn:  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  error: "bg-red-500/15 text-red-500 dark:text-red-400",
  debug: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
};

export default function LogsPage() {
  const api = useApi();
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Bug fix: endpoint is /logs not /admin/logs
    api.get<{ items: LogEntry[] } | LogEntry[]>("/logs")
      .then((data) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const raw: any[] = Array.isArray(data) ? data : ((data as any).items ?? []);
        setLogs(raw);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const columns: Column<LogEntry>[] = [
    {
      key: "created_at",
      header: t("logs.time"),
      className: "whitespace-nowrap w-40 font-mono text-xs",
      render: (row) => (
        <span className="font-mono text-xs text-muted">
          {row.created_at ? new Date(row.created_at).toLocaleString() : "—"}
        </span>
      ),
    },
    {
      key: "level",
      header: t("logs.level"),
      className: "w-20",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${LEVEL_PILL[row.level ?? ""] ?? "bg-subtle text-muted"}`}
        >
          {row.level ?? "—"}
        </span>
      ),
    },
    {
      key: "source",
      header: t("logs.service"),
      className: "w-32",
      render: (row) => <span className="font-mono text-xs text-muted">{row.source ?? "—"}</span>,
    },
    {
      key: "action",
      header: t("logs.message"),
      render: (row) => (
        <span className="font-mono text-xs text-on-surface">{row.action ?? "—"}</span>
      ),
    },
    {
      key: "details",
      header: t("logs.details"),
      className: "min-w-0 max-w-[320px] lg:max-w-[420px]",
      mobileStack: true,
      render: (row) => {
        const text = formatDetails(row.details);
        if (text === "—") return <span className="text-xs text-muted">—</span>;
        return (
          <pre className="max-h-40 overflow-auto rounded-lg bg-subtle/80 p-3 text-[11px] font-mono leading-relaxed text-on-surface whitespace-pre-wrap break-all">
            {text}
          </pre>
        );
      },
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 p-5 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-500/10">
          <ScrollText className="h-5 w-5 text-slate-500 dark:text-slate-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-page lg:text-2xl">{t("logs.title")}</h1>
          <p className="text-sm text-muted">{t("logs.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 animate-pulse rounded-2xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5">
          <DataTable
            columns={columns}
            data={logs}
            keyField="id"
            emptyMessage={t("logs.noLogs")}
            searchable
            pageSize={20}
          />
        </div>
      )}
    </div>
  );
}
