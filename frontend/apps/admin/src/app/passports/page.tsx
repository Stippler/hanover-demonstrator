"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column, useApi, useI18n } from "@hanover/ui";
import { FileText, ExternalLink } from "lucide-react";

const DOMAIN = process.env.NEXT_PUBLIC_DOMAIN ?? "imx.vactory-projects.com";
const BRIDGE_DPP_BASE = process.env.NEXT_PUBLIC_DPP_LOOKUP_BASE ?? `https://bridge.${DOMAIN}`;

interface PassportRow {
  id: string;
  ski_id: string;
  current_owner_participant_id: string;
  current_owner_name: string | null;
  version: number;
  created_at: string;
  updated_at: string;
  serial_number: string;
  model: string;
  manufacturer: string | null;
}

export default function PassportsPage() {
  const api = useApi();
  const { t } = useI18n();
  const [passports, setPassports] = useState<PassportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<PassportRow[]>("/passports")
      .then(setPassports)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const columns: Column<PassportRow>[] = [
    {
      key: "serial_number",
      header: t("stats.serial"),
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-on-surface">{row.serial_number}</span>
      ),
    },
    { key: "model", header: t("stats.model") },
    {
      key: "current_owner_name",
      header: t("admin.currentOwner"),
      render: (row) => (
        <span className="font-medium text-on-surface">
          {row.current_owner_name ?? row.current_owner_participant_id}
        </span>
      ),
    },
    {
      key: "version",
      header: t("common.version"),
      render: (row) => <span className="text-muted">v{row.version}</span>,
    },
    { key: "updated_at", header: t("passport.lastUpdated") },
    {
      key: "view",
      header: "",
      render: (row) => (
        <a
          href={`${BRIDGE_DPP_BASE.replace(/\/$/, "")}/p/${row.ski_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-subtle/80 px-2.5 py-1.5 text-xs font-semibold text-on-page transition hover:bg-subtle"
        >
          {t("admin.viewDpp")}
          <ExternalLink className="h-3 w-3" />
        </a>
      ),
    },
  ];

  return (
    <div className="animate-fade-in space-y-6 p-5 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10">
          <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-page lg:text-2xl">{t("admin.passportsTitle")}</h1>
          <p className="text-sm text-muted">{t("admin.passportsSubtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-2xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5">
          <DataTable
            columns={columns}
            data={passports}
            keyField="id"
            emptyMessage={t("common.noData")}
            searchable
          />
        </div>
      )}
    </div>
  );
}
