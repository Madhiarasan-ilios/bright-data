'use client';

import type { GTMReport } from '@/lib/types';

interface PriorityTierGroupsProps {
  reports: GTMReport[];
}

interface TierConfig {
  label: string;
  emoji: string;
  tagline: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  borderColor: string;
  bgColor: string;
  textColor: string;
  countColor: string;
}

const TIERS: TierConfig[] = [
  {
    label: 'HIGH',
    emoji: '🔴',
    tagline: 'Engage Now',
    priority: 'HIGH',
    borderColor: 'border-red-500/30',
    bgColor: 'bg-red-500/10',
    textColor: 'text-red-400',
    countColor: 'text-red-300',
  },
  {
    label: 'MEDIUM',
    emoji: '🟡',
    tagline: 'Nurture & Watch',
    priority: 'MEDIUM',
    borderColor: 'border-amber-500/30',
    bgColor: 'bg-amber-500/10',
    textColor: 'text-amber-400',
    countColor: 'text-amber-300',
  },
  {
    label: 'LOW',
    emoji: '⚪',
    tagline: 'Monitor',
    priority: 'LOW',
    borderColor: 'border-slate-500/30',
    bgColor: 'bg-slate-500/10',
    textColor: 'text-slate-400',
    countColor: 'text-slate-300',
  },
];

/**
 * Displays three priority tier sections (HIGH / MEDIUM / LOW) with
 * emoji labels, taglines, and account counts.
 */
export function PriorityTierGroups({ reports }: PriorityTierGroupsProps) {
  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#f1f5f9] mb-4">
        Priority Tiers
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {TIERS.map((tier) => {
          const count = reports.filter(
            (r) => r.priority === tier.priority
          ).length;

          return (
            <div
              key={tier.label}
              className={`rounded-lg border p-4 ${tier.borderColor} ${tier.bgColor}`}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg" aria-hidden="true">
                  {tier.emoji}
                </span>
                <span className={`text-xs font-semibold uppercase tracking-wide ${tier.textColor}`}>
                  {tier.label}
                </span>
              </div>
              <p className={`text-2xl font-bold ${tier.countColor}`}>{count}</p>
              <p className="text-xs text-[#94a3b8] mt-1">{tier.tagline}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
