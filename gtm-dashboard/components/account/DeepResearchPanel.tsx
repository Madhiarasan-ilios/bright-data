import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import type { GTMReport } from '@/lib/types';

interface DeepResearchPanelProps {
  report: GTMReport;
}

function noData(value: string | string[] | null | undefined): boolean {
  if (value == null) return true;
  if (typeof value === 'string') return value.trim().length === 0;
  return value.length === 0;
}

function joinOrFallback(value: string[] | null | undefined): string {
  if (!value || value.length === 0) return 'No data available';
  return value.join(', ');
}

function strOrFallback(value: string | null | undefined): string {
  if (!value || value.trim().length === 0) return 'No data available';
  return value;
}

export function DeepResearchPanel({ report }: DeepResearchPanelProps) {
  if (!report.deep_research_available) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">
          Deep research is only available for HIGH-priority accounts (score ≥ 60).
        </p>
      </div>
    );
  }

  const dr = report.deep_research_results;

  if (!dr) {
    return (
      <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
        <p className="text-sm text-[#94a3b8]">Deep research data not yet available.</p>
      </div>
    );
  }

  const sections: { title: string; content: string }[] = [
    { title: 'Buying Stage', content: strOrFallback(dr.buying_stage) },
    { title: 'Key Stakeholders', content: joinOrFallback(dr.key_stakeholders) },
    { title: 'Active AI Projects', content: joinOrFallback(dr.active_ai_projects) },
    { title: 'Budget Signals', content: strOrFallback(dr.budget_signals) },
    { title: 'Pain Points', content: joinOrFallback(dr.pain_points) },
    { title: 'Anthropic Entry Angle', content: strOrFallback(dr.anthropic_entry_angle) },
    { title: 'Safety Hook', content: strOrFallback(dr.safety_hook) },
    { title: 'Urgency', content: strOrFallback(dr.urgency) },
    { title: 'Confidence', content: strOrFallback(dr.confidence) },
  ];

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-4">
        Deep Research
      </h2>
      <Accordion className="divide-y divide-[#334155]">
        {sections.map((section) => (
          <AccordionItem key={section.title} value={section.title}>
            <AccordionTrigger className="text-[#f1f5f9] py-3 hover:no-underline">
              {section.title}
            </AccordionTrigger>
            <AccordionContent className="text-[#94a3b8] pb-3">
              {section.content}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}
