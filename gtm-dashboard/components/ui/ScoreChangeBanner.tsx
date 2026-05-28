'use client';

import { useState } from 'react';

export interface ScoreChange {
  company: string;
  delta: number;
  newScore: number;
}

interface ScoreChangeBannerProps {
  changes: ScoreChange[];
}

/**
 * Displays a dismissible banner listing significant score changes for watched accounts.
 * Returns null when there are no changes or when the user has dismissed the banner.
 */
export function ScoreChangeBanner({ changes }: ScoreChangeBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed || changes.length === 0) return null;

  return (
    <div
      role="alert"
      className="border border-amber-500 bg-amber-500/10 rounded-lg px-4 py-3 flex items-start gap-3"
    >
      <div className="flex-1 space-y-1">
        <p className="text-sm font-semibold text-amber-400">Score changes detected</p>
        <ul className="space-y-0.5">
          {changes.map((change) => (
            <li key={change.company} className="text-sm text-[#f1f5f9]">
              <span className="font-medium">{change.company}</span>: score changed by{' '}
              <span
                className={change.delta >= 0 ? 'text-green-400' : 'text-red-400'}
              >
                {change.delta >= 0 ? '+' : ''}
                {change.delta}
              </span>{' '}
              (now <span className="font-medium">{change.newScore}</span>)
            </li>
          ))}
        </ul>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss score change banner"
        className="shrink-0 text-[#94a3b8] hover:text-[#f1f5f9] transition-colors text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
