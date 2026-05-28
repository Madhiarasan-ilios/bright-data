'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { computeDealPrediction } from '@/lib/utils/dealPrediction';
import type { CompetitorIntel } from '@/lib/types';

interface DealPredictionPanelProps {
  competitorIntel: CompetitorIntel | null;
}

const VENDOR_COLORS = ['#22c55e', '#f59e0b', '#64748b'];

export function DealPredictionPanel({ competitorIntel }: DealPredictionPanelProps) {
  if (!competitorIntel) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">Deal prediction not available</p>
      </div>
    );
  }

  const prediction = computeDealPrediction(competitorIntel);

  if (!prediction) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">Deal prediction not available</p>
      </div>
    );
  }

  const primaryName = competitorIntel.primary_competitor || 'Competitor';

  const data = [
    { vendor: 'Anthropic', value: prediction.anthropic },
    { vendor: primaryName, value: prediction.primary },
    { vendor: 'Other', value: prediction.other },
  ];

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Deal Prediction
      </h2>
      <ResponsiveContainer width="100%" height={120}>
        <BarChart
          layout="vertical"
          data={data}
          margin={{ top: 4, right: 40, bottom: 4, left: 8 }}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickFormatter={(v) => `${v}%`}
          />
          <YAxis
            type="category"
            dataKey="vendor"
            width={90}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{ background: '#1e293b', border: '1px solid #334155', color: '#f1f5f9' }}
            formatter={(value) => [`${value}%`, 'Win Probability']}
          />
          <Bar dataKey="value" radius={[0, 4, 4, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={VENDOR_COLORS[index]} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v) => `${v}%`}
              style={{ fill: '#f1f5f9', fontSize: 11 }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
