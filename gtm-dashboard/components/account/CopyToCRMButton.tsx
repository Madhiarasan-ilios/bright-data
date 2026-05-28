'use client';

import { useState } from 'react';
import { formatSalesBriefForClipboard } from '@/lib/utils/salesBriefFormatter';
import type { GTMReport } from '@/lib/types';

interface CopyToCRMButtonProps {
  report: GTMReport;
}

type CopyState = 'idle' | 'copied' | 'error';

export function CopyToCRMButton({ report }: CopyToCRMButtonProps) {
  const [state, setState] = useState<CopyState>('idle');
  const [briefContent, setBriefContent] = useState('');

  async function handleCopy() {
    const text = formatSalesBriefForClipboard(report);
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setBriefContent(text);
      setState('error');
    }
  }

  const label =
    state === 'copied'
      ? 'Copied to clipboard'
      : state === 'error'
      ? 'Copy failed'
      : 'Copy to CRM';

  const buttonClass =
    state === 'copied'
      ? 'bg-green-600 hover:bg-green-700'
      : state === 'error'
      ? 'bg-red-600 hover:bg-red-700'
      : 'bg-[#f59e0b] hover:bg-[#d97706]';

  return (
    <div className="space-y-3">
      <button
        onClick={handleCopy}
        className={`${buttonClass} text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e293b]`}
      >
        {label}
      </button>

      {state === 'error' && briefContent && (
        <textarea
          readOnly
          value={briefContent}
          rows={10}
          className="w-full rounded-lg bg-[#0f172a] border border-[#334155] text-[#f1f5f9] text-xs p-3 font-mono resize-y focus:outline-none"
          aria-label="Sales brief content (copy manually)"
        />
      )}
    </div>
  );
}
