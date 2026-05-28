'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useGTMStore } from '@/lib/store';
import { TopNav } from '@/components/layout/TopNav';
import { CompanyHeaderCard } from '@/components/account/CompanyHeaderCard';
import { WatchAccountToggle } from '@/components/account/WatchAccountToggle';
import { ScoreRadarChart } from '@/components/account/ScoreRadarChart';
import { ScoreExplanationPanel } from '@/components/account/ScoreExplanationPanel';
import { SignalExplorerPanel } from '@/components/account/SignalExplorerPanel';
import { CompetitorIntelPanel } from '@/components/account/CompetitorIntelPanel';
import { WinProbabilityGauge } from '@/components/account/WinProbabilityGauge';
import { CompetitivePositionMatrix } from '@/components/account/CompetitivePositionMatrix';
import { DeepResearchPanel } from '@/components/account/DeepResearchPanel';
import { SalesCopilotPanel } from '@/components/account/SalesCopilotPanel';
import { ResearchEvidencePanel } from '@/components/account/ResearchEvidencePanel';
import { ScenarioSimulator } from '@/components/account/ScenarioSimulator';
import { DealPredictionPanel } from '@/components/account/DealPredictionPanel';
import { SkeletonBlock } from '@/components/ui/SkeletonBlock';
import { normaliseWinProbability } from '@/lib/utils/normalise';
import type { GTMReport, TechstackSignal, CompetitiveOpennessSignal } from '@/lib/types';

interface AccountDetailPageProps {
  params: Promise<{ company: string }>;
}

export default function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { company } = use(params);
  const companyName = decodeURIComponent(company);

  const storeReports = useGTMStore((s) => s.reports);
  const loadReportsFromApi = useGTMStore((s) => s.loadReportsFromApi);

  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // If the store has no reports (e.g. direct navigation / page refresh),
  // try to load the most recent completed job from the API.
  useEffect(() => {
    async function loadReports() {
      // Already have reports in store — no need to fetch
      if (storeReports.length > 0) {
        setIsLoading(false);
        return;
      }

      try {
        await loadReportsFromApi();
      } catch (err) {
        setFetchError(
          err instanceof Error ? err.message : 'Failed to load reports.'
        );
      } finally {
        setIsLoading(false);
      }
    }

    loadReports();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Find the report for this company from the store
  const report: GTMReport | undefined = storeReports.find(
    (r) => r.company_name.toLowerCase() === companyName.toLowerCase()
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
        <TopNav breadcrumb={{ label: companyName, href: '' }} />
        <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          <SkeletonBlock className="h-24 w-full" />
          <SkeletonBlock className="h-10 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonBlock className="h-64" />
            <SkeletonBlock className="h-64" />
          </div>
          <SkeletonBlock className="h-48 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-48" />
          </div>
          <SkeletonBlock className="h-48 w-full" />
          <SkeletonBlock className="h-48 w-full" />
          <SkeletonBlock className="h-48 w-full" />
          <SkeletonBlock className="h-48 w-full" />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SkeletonBlock className="h-48" />
            <SkeletonBlock className="h-48" />
          </div>
        </main>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
        <TopNav breadcrumb={{ label: companyName, href: '' }} />
        <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
          <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-8 text-center space-y-4">
            <h1 className="text-xl font-semibold text-[#f1f5f9]">Account not found</h1>
            <p className="text-[#94a3b8] text-sm">
              {fetchError
                ? `Error loading data: ${fetchError}`
                : `No report found for "${companyName}". Run an analysis first.`}
            </p>
            <Link
              href="/"
              className="inline-block text-sm text-[#f59e0b] hover:underline"
            >
              ← Back to dashboard
            </Link>
          </div>
        </main>
      </div>
    );
  }

  // Extract anthropicFitScore and lockInStrength from signals if available
  const techstackSignal = report.signals.find((s) => s.type === 'techstack') as
    | TechstackSignal
    | undefined;
  const anthropicFitScore = techstackSignal?.anthropic_fit_score;

  const compOpenSignal = report.signals.find((s) => s.type === 'competitive_openness') as
    | CompetitiveOpennessSignal
    | undefined;
  const lockInStrength = compOpenSignal?.lock_in_strength;

  // Normalise win probability via shared utility (Req 5.2)
  const rawWinProb = report.competitor_intel?.win_probability ?? null;
  const winProbability = rawWinProb !== null ? normaliseWinProbability(rawWinProb) : null;

  return (
    <div className="min-h-screen bg-[#0f172a] overflow-x-hidden">
      <TopNav breadcrumb={{ label: companyName, href: '' }} />
      <main className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* 1. Company header */}
        <CompanyHeaderCard report={report} />

        {/* 2. Watch toggle */}
        <WatchAccountToggle
          companyName={report.company_name}
          currentScore={report.opportunity_score}
        />

        {/* 3. Score radar + explanation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScoreRadarChart scoreBreakdown={report.score_breakdown} />
          <ScoreExplanationPanel explanation={report.score_explanation} />
        </div>

        {/* 4. Signal explorer — full width */}
        <SignalExplorerPanel report={report} />

        {/* 5. Competitor intel + win probability gauge */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CompetitorIntelPanel competitorIntel={report.competitor_intel} />
          <div className="bg-[#1e293b] border border-[#334155] rounded-xl p-6">
            <WinProbabilityGauge winProbability={winProbability} />
          </div>
        </div>

        {/* 6. Competitive position matrix — full width */}
        <CompetitivePositionMatrix
          competitorIntel={report.competitor_intel}
          anthropicFitScore={anthropicFitScore}
          lockInStrength={lockInStrength}
          companyName={report.company_name}
        />

        {/* 7. Deep research — full width */}
        <DeepResearchPanel report={report} />

        {/* 8. Sales copilot — full width */}
        <SalesCopilotPanel report={report} />

        {/* 9. Research evidence — full width */}
        <ResearchEvidencePanel report={report} />

        {/* 10. Scenario simulator + deal prediction */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ScenarioSimulator report={report} />
          <DealPredictionPanel competitorIntel={report.competitor_intel} />
        </div>
      </main>
    </div>
  );
}
