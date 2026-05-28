'use client';

import { useState } from 'react';
import { validateCompanyInput } from '@/lib/utils/inputValidation';
import { analyzeCompanies } from '@/lib/api-client';
import { useGTMStore } from '@/lib/store';

/**
 * Textarea form for entering plain-text or CSV company names.
 * Validates input with validateCompanyInput before submitting.
 * Disables the submit button while the pipeline is running.
 * On valid submit, calls analyzeCompanies and updates job status.
 */
export function CompanyInputForm() {
  const [value, setValue] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const jobStatus = useGTMStore((s) => s.jobStatus);
  const setJobStatus = useGTMStore((s) => s.setJobStatus);

  const isRunning = jobStatus === 'running';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitError(null);

    const { companies, error } = validateCompanyInput(value);

    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);

    try {
      const result = await analyzeCompanies(companies);
      setJobStatus('running', result.job_id);
      setValue('');
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to start analysis.';
      setSubmitError(message);
    }
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setValue(e.target.value);
    if (validationError) setValidationError(null);
  }

  return (
    <div className="bg-[#1e293b] border border-[#334155] rounded-lg p-4">
      <h2 className="text-sm font-semibold text-[#f1f5f9] mb-3">
        Analyze Companies
      </h2>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-2">
          <label
            htmlFor="company-input"
            className="text-xs text-[#94a3b8] font-medium"
          >
            Enter company names (one per line or comma-separated, max 50)
          </label>
          <textarea
            id="company-input"
            value={value}
            onChange={handleChange}
            disabled={isRunning}
            rows={5}
            placeholder={'Acme Corp\nGlobal Industries\nTech Startup, Another Co'}
            aria-describedby={
              validationError ? 'company-input-error' : undefined
            }
            aria-invalid={validationError ? 'true' : undefined}
            className={`w-full rounded-lg border bg-[#0f172a] px-3 py-2 text-sm text-[#f1f5f9] placeholder-[#475569] resize-y focus:outline-none focus:ring-2 focus:ring-[#f59e0b] focus:ring-offset-1 focus:ring-offset-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              validationError
                ? 'border-red-500/60'
                : 'border-[#334155] hover:border-[#475569]'
            }`}
          />
          {validationError && (
            <p
              id="company-input-error"
              role="alert"
              className="text-xs text-red-400"
            >
              {validationError}
            </p>
          )}
          {submitError && (
            <p role="alert" className="text-xs text-red-400">
              {submitError}
            </p>
          )}
          <button
            type="submit"
            disabled={isRunning}
            className="self-end inline-flex items-center gap-2 rounded-lg bg-[#f59e0b] px-4 py-2 text-sm font-semibold text-[#0f172a] transition-colors hover:bg-[#fbbf24] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f59e0b] focus-visible:ring-offset-2 focus-visible:ring-offset-[#1e293b] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning ? (
              <>
                <span
                  className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#0f172a] border-t-transparent"
                  aria-hidden="true"
                />
                Running…
              </>
            ) : (
              'Analyze Companies'
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
