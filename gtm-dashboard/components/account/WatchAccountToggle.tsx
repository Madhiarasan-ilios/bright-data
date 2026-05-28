'use client';

import { useGTMStore } from '@/lib/store';

interface WatchAccountToggleProps {
  companyName: string;
  currentScore: number;
}

export function WatchAccountToggle({ companyName, currentScore }: WatchAccountToggleProps) {
  const watchedAccounts = useGTMStore((s) => s.watchedAccounts);
  const toggleWatchAccount = useGTMStore((s) => s.toggleWatchAccount);

  const isWatched = watchedAccounts.some((a) => a.company_name === companyName);

  function handleToggle() {
    toggleWatchAccount(companyName, currentScore);
  }

  return (
    <button
      onClick={handleToggle}
      className={
        isWatched
          ? 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium bg-[#f59e0b] text-[#0f172a] transition-colors focus:outline-none focus:ring-2 focus:ring-amber-500/50'
          : 'inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium border border-[#334155] text-[#94a3b8] transition-colors hover:bg-[#334155] focus:outline-none focus:ring-2 focus:ring-amber-500/50'
      }
      aria-pressed={isWatched}
    >
      {isWatched ? 'Unwatch Account' : 'Watch Account'}
    </button>
  );
}
