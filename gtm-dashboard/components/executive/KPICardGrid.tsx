'use client';

import { KPICard } from '@/components/ui/KPICard';
import { computeKPIs } from '@/lib/utils/kpi';
import type { GTMReport } from '@/lib/types';

interface KPICardGridProps {
  reports: GTMReport[];
  isLoading?: boolean;
}

/**
 * Renders five KPI cards for the Executive Command Center.
 * Uses computeKPIs to derive values from the reports array.
 * Shows skeleton state on each card while isLoading is true.
 */
export function KPICardGrid({ reports, isLoading = false }: KPICardGridProps) {
  const kpis = computeKPIs(reports);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <KPICard
        title="Accounts Analyzed"
        value={kpis.accountsAnalyzed}
        isLoading={isLoading}
      />
      <KPICard
        title="High Priority"
        value={kpis.highPriority}
        isLoading={isLoading}
      />
      <KPICard
        title="Avg Opportunity Score"
        value={kpis.avgOpportunityScore}
        isLoading={isLoading}
      />
      <KPICard
        title="Deep Research Accounts"
        value={kpis.deepResearchAccounts}
        isLoading={isLoading}
      />
      <KPICard
        title="Avg Win Probability"
        value={`${kpis.avgWinProbability}%`}
        isLoading={isLoading}
      />
    </div>
  );
}
