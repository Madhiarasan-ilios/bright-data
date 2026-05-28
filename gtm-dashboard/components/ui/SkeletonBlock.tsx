import { cn } from "@/lib/utils";

interface SkeletonBlockProps {
  className?: string;
}

/**
 * Reusable animated placeholder block used across all data-dependent panels.
 * Renders an animate-pulse div with the dark-theme surface colour.
 */
export function SkeletonBlock({ className }: SkeletonBlockProps) {
  return (
    <div
      className={cn("animate-pulse bg-[#334155] rounded", className)}
      aria-hidden="true"
    />
  );
}
