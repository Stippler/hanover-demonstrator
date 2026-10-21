"use client";

import { useEffect, useState } from "react";
import { DataTable, type Column, ParticipantBadge, useApi, useI18n } from "@hanover/ui";
import { Users } from "lucide-react";

interface Participant {
  id: string;
  name: string;
  role: string;
  gaiax_compliant: boolean;
  created_at: string;
}

export default function ParticipantsPage() {
  const api = useApi();
  const { t } = useI18n();
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Participant[]>("/participants")
      .then(setParticipants)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [api]);

  const columns: Column<Participant>[] = [
    {
      key: "name",
      header: t("nav.participants"),
      render: (row) => <ParticipantBadge name={row.name} compliant={row.gaiax_compliant} />,
    },
    { key: "role", header: t("participants.role") },
    {
      key: "gaiax_compliant",
      header: t("participants.gaiaX"),
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${
            row.gaiax_compliant
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
          }`}
        >
          {row.gaiax_compliant ? t("participants.compliant") : t("participants.pending")}
        </span>
      ),
    },
    { key: "created_at", header: t("participants.registered") },
  ];

  return (
    <div className="animate-fade-in space-y-6 p-5 lg:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10">
          <Users className="h-5 w-5 text-violet-500 dark:text-violet-400" />
        </div>
        <div>
          <h1 className="text-xl font-extrabold text-on-page lg:text-2xl">{t("participants.title")}</h1>
          <p className="text-sm text-muted">{t("participants.subtitle")}</p>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-subtle" />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-line-subtle bg-surface p-5">
          <DataTable
            columns={columns}
            data={participants}
            keyField="id"
            emptyMessage={t("common.noData")}
            searchable
          />
        </div>
      )}
    </div>
  );
}
