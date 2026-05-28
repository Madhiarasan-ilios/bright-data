'use client';

import { useGTMStore } from '@/lib/store';
import { computeScoreDelta, isSignificantDelta } from '@/lib/utils/scoreDelta';

/**
 * Lists watched accounts from the Zustand store with their last-known scores
 * and a delta indicator comparing stored score to the current report score.
 * Highlights accounts with |delta| >= 5 with an amber border/background.
 * Shows "Not in latest run" for accounts absent from current reports.
 */
export function WatchedAccountsSection() {
  const watchedAccounts = useGTMStore((s) => s.watchedAccounts);
  const reports = useGTMStore((s) => s.reports);

  if (watchedAccounts.length === 0) {
    return (
      <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#f1f5f9] mb-3">
          Watched Accounts
        </h2>
        <p className="text-[#94a3b8] text-sm">
          No accounts watched yet. Open an account detail page and click Watch to track score changes.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#f1f5f9] mb-3">
        Watched Accounts
      </h2>
      <ul className="space-y-2">
        {watchedAccounts.map((watched) => {
          const currentReport = reports.find(
            (r) => r.company_name === watched.company_name
          );

          const inLatestRun = currentReport !== undefined;
          const currentScore = currentReport?.opportunity_score ?? null;
          const delta =
            currentScore !== null
              ? computeScoreDelta(watched.stored_score, currentScore)
              : null;
          const significant = delta !== null && isSignificantDelta(delta);

          return (
            <li
              key={watched.company_name}
              className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                significant
                  ? 'border-amber-500/50 bg-amber-500/10'
                  : 'border-[#334155] bg-[#0f172a]'
              }`}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-[#f1f5f9] truncate">
                  {watched.company_name}
                </p>
                <p className="text-xs text-[#94a3b8] mt-0.5">
                  Stored score: {watched.stored_score}
                </p>
              </div>

              <div className="flex-shrink-0 text-right">
                {!inLatestRun ? (
                  <span className="text-xs text-[#64748b] italic">
                    Not in latest run
                  </span>
                ) : (
                  <div className="flex flex-col items-end gap-0.5">
                    <span className="text-sm font-semibold text-[#f1f5f9]">
                      {currentScore}
                    </span>
                    {delta !== null && (
                      <span
                        className={`text-xs font-medium ${
                          delta > 0
                            ? 'text-green-400'
                            : delta < 0
                            ? 'text-red-400'
                            : 'text-[#94a3b8]'
                        }`}
                        aria-label={`Score change: ${delta > 0 ? '+' : ''}${delta}`}
                      >
                        {delta > 0 ? '+' : ''}
                        {delta}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
