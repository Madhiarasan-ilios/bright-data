import { cn } from "@/lib/utils";

interface PriorityBadgeProps {
  priority: "HIGH" | "MEDIUM" | "LOW";
}

const priorityStyles: Record<PriorityBadgeProps["priority"], string> = {
  HIGH: "bg-red-500/20 text-red-400 border border-red-500/30",
  MEDIUM: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  LOW: "bg-slate-500/20 text-slate-400 border border-slate-500/30",
};

/**
 * Colour-coded priority badge.
 * HIGH → red, MEDIUM → amber, LOW → grey
 */
export function PriorityBadge({ priority }: PriorityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        priorityStyles[priority]
      )}
    >
      {priority}
    </span>
  );
}
