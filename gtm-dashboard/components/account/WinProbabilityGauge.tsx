'use client';

import {
  RadialBarChart,
  RadialBar,
  ResponsiveContainer,
} from 'recharts';

interface WinProbabilityGaugeProps {
  winProbability: number | null;
}

export function WinProbabilityGauge({ winProbability }: WinProbabilityGaugeProps) {
  // Only null suppresses the gauge — winProbability === 0 intentionally renders
  // the arc at 0% fill with amber colour and the "0%" label (Req 5.3, 5.4).
  if (winProbability === null) return null;

  // amber when < 50 (covers 0%), green when >= 50
  const fill = winProbability >= 50 ? '#22c55e' : '#f59e0b';
  const data = [{ value: winProbability, fill }];

  return (
    <div className="flex flex-col items-center">
      <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-1">
        Win Probability
      </p>
      <div className="relative w-full" style={{ height: 180 }}>
        <ResponsiveContainer width="100%" height={180}>
          <RadialBarChart
            cx="50%"
            cy="80%"
            innerRadius="60%"
            outerRadius="100%"
            startAngle={180}
            endAngle={0}
            data={data}
            barSize={16}
          >
            {/* Background track */}
            <RadialBar
              dataKey="value"
              cornerRadius={8}
              background={{ fill: '#334155' }}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Centered percentage label */}
        <div
          className="absolute inset-x-0 flex justify-center"
          style={{ bottom: 8 }}
        >
          <span className="text-2xl font-bold tabular-nums" style={{ color: fill }}>
            {winProbability}%
          </span>
        </div>
      </div>
    </div>
  );
}
