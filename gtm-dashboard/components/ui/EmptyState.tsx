interface EmptyStateProps {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * Centered empty-state message with an optional action button.
 * Used when no data is available to display in a panel.
 */
export function EmptyState({ message, actionLabel, onAction }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-12 px-6 text-center">
      <p className="text-[#94a3b8] text-sm">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center rounded-lg bg-[#334155] px-4 py-2 text-sm font-medium text-[#f1f5f9] transition-colors hover:bg-[#475569] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f172a]"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
