import { ShieldCheck, ShieldAlert } from "lucide-react";
import { cn } from "../lib/utils";

interface ParticipantBadgeProps {
  name: string;
  compliant: boolean;
  className?: string;
}

export function ParticipantBadge({
  name,
  compliant,
  className,
}: ParticipantBadgeProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors",
        compliant
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400 hover:bg-emerald-500/10"
          : "border-amber-500/20 bg-amber-500/5 text-amber-400 hover:bg-amber-500/10",
        className
      )}
    >
      {compliant ? (
        <ShieldCheck className="h-4 w-4" />
      ) : (
        <ShieldAlert className="h-4 w-4" />
      )}
      <span className="min-w-0 flex-1 break-words font-medium">{name}</span>
      <span className="ml-auto rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider opacity-60">
        {compliant ? "Gaia-X" : "Pending"}
      </span>
    </div>
  );
}
