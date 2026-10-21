"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column, useApi, useI18n } from "@hanover/ui";
import { ArrowRightLeft } from "lucide-react";

interface Transfer {
  id: string;
  ski_id: string;
  serial_number: string;
  seller_name: string;
  buyer_name: string;
  status: string;
  created_at: string;
  completed_at?: string;
}

const STATUS_PILL: Record<string, string> = {
  pending:   "bg-amber-500/15 text-amber-600 dark:text-amber-400",
  completed: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  cancelled: "bg-slate-500/15 text-slate-500 dark:text-slate-400",
  expired:   "bg-red-500/15 text-red-500 dark:text-red-400",
  transferring: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
  accepted:  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
  rejected:  "bg-red-500/15 text-red-500 dark:text-red-400",
};

export default function TransfersPage() {
  const api = useApi();
  const { t } = useI18n();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Transfer[]>("/transfers")
      .then(setTransfers)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const columns: Column<Transfer>[] = [
    {
      key: "serial_number",
      header: t("transfers.ski"),
      render: (row) => (
        <span className="font-mono text-xs font-semibold text-on-surface">{row.serial_number}</span>
      ),
    },
    { key: "seller_name", header: t("transfers.from") },
    { key: "buyer_name", header: t("transfers.to") },
    {
      key: "status",
      header: t("common.status"),
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${STATUS_PILL[row.status] ?? "bg-subtle text-muted"}`}
        >
          {row.status}
        </span>
      ),
    },
    { key: "created_at", header: t("common.date") },
  ];

  return (
    <div className="animate-fade-in space-y-6 p-5 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/10">
          <ArrowRightLeft className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-page lg:text-2xl">{t("transfers.title")}</h1>
          <p className="text-sm text-muted">{t("transfers.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5">
          <DataTable
            columns={columns}
            data={transfers}
            keyField="id"
            emptyMessage={t("transfers.noRecords")}
            searchable
          />
        </div>
      )}
    </div>
  );
}
