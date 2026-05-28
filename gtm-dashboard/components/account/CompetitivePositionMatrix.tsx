'use client';

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ResponsiveContainer,
} from 'recharts';
import { lockInToX } from '@/lib/utils/lockInCoordinate';
import type { CompetitorIntel } from '@/lib/types';

interface CompetitivePositionMatrixProps {
  competitorIntel: CompetitorIntel | null;
  anthropicFitScore?: number;
  /** lock_in_strength from the competitive_openness signal */
  lockInStrength?: string;
  companyName: string;
}

export function CompetitivePositionMatrix({
  competitorIntel,
  anthropicFitScore,
  lockInStrength,
  companyName,
}: CompetitivePositionMatrixProps) {
  if (!competitorIntel) return null;

  const x = lockInToX(lockInStrength ?? 'none');
  const y = anthropicFitScore ?? 50;

  // Dummy scatter data so the chart renders axes properly
  const data = [{ x, y }];

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Competitive Position Matrix
      </h2>
      <ResponsiveContainer width="100%" height={220}>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
          <CartesianGrid stroke="#334155" strokeDasharray="3 3" />
          <XAxis
            type="number"
            dataKey="x"
            domain={[0, 100]}
            name="Lock-In Strength"
            label={{
              value: 'Lock-In Strength',
              position: 'insideBottom',
              offset: -10,
              fill: '#94a3b8',
              fontSize: 11,
            }}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <YAxis
            type="number"
            dataKey="y"
            domain={[0, 100]}
            name="Anthropic Fit Score"
            label={{
              value: 'Anthropic Fit',
              angle: -90,
              position: 'insideLeft',
              fill: '#94a3b8',
              fontSize: 11,
            }}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
          />
          <Scatter data={data} fill="#f59e0b" />
          <ReferenceDot
            x={x}
            y={y}
            r={8}
            fill="#f59e0b"
            stroke="#f1f5f9"
            strokeWidth={2}
            label={{
              value: companyName,
              position: 'top',
              fill: '#f1f5f9',
              fontSize: 11,
            }}
          />
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
