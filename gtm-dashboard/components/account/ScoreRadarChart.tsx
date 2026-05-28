'use client';

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import type { ScoreBreakdown } from '@/lib/types';

interface ScoreRadarChartProps {
  scoreBreakdown: ScoreBreakdown;
}

interface RadarDataPoint {
  subject: string;
  value: number;
  fullMark: number;
}

export function ScoreRadarChart({ scoreBreakdown }: ScoreRadarChartProps) {
  const data: RadarDataPoint[] = [
    {
      subject: 'Buying Intent',
      value: scoreBreakdown.buying_intent,
      fullMark: 40,
    },
    {
      subject: 'Foundation Model Eval',
      value: scoreBreakdown.foundation_model_eval,
      fullMark: 25,
    },
    {
      subject: 'Safety & Gov',
      value: scoreBreakdown.safety_gov_alignment,
      fullMark: 20,
    },
    {
      subject: 'Competitive Openness',
      value: scoreBreakdown.competitive_openness,
      fullMark: 15,
    },
  ];

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Score Breakdown
      </h2>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
          <PolarGrid stroke="#334155" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: '#f1f5f9', fontSize: 11 }}
          />
          <Radar
            name="Score"
            dataKey="value"
            stroke="#f59e0b"
            fill="#f59e0b"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
