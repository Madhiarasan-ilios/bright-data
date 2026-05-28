'use client';

import { useEffect, useRef, useState } from 'react';
import { useGTMStore } from '@/lib/store';
import { ScoreChangeBanner, type ScoreChange } from '@/components/ui/ScoreChangeBanner';
import { computeScoreDelta, isSignificantDelta } from '@/lib/utils/scoreDelta';

/**
 * Client component that subscribes to jobStatus in the GTM store.
 * When a job transitions to 'completed', it compares current report scores
 * against watched account stored scores and surfaces significant changes
 * via ScoreChangeBanner.
 */
export function ScoreChangeBannerWrapper() {
  const jobStatus = useGTMStore((s) => s.jobStatus);
  const reports = useGTMStore((s) => s.reports);
  const watchedAccounts = useGTMStore((s) => s.watchedAccounts);

  const [changes, setChanges] = useState<ScoreChange[]>([]);
  const prevJobStatus = useRef<string>(jobStatus);

  useEffect(() => {
    // Only fire when jobStatus transitions TO 'completed'
    if (jobStatus === 'completed' && prevJobStatus.current !== 'completed') {
      const significant: ScoreChange[] = [];

      for (const watched of watchedAccounts) {
        const report = reports.find(
          (r) => r.company_name.toLowerCase() === watched.company_name.toLowerCase()
        );
        if (!report) continue;

        const delta = computeScoreDelta(watched.stored_score, report.opportunity_score);
        if (isSignificantDelta(delta)) {
          significant.push({
            company: report.company_name,
            delta: Math.round(delta),
            newScore: Math.round(report.opportunity_score),
          });
        }
      }

      if (significant.length > 0) {
        setChanges(significant);
      }
    }

    prevJobStatus.current = jobStatus;
  }, [jobStatus, reports, watchedAccounts]);

  return <ScoreChangeBanner changes={changes} />;
}
