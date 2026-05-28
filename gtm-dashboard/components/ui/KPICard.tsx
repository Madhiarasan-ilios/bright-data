import { cn } from "@/lib/utils";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";

interface KPICardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  /** Positive or negative percentage change */
  trend?: number;
  isLoading?: boolean;
}

/**
 * KPI Card component for the Executive Command Center.
 * Displays a metric title, value, optional subtitle, and optional trend indicator.
 * Shows an animated skeleton when isLoading is true.
 */
export function KPICard({
  title,
  value,
  subtitle,
  trend,
  isLoading = false,
}: KPICardProps) {
  if (isLoading) {
    return (
      <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4 flex flex-col gap-3">
        <SkeletonBlock className="h-3 w-24" />
        <SkeletonBlock className="h-8 w-16" />
        <SkeletonBlock className="h-3 w-32" />
      </div>
    );
  }

  const trendPositive = trend !== undefined && trend > 0;
  const trendNegative = trend !== undefined && trend < 0;

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4 flex flex-col gap-1">
      {/* Title */}
      <p className="text-[#94a3b8] text-xs font-medium uppercase tracking-wide">
        {title}
      </p>

      {/* Value */}
      <p className="text-[#f1f5f9] text-2xl font-bold leading-tight">
        {value}
      </p>

      {/* Subtitle */}
      {subtitle && (
        <p className="text-[#94a3b8] text-xs">{subtitle}</p>
      )}

      {/* Trend */}
      {trend !== undefined && (
        <p
          className={cn(
            "text-xs font-medium",
            trendPositive && "text-green-400",
            trendNegative && "text-red-400",
            !trendPositive && !trendNegative && "text-[#94a3b8]"
          )}
          aria-label={`Trend: ${trend > 0 ? "+" : ""}${trend}%`}
        >
          {trend > 0 ? "+" : ""}
          {trend}%
        </p>
      )}
    </div>
  );
}
