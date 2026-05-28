'use client';

import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { computeFunnelStages } from '@/lib/utils/funnel';
import type { GTMReport } from '@/lib/types';

interface FunnelViewChartProps {
  reports: GTMReport[];
}

/** Amber/orange shades for the five funnel stages */
const STAGE_COLORS = [
  '#f59e0b', // Accounts — amber
  '#f97316', // Signal Detected — orange
  '#ea580c', // Opportunity Scored — deeper orange
  '#dc2626', // Deep Research Triggered — red-orange
  '#b45309', // Sales Ready — dark amber
];

/**
 * Funnel chart showing the GTM pipeline stages.
 * Uses computeFunnelStages to derive stage counts.
 * Dark theme with amber/orange gradient stages.
 */
export function FunnelViewChart({ reports }: FunnelViewChartProps) {
  const stages = computeFunnelStages(reports);

  const data = stages.map((stage, i) => ({
    name: stage.name,
    value: stage.count,
    fill: STAGE_COLORS[i],
  }));

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">
        Pipeline Funnel
      </h2>
      <ResponsiveContainer width="100%" height={250}>
        <FunnelChart>
          <Tooltip
            contentStyle={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 6,
              color: '#f1f5f9',
              fontSize: 12,
            }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <Funnel dataKey="value" data={data} isAnimationActive>
            <LabelList
              position="right"
              fill="#94a3b8"
              stroke="none"
              dataKey="name"
              style={{ fontSize: 11 }}
            />
          </Funnel>
        </FunnelChart>
      </ResponsiveContainer>
    </div>
  );
}
