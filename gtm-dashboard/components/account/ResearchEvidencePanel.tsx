import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { GTMReport, SerpResult, CollectorEvidence, ResearchEvidence } from '@/lib/types';

interface ResearchEvidencePanelProps {
  report: GTMReport;
}

const TABS: { key: keyof ResearchEvidence; label: string }[] = [
  { key: 'hiring', label: 'Hiring' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'techstack', label: 'Techstack' },
  { key: 'compliance', label: 'Compliance' },
  { key: 'competitive_openness', label: 'Competitive Openness' },
];

const EMPTY_MSG = 'No search evidence available for this collector.';

/** A tab is considered empty when both search_queries and serp_results are absent or empty. */
function isTabEmpty(data: CollectorEvidence | undefined | null): boolean {
  if (!data) return true;
  const hasQueries = Array.isArray(data.search_queries) && data.search_queries.length > 0;
  const hasResults = Array.isArray(data.serp_results) && data.serp_results.length > 0;
  return !hasQueries && !hasResults;
}

export function ResearchEvidencePanel({ report }: ResearchEvidencePanelProps) {
  // research_evidence is now typed directly on GTMReport — no cast needed
  const evidence = report.research_evidence;

  return (
    <div className="rounded-xl bg-[#1e293b] border border-[#334155] p-6">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-4">
        Research Evidence
      </h2>
      <Tabs defaultValue="hiring">
        <TabsList className="bg-[#0f172a] mb-4 h-auto flex-wrap gap-1 w-full">
          {TABS.map((tab) => (
            <TabsTrigger
              key={tab.key}
              value={tab.key}
              className="text-xs px-3 py-1.5 data-active:bg-[#334155] data-active:text-[#f1f5f9] text-[#94a3b8]"
            >
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {TABS.map((tab) => {
          const tabData = evidence?.[tab.key];
          return (
            <TabsContent key={tab.key} value={tab.key}>
              {isTabEmpty(tabData) ? (
                <p className="text-sm text-[#94a3b8]">{EMPTY_MSG}</p>
              ) : (
                <EvidenceTabContent data={tabData!} />
              )}
            </TabsContent>
          );
        })}
      </Tabs>
    </div>
  );
}

function EvidenceTabContent({ data }: { data: CollectorEvidence }) {
  // Cap serp_results at 10 items (Req 3.4)
  const allResults: SerpResult[] = data.serp_results ?? [];
  const displayResults = allResults.slice(0, 10);
  const isTruncated = allResults.length > 10;

  return (
    <div className="space-y-4">
      {/* Search query chips — up to 20 */}
      {data.search_queries && data.search_queries.length > 0 && (
        <div>
          <p className="text-xs text-[#94a3b8] uppercase tracking-wide mb-2">Search Queries</p>
          <div className="flex flex-wrap gap-2">
            {data.search_queries.slice(0, 20).map((q, i) => (
              <span
                key={i}
                className="bg-[#334155] text-[#f1f5f9] text-xs px-2 py-1 rounded-full"
              >
                {q}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Counts */}
      <div className="flex gap-4 text-sm text-[#94a3b8]">
        {data.serp_results_count != null && (
          <span>
            <span className="font-semibold text-[#f1f5f9]">{data.serp_results_count}</span> SERP results
          </span>
        )}
        {data.snippets_count != null && (
          <span>
            <span className="font-semibold text-[#f1f5f9]">{data.snippets_count}</span> snippets
          </span>
        )}
      </div>

      {/* LLM reasoning */}
      {data.llm_reasoning && (
        <div>
          <p className="text-xs text-[#94a3b8] uppercase tracking-wide mb-1">LLM Reasoning</p>
          <p className="text-sm text-[#f1f5f9]">{data.llm_reasoning}</p>
        </div>
      )}

      {/* SERP result cards */}
      {displayResults.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-[#94a3b8] uppercase tracking-wide">SERP Results</p>
          {displayResults.map((result, i) => (
            <div
              key={i}
              className="rounded-lg bg-[#0f172a] border border-[#334155] p-3 space-y-1"
            >
              {result.title && (
                <p className="text-sm font-medium text-[#f1f5f9]">{result.title}</p>
              )}
              {result.description && (
                <p className="text-xs text-[#94a3b8]">{result.description}</p>
              )}
              {result.url && (
                <a
                  href={result.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#f59e0b] hover:underline break-all"
                >
                  {result.url}
                </a>
              )}
            </div>
          ))}
          {/* Truncation indicator (Req 3.4) */}
          {isTruncated && (
            <p className="text-xs text-[#94a3b8] mt-1">
              Showing 10 of {allResults.length} results
            </p>
          )}
        </div>
      )}
    </div>
  );
}
