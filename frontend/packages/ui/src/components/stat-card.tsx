import { type LucideIcon } from "lucide-react";
import { cn } from "../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  accentColor?: string;
  trend?: { value: string; positive: boolean };
  className?: string;
  size?: "sm" | "md";
}

export function StatCard({
  label,
  value,
  icon: Icon,
  accentColor,
  trend,
  className,
  size = "md",
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border border-line-subtle bg-surface p-5 transition-colors hover:bg-surface-hover",
        size === "sm" && "p-4",
        className
      )}
    >
      {/* Subtle top gradient from accent */}
      {accentColor && (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{ background: accentColor }}
          aria-hidden
        />
      )}

      <div className="flex flex-col items-center text-center">
        {Icon && (
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl mb-3"
            style={accentColor ? { backgroundColor: `${accentColor}18` } : { backgroundColor: "rgba(113,113,122,0.12)" }}
          >
            <Icon
              className="h-6 w-6"
              style={accentColor ? { color: accentColor } : { color: "#71717a" }}
            />
          </div>
        )}
        <p className="text-[11px] font-bold uppercase tracking-widest text-muted break-words leading-tight">{label}</p>
        <p
          className={cn(
            "mt-1.5 font-extrabold tabular-nums text-on-page leading-none",
            size === "md" ? "text-3xl" : "text-2xl"
          )}
        >
          {value}
        </p>
        {trend && (
          <p
            className={cn(
              "mt-1.5 text-[11px] font-semibold",
              trend.positive ? "text-emerald-500 dark:text-emerald-400" : "text-red-500 dark:text-red-400"
            )}
          >
            {trend.positive ? "↑" : "↓"} {trend.value}
          </p>
        )}
      </div>
    </div>
  );
}
