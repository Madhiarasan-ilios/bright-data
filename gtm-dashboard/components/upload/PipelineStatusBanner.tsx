'use client';

import { useEffect, useRef } from 'react';
import { useGTMStore } from '@/lib/store';
import { getReports, getAllReports } from '@/lib/api-client';
import { useSSEStream } from '@/hooks/useSSEStream';

/**
 * Banner that reflects the current pipeline and SSE connection status.
 * Also owns the SSE connection — subscribes to the active job stream,
 * dispatches node events to the store, and fetches reports on completion.
 *
 * Completion detection: polls GET /api/reports every 2s while running,
 * and also triggers immediately when the SSE stream closes (EOF received).
 *
 * - Hidden when jobStatus === 'idle'
 * - Loading spinner + "Pipeline running..." while jobStatus === 'running'
 * - Reconnection indicator when connectionStatus === 'connecting' (after initial connect)
 * - Permanent error "Connection lost. Please retry." when connectionStatus === 'error'
 * - Error message + Retry button when jobStatus === 'failed'
 * - Success "Analysis complete!" when jobStatus === 'completed'
 */
export function PipelineStatusBanner() {
  const jobStatus = useGTMStore((s) => s.jobStatus);
  const connectionStatus = useGTMStore((s) => s.connectionStatus);
  const activeJobId = useGTMStore((s) => s.activeJobId);
  const setJobStatus = useGTMStore((s) => s.setJobStatus);
  const setReports = useGTMStore((s) => s.setReports);

  // Open the SSE stream whenever there is an active running job.
  // The hook dispatches appendNodeEvent for each SSE message.
  useSSEStream(jobStatus === 'running' ? activeJobId : null);

  // Poll the backend every 2 seconds while the pipeline is running to detect
  // completion. This is more reliable than relying solely on SSE events because:
  //  - The backend may emit dashboard_output multiple times (one per company)
  //  - We need all reports to be persisted before fetching
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (jobStatus !== 'running' || !activeJobId) {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
      return;
    }

    async function checkCompletion() {
      if (!activeJobId) return;
      try {
        // GET /api/reports returns the list of all jobs; check if ours is done
        const jobs = await getAllReports();
        const job = jobs.find((j) => j.job_id === activeJobId);
        if (!job) return;

        if (job.status === 'completed') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          const reports = await getReports(activeJobId);
          setReports(reports);
          setJobStatus('completed');
        } else if (job.status === 'failed') {
          if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
          }
          setJobStatus('failed');
        }
      } catch {
        // Ignore transient fetch errors during polling
      }
    }

    // Poll immediately, then every 2 seconds
    checkCompletion();
    pollRef.current = setInterval(checkCompletion, 2000);

    return () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobStatus, activeJobId, setReports, setJobStatus]);

  function handleRetry() {
    setJobStatus('idle');
  }

  // Hidden when idle
  if (jobStatus === 'idle') return null;

  // Connection lost permanently
  if (connectionStatus === 'error') {
    return (
      <div
        role="alert"
        className="flex items-center gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
      >
        <span className="text-base" aria-hidden="true">⚠️</span>
        <span>Connection lost. Please retry.</span>
      </div>
    );
  }

  // Reconnecting
  if (connectionStatus === 'connecting' && jobStatus === 'running') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400"
      >
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-amber-400 border-t-transparent"
          aria-hidden="true"
        />
        <span>Reconnecting to pipeline stream…</span>
      </div>
    );
  }

  // Pipeline running
  if (jobStatus === 'running') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-[#334155] bg-[#1e293b] px-4 py-3 text-sm text-[#94a3b8]"
      >
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[#f59e0b] border-t-transparent"
          aria-hidden="true"
        />
        <span className="text-[#f1f5f9]">Pipeline running…</span>
      </div>
    );
  }

  // Analysis failed
  if (jobStatus === 'failed') {
    return (
      <div
        role="alert"
        className="flex items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
      >
        <div className="flex items-center gap-2">
          <span className="text-base" aria-hidden="true">✕</span>
          <span>Analysis failed. Please check your input and try again.</span>
        </div>
        <button
          onClick={handleRetry}
          className="flex-shrink-0 rounded-md border border-red-500/40 bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
        >
          Retry
        </button>
      </div>
    );
  }

  // Analysis completed
  if (jobStatus === 'completed') {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-400"
      >
        <span className="text-base" aria-hidden="true">✓</span>
        <span>Analysis complete!</span>
      </div>
    );
  }

  return null;
}
