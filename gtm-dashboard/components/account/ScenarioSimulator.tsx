'use client';

import { useState } from 'react';
import { computeSimulatedScore } from '@/lib/utils/scenarioSimulator';
import type { GTMReport } from '@/lib/types';

interface ScenarioSimulatorProps {
  report: GTMReport;
}

interface SliderConfig {
  label: string;
  key: keyof ScenarioSimulatorProps['report']['score_breakdown'];
  min: number;
  max: number;
}

const SLIDERS: SliderConfig[] = [
  { label: 'Buying Intent', key: 'buying_intent', min: 0, max: 40 },
  { label: 'Foundation Model Eval', key: 'foundation_model_eval', min: 0, max: 25 },
  { label: 'Safety & Gov Alignment', key: 'safety_gov_alignment', min: 0, max: 20 },
  { label: 'Competitive Openness', key: 'competitive_openness', min: 0, max: 15 },
];

export function ScenarioSimulator({ report }: ScenarioSimulatorProps) {
  const sb = report.score_breakdown;

  const [buying, setBuying] = useState(sb.buying_intent);
  const [foundation, setFoundation] = useState(sb.foundation_model_eval);
  const [safety, setSafety] = useState(sb.safety_gov_alignment);
  const [competitive, setCompetitive] = useState(sb.competitive_openness);

  const simulated = computeSimulatedScore(buying, foundation, safety, competitive);
  const original = report.opportunity_score;

  const setters = [setBuying, setFoundation, setSafety, setCompetitive];
  const values = [buying, foundation, safety, competitive];

  function handleReset() {
    setBuying(sb.buying_intent);
    setFoundation(sb.foundation_model_eval);
    setSafety(sb.safety_gov_alignment);
    setCompetitive(sb.competitive_openness);
  }

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6 space-y-5">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">
        Scenario Simulator
      </h2>

      <div className="space-y-4">
        {SLIDERS.map((slider, i) => (
          <div key={slider.key} className="space-y-1">
            <div className="flex justify-between text-xs text-[#94a3b8]">
              <span>{slider.label}</span>
              <span className="tabular-nums font-medium text-[#f1f5f9]">
                {values[i]} / {slider.max}
              </span>
            </div>
            <input
              type="range"
              min={slider.min}
              max={slider.max}
              value={values[i]}
              onChange={(e) => setters[i](Number(e.target.value))}
              className="w-full accent-[#f59e0b] cursor-pointer"
              aria-label={slider.label}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-6">
          <div className="text-center">
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide">Simulated</p>
            <p className="text-2xl font-bold tabular-nums text-[#f59e0b]">{simulated}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-[#94a3b8] uppercase tracking-wide">Original</p>
            <p className="text-2xl font-bold tabular-nums text-[#f1f5f9]">{Math.round(original)}</p>
          </div>
        </div>
        <button
          onClick={handleReset}
          className="text-xs text-[#94a3b8] hover:text-[#f1f5f9] border border-[#334155] hover:border-[#64748b] px-3 py-1.5 rounded-lg transition-colors"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
