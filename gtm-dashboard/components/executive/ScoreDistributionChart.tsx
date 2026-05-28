'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { computeScoreDistribution } from '@/lib/utils/scoreDistribution';
import type { GTMReport } from '@/lib/types';

interface ScoreDistributionChartProps {
  reports: GTMReport[];
}

/** Amber gradient shades for the five bars */
const BAR_COLORS = [
  '#fde68a', // lightest amber
  '#fcd34d',
  '#fbbf24',
  '#f59e0b',
  '#d97706', // darkest amber
];

/**
 * Bar chart showing the distribution of opportunity scores across five buckets.
 * Uses computeScoreDistribution to derive bucket counts.
 * Dark theme with amber gradient bars.
 */
export function ScoreDistributionChart({ reports }: ScoreDistributionChartProps) {
  const { buckets } = computeScoreDistribution(reports);

  const data = buckets.map((b) => ({ label: b.label, count: b.count }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">
        Score Distribution
      </h2>
      <ResponsiveContainer width="100%" height={200}>
        <BarChart
          data={data}
          margin={{ top: 4, right: 8, left: -16, bottom: 0 }}
        >
          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            cursor={{ fill: 'rgba(51,65,85,0.4)' }}
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Bar dataKey="count" radius={[4, 4, 0, 0]}>
            {data.map((_, index) => (
              <Cell key={index} fill={BAR_COLORS[index]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
