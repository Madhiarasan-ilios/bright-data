import { PriorityBadge } from '@/components/ui/PriorityBadge';
import { getScoreColor } from '@/lib/utils/scoreColor';
import type { GTMReport } from '@/lib/types';

interface CompanyHeaderCardProps {
  report: GTMReport;
}

const scoreColorClasses: Record<'green' | 'amber' | 'grey', string> = {
  green: 'text-green-400',
  amber: 'text-amber-400',
  grey: 'text-slate-400',
};

export function CompanyHeaderCard({ report }: CompanyHeaderCardProps) {
  const color = getScoreColor(report.opportunity_score);
  const scoreClass = scoreColorClasses[color];

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-[#f1f5f9] leading-tight">
            {report.company_name}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge
              priority={report.priority === 'UNKNOWN' ? 'LOW' : report.priority}
            />
            <span className="text-sm text-[#94a3b8]">{report.buying_stage}</span>
          </div>
        </div>
        <div className="flex flex-col items-start sm:items-end gap-1">
          <span className="text-xs text-[#94a3b8] uppercase tracking-wide">
            Opportunity Score
          </span>
          <span className={`text-4xl font-bold tabular-nums ${scoreClass}`}>
            {Math.round(report.opportunity_score)}
          </span>
        </div>
      </div>
    </div>
  );
}
