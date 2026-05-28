'use client';

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from '@/components/ui/accordion';
import { BooleanBadge } from '@/components/ui/BooleanBadge';
import type {
  GTMReport,
  SignalSummary,
  HiringSignal,
  ProcurementSignal,
  TechstackSignal,
  ComplianceSignal,
  CompetitiveOpennessSignal,
} from '@/lib/types';

interface SignalExplorerPanelProps {
  report: GTMReport;
}

function getSignal<T extends SignalSummary>(signals: SignalSummary[], type: string): T | null {
  return (signals.find((s) => s.type === type) as T) ?? null;
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-2">
      <span className="text-[#94a3b8] text-xs min-w-[160px] shrink-0">{label}:</span>
      <span className="text-[#f1f5f9] text-sm">{value}</span>
    </div>
  );
}

export function SignalExplorerPanel({ report }: SignalExplorerPanelProps) {
  const hiring = getSignal<HiringSignal>(report.signals, 'hiring');
  const procurement = getSignal<ProcurementSignal>(report.signals, 'procurement');
  const techstack = getSignal<TechstackSignal>(report.signals, 'techstack');
  const compliance = getSignal<ComplianceSignal>(report.signals, 'compliance');
  const competitiveOpenness = getSignal<CompetitiveOpennessSignal>(
    report.signals,
    'competitive_openness'
  );

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Signal Explorer
      </h2>
      <Accordion multiple defaultValue={[]}>
        {/* ── Section 1: Hiring Signals ──────────────────────────────────── */}
        <AccordionItem value="hiring" className="border-[#334155]">
          <AccordionTrigger className="text-[#f1f5f9] hover:no-underline">
            Hiring Signals
          </AccordionTrigger>
          <AccordionContent>
            {hiring ? (
              <div className="flex flex-col gap-2 pt-1">
                <Row label="Score" value={hiring.score} />
                <Row label="Summary" value={hiring.summary} />
                <Row
                  label="Key Roles"
                  value={hiring.key_roles.length > 0 ? hiring.key_roles.join(', ') : 'None'}
                />
                <Row
                  label="Foundation Model Focus"
                  value={<BooleanBadge value={hiring.foundation_model_focus} />}
                />
                <Row
                  label="Anthropic Relevant"
                  value={<BooleanBadge value={hiring.anthropic_relevant} />}
                />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] pt-1">No hiring signal data available</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Section 2: Procurement Signals ────────────────────────────── */}
        <AccordionItem value="procurement" className="border-[#334155]">
          <AccordionTrigger className="text-[#f1f5f9] hover:no-underline">
            Procurement Signals
          </AccordionTrigger>
          <AccordionContent>
            {procurement ? (
              <div className="flex flex-col gap-2 pt-1">
                <Row label="Score" value={procurement.score} />
                <Row label="Summary" value={procurement.summary} />
                <Row
                  label="Vendors"
                  value={
                    procurement.vendors_under_consideration.length > 0
                      ? procurement.vendors_under_consideration.join(', ')
                      : 'None'
                  }
                />
                <Row label="Procurement Stage" value={procurement.procurement_stage} />
                <Row label="Incumbent Vendor" value={procurement.incumbent_vendor} />
                <Row
                  label="Anthropic Probability"
                  value={`${procurement.anthropic_probability}%`}
                />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] pt-1">No procurement signal data available</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Section 3: Techstack Signals ──────────────────────────────── */}
        <AccordionItem value="techstack" className="border-[#334155]">
          <AccordionTrigger className="text-[#f1f5f9] hover:no-underline">
            Techstack Signals
          </AccordionTrigger>
          <AccordionContent>
            {techstack ? (
              <div className="flex flex-col gap-2 pt-1">
                <Row
                  label="Models Detected"
                  value={
                    techstack.models_detected.length > 0
                      ? techstack.models_detected.join(', ')
                      : 'None'
                  }
                />
                <Row
                  label="Claude Mentioned"
                  value={<BooleanBadge value={techstack.claude_mentioned} />}
                />
                <Row label="Provider Preference" value={techstack.provider_preference} />
                <Row label="Multi-Model Readiness" value={techstack.multi_model_readiness} />
                <Row label="Switching Barrier" value={techstack.switching_barrier} />
                <Row label="Anthropic Fit Score" value={techstack.anthropic_fit_score} />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] pt-1">No techstack signal data available</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Section 4: Compliance Signals ─────────────────────────────── */}
        <AccordionItem value="compliance" className="border-[#334155]">
          <AccordionTrigger className="text-[#f1f5f9] hover:no-underline">
            Compliance Signals
          </AccordionTrigger>
          <AccordionContent>
            {compliance ? (
              <div className="flex flex-col gap-2 pt-1">
                <Row label="Score" value={compliance.score} />
                <Row label="Summary" value={compliance.summary} />
                <Row
                  label="Regulated Environment"
                  value={<BooleanBadge value={compliance.regulated_environment} />}
                />
                <Row label="Safety Priority" value={compliance.safety_priority} />
                <Row label="Governance Pressure" value={compliance.governance_pressure} />
                <Row label="Anthropic Alignment" value={compliance.anthropic_alignment} />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] pt-1">No compliance signal data available</p>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* ── Section 5: Competitive Openness Signals ───────────────────── */}
        <AccordionItem value="competitive_openness" className="border-[#334155]">
          <AccordionTrigger className="text-[#f1f5f9] hover:no-underline">
            Competitive Openness Signals
          </AccordionTrigger>
          <AccordionContent>
            {competitiveOpenness ? (
              <div className="flex flex-col gap-2 pt-1">
                <Row label="Score" value={competitiveOpenness.score} />
                <Row label="Summary" value={competitiveOpenness.summary} />
                <Row label="Incumbent AI Vendor" value={competitiveOpenness.incumbent_ai_vendor} />
                <Row label="Lock-In Strength" value={competitiveOpenness.lock_in_strength} />
                <Row
                  label="Openness to Alternatives"
                  value={competitiveOpenness.openness_to_alternatives}
                />
                <Row
                  label="Multi-Vendor Strategy"
                  value={<BooleanBadge value={competitiveOpenness.multi_vendor_strategy} />}
                />
                <Row
                  label="Displacement Difficulty"
                  value={competitiveOpenness.displacement_difficulty}
                />
              </div>
            ) : (
              <p className="text-sm text-[#94a3b8] pt-1">
                No competitive openness signal data available
              </p>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
