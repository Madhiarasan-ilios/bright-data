import { cn } from "@/lib/utils";

interface BooleanBadgeProps {
  value: boolean;
  trueLabel?: string;
  falseLabel?: string;
}

/**
 * Renders a boolean value as a styled chip.
 * true  → green chip
 * false → grey chip
 */
export function BooleanBadge({
  value,
  trueLabel = "Yes",
  falseLabel = "No",
}: BooleanBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
        value
          ? "bg-green-500/20 text-green-400"
          : "bg-slate-500/20 text-slate-400"
      )}
    >
      {value ? trueLabel : falseLabel}
    </span>
  );
}
