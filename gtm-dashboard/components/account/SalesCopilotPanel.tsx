import { CopyToCRMButton } from '@/components/account/CopyToCRMButton';
import type { GTMReport } from '@/lib/types';

interface SalesCopilotPanelProps {
  report: GTMReport;
}

function hasData(value: string | string[] | null | undefined): boolean {
  if (value == null) return false;
  if (typeof value === 'string') return value.trim().length > 0;
  return value.length > 0;
}

export function SalesCopilotPanel({ report }: SalesCopilotPanelProps) {
  if (!hasData(report.executive_summary)) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">
          Sales brief not yet available for this account
        </p>
      </div>
    );
  }

  const redFlags = report.risk_factors ?? report.competitor_intel?.red_flags ?? [];

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6 space-y-6">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide">
        Sales Copilot
      </h2>

      {hasData(report.executive_summary) && (
        <Section title="Executive Summary">
          <p className="text-sm text-[#f1f5f9]">{report.executive_summary}</p>
        </Section>
      )}

      {hasData(report.recommended_action) && (
        <Section title="Recommended Action">
          <p className="text-sm text-[#f1f5f9]">{report.recommended_action}</p>
        </Section>
      )}

      {hasData(report.discovery_questions) && (
        <Section title="Discovery Questions">
          <ol className="space-y-1 list-none">
            {report.discovery_questions.map((q, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#f1f5f9]">
                <span className="text-[#f59e0b] font-medium tabular-nums min-w-[1.25rem]">
                  {i + 1}.
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {hasData(report.value_propositions) && (
        <Section title="Value Propositions">
          <ol className="space-y-1 list-none">
            {report.value_propositions.map((v, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#f1f5f9]">
                <span className="text-[#f59e0b] font-medium tabular-nums min-w-[1.25rem]">
                  {i + 1}.
                </span>
                <span>{v}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {hasData(report.safety_narrative) && (
        <Section title="Safety Narrative">
          <p className="text-sm text-[#f1f5f9]">{report.safety_narrative}</p>
        </Section>
      )}

      {redFlags.length > 0 && (
        <Section title="Risk Factors">
          <ol className="space-y-1 list-none">
            {redFlags.map((r, i) => (
              <li key={i} className="flex gap-2 text-sm text-[#f1f5f9]">
                <span className="text-[#ef4444] font-medium tabular-nums min-w-[1.25rem]">
                  {i + 1}.
                </span>
                <span>{r}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      {hasData(report.talk_track_opener) && (
        <Section title="Talk Track Opener">
          <p className="text-sm text-[#f1f5f9] italic">&ldquo;{report.talk_track_opener}&rdquo;</p>
        </Section>
      )}

      <CopyToCRMButton report={report} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-xs font-semibold text-[#94a3b8] uppercase tracking-wide">
        {title}
      </h3>
      {children}
    </div>
  );
}
