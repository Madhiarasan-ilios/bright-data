'use client';

import { useEffect } from 'react';
import { useGTMStore } from '@/lib/store';
import { getDemoStepForNode } from '@/lib/utils/demoFlowMapping';

const STEPS: { step: number; label: string }[] = [
  { step: 1, label: 'Upload Accounts' },
  { step: 2, label: 'Live LangGraph Orchestration' },
  { step: 3, label: 'Parallel Collectors' },
  { step: 4, label: 'Score Aggregation' },
  { step: 5, label: 'Conditional Routing' },
  { step: 6, label: 'Competitive Analysis' },
  { step: 7, label: 'Sales Brief Generation' },
  { step: 8, label: 'Executive Dashboard' },
];

export function DemoFlowStepper() {
  const demoStep = useGTMStore((s) => s.demoStep);
  const demoAutoMode = useGTMStore((s) => s.demoAutoMode);
  const setDemoStep = useGTMStore((s) => s.setDemoStep);
  const nodeEvents = useGTMStore((s) => s.nodeEvents);

  // Task 17.2: Auto-advance logic — watch nodeEvents and advance demo step
  useEffect(() => {
    if (nodeEvents.length === 0) return;

    const lastEvent = nodeEvents[nodeEvents.length - 1];
    const step = getDemoStepForNode(lastEvent.node);

    if (step !== null && demoAutoMode) {
      // Call without manual=true so auto mode stays active
      setDemoStep(step);
    }
    // If step is null, leave demoStep unchanged
  }, [nodeEvents.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleStepClick(step: number) {
    // manual=true disables auto mode
    setDemoStep(step, true);
  }

  function handleResetAuto() {
    // Reset to step 1 and re-enable auto mode
    setDemoStep(1, false);
    // Re-enable auto mode by directly patching the store
    useGTMStore.setState({ demoAutoMode: true });
  }

  return (
    <div className="flex items-center gap-2 overflow-x-auto py-1 px-1">
      <div className="flex gap-1 flex-nowrap">
        {STEPS.map(({ step, label }) => {
          const isActive = demoStep === step;
          return (
            <button
              key={step}
              onClick={() => handleStepClick(step)}
              className={[
                'flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-amber-500 text-amber-950'
                  : 'bg-[#334155] text-[#94a3b8] hover:bg-[#475569] hover:text-[#f1f5f9]',
              ].join(' ')}
              aria-current={isActive ? 'step' : undefined}
            >
              <span className="font-bold">{step}</span>
              <span>{label}</span>
            </button>
          );
        })}
      </div>

      {!demoAutoMode && (
        <button
          onClick={handleResetAuto}
          className="flex-shrink-0 text-xs text-[#94a3b8] hover:text-[#f1f5f9] border border-[#334155] hover:border-[#64748b] px-2.5 py-1 rounded-md transition-colors whitespace-nowrap"
        >
          Reset to Auto
        </button>
      )}
    </div>
  );
}
