"use client";

import Link from "next/link";
import {
  Snowflake,
  ArrowRightLeft,
  CheckCircle2,
  Wrench,
  ChevronRight,
} from "lucide-react";
import { cn } from "../lib/utils";

interface PassportCardProps {
  id: string;
  model: string;
  serialNumber: string;
  ownerName: string;
  status: "active" | "transferring" | "servicing";
  lastEvent?: string;
  lastEventDate?: string;
  href?: string;
  accentColor?: string;
}

const statusConfig = {
  active: {
    label: "Active",
    pill: "bg-emerald-500/15 text-emerald-500 dark:text-emerald-400",
    icon: CheckCircle2,
    bar: "bg-emerald-500",
  },
  transferring: {
    label: "Transferring",
    pill: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
    icon: ArrowRightLeft,
    bar: "bg-amber-500",
  },
  servicing: {
    label: "In Service",
    pill: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
    icon: Wrench,
    bar: "bg-blue-500",
  },
};

export function PassportCard({
  id,
  model,
  serialNumber,
  ownerName,
  status,
  lastEvent,
  lastEventDate,
  href,
  accentColor,
}: PassportCardProps) {
  const s = statusConfig[status] ?? statusConfig.active;
  const StatusIcon = s.icon;

  const card = (
    <div
      className={cn(
        "group relative overflow-hidden rounded-2xl border bg-surface transition-all duration-200",
        "border-line-subtle dark:border-line",
        href && "hover:shadow-lg hover:shadow-black/10 dark:hover:shadow-black/40 hover:-translate-y-0.5 active:translate-y-0 active:shadow-none cursor-pointer"
      )}
    >
      {/* Accent bar */}
      <div
        className={cn("absolute inset-x-0 top-0 h-[3px]", !accentColor && s.bar)}
        style={accentColor ? { background: accentColor } : undefined}
        aria-hidden
      />

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
              style={accentColor ? { backgroundColor: `${accentColor}18` } : { backgroundColor: "rgba(59,130,246,0.1)" }}
              aria-hidden
            >
              <Snowflake
                className="h-5 w-5"
                style={accentColor ? { color: accentColor } : { color: "#3b82f6" }}
              />
            </div>
            <div className="min-w-0">
              <p className="truncate font-bold text-on-page leading-tight">{model}</p>
              <p className="mt-0.5 font-mono text-[11px] text-muted tracking-wider uppercase">{serialNumber}</p>
            </div>
          </div>
          <span className={cn("shrink-0 inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide", s.pill)}>
            <StatusIcon className="h-3 w-3" />
            {s.label}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-subtle/60 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">Owner</p>
            <p className="text-sm font-semibold text-on-surface truncate">{ownerName}</p>
          </div>
          {lastEvent && (
            <div className="rounded-xl bg-subtle/60 px-3 py-2">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted mb-0.5">Last Event</p>
              <p className="text-sm font-semibold text-on-surface truncate">{lastEvent}</p>
              {lastEventDate && <p className="text-[10px] text-ghost mt-0.5">{lastEventDate}</p>}
            </div>
          )}
        </div>

        {href && (
          <div className="mt-3 flex items-center justify-end gap-1 text-xs font-semibold text-muted transition-all group-hover:text-on-surface group-hover:gap-1.5">
            View passport
            <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </div>
        )}
      </div>
    </div>
  );

  if (href) return <Link href={href} className="block">{card}</Link>;
  return card;
}
