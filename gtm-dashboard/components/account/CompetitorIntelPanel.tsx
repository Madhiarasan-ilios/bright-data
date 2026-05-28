import { normaliseWinProbability } from '@/lib/utils/normalise';
import type { CompetitorIntel } from '@/lib/types';

interface CompetitorIntelPanelProps {
  competitorIntel: CompetitorIntel | null;
}

export function CompetitorIntelPanel({ competitorIntel }: CompetitorIntelPanelProps) {
  if (!competitorIntel) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-[#94a3b8] text-sm">
          Competitive intelligence not available for this account
        </p>
      </div>
    );
  }

  const winPct = normaliseWinProbability(competitorIntel.win_probability);
  const differentiators =
    competitorIntel.why_anthropic_wins?.length
      ? competitorIntel.why_anthropic_wins
      : (competitorIntel.anthropic_differentiators ?? []);
  const redFlags = competitorIntel.red_flags ?? [];

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6 space-y-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">
        Competitor Intelligence
      </h2>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Field label="Primary Competitor" value={competitorIntel.primary_competitor} />
        <Field label="Competitor Strength" value={competitorIntel.competitor_strength} />
        <Field label="Win Probability" value={`${winPct}%`} />
        <Field label="Displacement Risk" value={competitorIntel.displacement_risk} />
        <Field label="Pitch Angle" value={competitorIntel.pitch_angle} className="col-span-2 sm:col-span-1" />
      </div>

      {differentiators.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
            Anthropic Differentiators
          </p>
          <ul className="space-y-1">
            {differentiators.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#f1f5f9]">
                <span className="text-[#f59e0b] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {redFlags.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide mb-2">
            Red Flags
          </p>
          <ul className="space-y-1">
            {redFlags.map((item, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#f1f5f9]">
                <span className="text-[#ef4444] mt-0.5">•</span>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  className,
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs text-[#94a3b8] uppercase tracking-wide">{label}</p>
      <p className="text-sm font-medium text-[#f1f5f9] capitalize">{value}</p>
    </div>
  );
}
