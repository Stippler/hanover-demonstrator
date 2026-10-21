"use client";

import {
  Factory,
  Wrench,
  ArrowRightLeft,
  CheckCircle2,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "../lib/utils";
import { useI18n } from "../providers/i18n-provider";

export interface TimelineEvent {
  id: string;
  type: string;
  actor: string;
  timestamp: string;
  description: string;
}

const eventStyles: Record<
  string,
  { color: string; bg: string; ring: string; icon: LucideIcon }
> = {
  manufactured: {
    color: "text-blue-400",
    bg: "bg-blue-500/15",
    ring: "ring-blue-500/30",
    icon: Factory,
  },
  serviced: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/15",
    ring: "ring-emerald-500/30",
    icon: Wrench,
  },
  transfer_initiated: {
    color: "text-orange-400",
    bg: "bg-orange-500/15",
    ring: "ring-orange-500/30",
    icon: ArrowRightLeft,
  },
  transfer_completed: {
    color: "text-green-400",
    bg: "bg-green-500/15",
    ring: "ring-green-500/30",
    icon: CheckCircle2,
  },
  verified: {
    color: "text-violet-400",
    bg: "bg-violet-500/15",
    ring: "ring-violet-500/30",
    icon: ShieldCheck,
  },
};

const defaultStyle = {
  color: "text-muted",
  bg: "bg-subtle",
  ring: "ring-line/30",
  icon: CheckCircle2,
};

export function EventTimeline({ events }: { events: TimelineEvent[] }) {
  const { t } = useI18n();
  const list = Array.isArray(events) ? events : [];
  if (list.length === 0) {
    return (
      <div className="flex flex-col items-center py-12 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-subtle/50">
          <CheckCircle2 className="h-5 w-5 text-ghost" />
        </div>
        <p className="text-sm font-medium text-muted">
          {t("events.noEventsYet")}
        </p>
        <p className="mt-1 text-xs text-ghost">
          {t("events.noEventsHint")}
        </p>
      </div>
    );
  }

  return (
    <div className="relative space-y-0">
      <div className="absolute bottom-4 left-[15px] top-4 w-px bg-gradient-to-b from-line via-line-subtle to-transparent" />
      {list.map((event) => {
        const style = eventStyles[event.type] ?? defaultStyle;
        const Icon = style.icon;
        return (
          <div key={event.id} className="relative flex gap-4 py-3 pl-0">
            <div
              className={cn(
                "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-1",
                style.bg,
                style.ring
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", style.color)} />
            </div>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-semibold text-on-surface">
                {event.description}
              </p>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-muted">
                <span className="font-medium">{event.actor}</span>
                <span className="text-ghost">&middot;</span>
                <time className="tabular-nums">{event.timestamp}</time>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
