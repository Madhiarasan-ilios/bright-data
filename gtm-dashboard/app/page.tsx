'use client';

import dynamic from 'next/dynamic';
import { useEffect } from 'react';
import { TopNav } from '@/components/layout/TopNav';
import { KPICardGrid } from '@/components/executive/KPICardGrid';
import { WatchedAccountsSection } from '@/components/executive/WatchedAccountsSection';
import { PriorityTierGroups } from '@/components/executive/PriorityTierGroups';
import { OpportunityLeaderboard } from '@/components/executive/OpportunityLeaderboard';
import { ScoreDistributionChart } from '@/components/executive/ScoreDistributionChart';
import { FunnelViewChart } from '@/components/executive/FunnelViewChart';
import { EmptyState } from '@/components/ui/EmptyState';
import { useGTMStore } from '@/lib/store';

// Dynamic imports for components that use browser APIs (no SSR)
const CompanyInputForm = dynamic(
  () =>
    import('@/components/upload/CompanyInputForm').then(
      (m) => m.CompanyInputForm
    ),
  { ssr: false }
);

const PipelineStatusBanner = dynamic(
  () =>
    import('@/components/upload/PipelineStatusBanner').then(
      (m) => m.PipelineStatusBanner
    ),
  { ssr: false }
);

/**
 * Executive Command Center — the main dashboard page.
 * Composes all executive-level panels and the upload form.
 * On mount, loads the most recent completed job from the API if the
 * Zustand store is empty (handles page refresh / direct navigation).
 */
export default function ExecutiveCommandCenterPage() {
  const reports = useGTMStore((s) => s.reports);
  const loadReportsFromApi = useGTMStore((s) => s.loadReportsFromApi);

  // On mount, if the store has no reports, try to load the most recent
  // completed job from the backend so the dashboard isn't blank after a refresh.
  useEffect(() => {
    if (reports.length > 0) return;
    loadReportsFromApi().catch(() => {
      // Silently ignore — backend may not be running yet
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasReports = reports.length > 0;

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
      <TopNav />

      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Upload form and pipeline status */}
        <div className="space-y-3">
          <CompanyInputForm />
          <PipelineStatusBanner />
        </div>

        {/* Empty state when no reports are loaded */}
        {!hasReports ? (
          <EmptyState message="No accounts analysed yet. Upload a list of companies to get started." />
        ) : (
          <>
            {/* KPI summary row */}
            <KPICardGrid reports={reports} />

            {/* Watched accounts */}
            <WatchedAccountsSection />

            {/* Priority tiers */}
            <PriorityTierGroups reports={reports} />

            {/* Leaderboard — full width */}
            <OpportunityLeaderboard reports={reports} />

            {/* Charts row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ScoreDistributionChart reports={reports} />
              <FunnelViewChart reports={reports} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
