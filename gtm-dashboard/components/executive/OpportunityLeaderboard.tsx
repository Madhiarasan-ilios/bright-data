'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { sortLeaderboard } from '@/lib/utils/leaderboard';
import type { GTMReport, LeaderboardRow } from '@/lib/types';

interface OpportunityLeaderboardProps {
  reports: GTMReport[];
}

type SortKey = keyof LeaderboardRow;
type SortDir = 'asc' | 'desc';

/**
 * Sortable leaderboard table showing Company, Score, Priority,
 * Buying Stage, and Win Probability columns.
 * Clicking a row navigates to /accounts/[company].
 */
export function OpportunityLeaderboard({ reports }: OpportunityLeaderboardProps) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const baseRows = sortLeaderboard(reports);

  const rows = [...baseRows].sort((a, b) => {
    const av = a[sortKey];
    const bv = b[sortKey];
    let cmp = 0;
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv;
    } else {
      cmp = String(av).localeCompare(String(bv));
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  function sortIndicator(key: SortKey) {
    if (key !== sortKey) return <span className="ml-1 text-[#475569]">↕</span>;
    return (
      <span className="ml-1 text-[#f59e0b]">
        {sortDir === 'asc' ? '↑' : '↓'}
      </span>
    );
  }

  const thClass =
    'px-4 py-3 text-left text-xs font-medium text-[#94a3b8] uppercase tracking-wide cursor-pointer select-none hover:text-[#f1f5f9] transition-colors whitespace-nowrap';

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-[#334155]">
        <h2 className="text-sm font-semibold text-[#f1f5f9]">
          Opportunity Leaderboard
        </h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0f172a]">
            <tr>
              <th className={thClass} onClick={() => handleSort('company')}>
                Company {sortIndicator('company')}
              </th>
              <th className={thClass} onClick={() => handleSort('score')}>
                Score {sortIndicator('score')}
              </th>
              <th className={thClass} onClick={() => handleSort('priority')}>
                Priority {sortIndicator('priority')}
              </th>
              <th className={thClass} onClick={() => handleSort('buyingStage')}>
                Buying Stage {sortIndicator('buyingStage')}
              </th>
              <th className={thClass} onClick={() => handleSort('winProbability')}>
                Win Probability {sortIndicator('winProbability')}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#334155]">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-[#94a3b8] text-sm"
                >
                  No accounts to display.
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.company}
                  onClick={() =>
                    router.push(
                      `/accounts/${encodeURIComponent(row.company)}`
                    )
                  }
                  className="cursor-pointer hover:bg-[#334155]/50 transition-colors"
                >
                  <td className="px-4 py-3 font-medium text-[#f1f5f9] whitespace-nowrap">
                    {row.company}
                  </td>
                  <td className="px-4 py-3 text-[#f59e0b] font-semibold">
                    {row.score}
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={row.priority} />
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8] whitespace-nowrap">
                    {row.buyingStage}
                  </td>
                  <td className="px-4 py-3 text-[#94a3b8]">
                    {Math.round(row.winProbability)}%
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
