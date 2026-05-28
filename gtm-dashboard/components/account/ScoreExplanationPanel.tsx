interface ScoreExplanationPanelProps {
  explanation?: string;
}

export function ScoreExplanationPanel({ explanation }: ScoreExplanationPanelProps) {
  const hasContent = explanation && explanation.trim().length > 0;

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#94a3b8] uppercase tracking-wide mb-3">
        Score Explanation
      </h2>
      {hasContent ? (
        <p className="text-[#94a3b8] text-sm whitespace-pre-wrap">
          {explanation}
        </p>
      ) : (
        <p className="text-sm text-[#94a3b8]">Score explanation not available.</p>
      )}
    </div>
  );
}
