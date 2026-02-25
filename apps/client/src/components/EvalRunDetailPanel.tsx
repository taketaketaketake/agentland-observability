import type { EvalRun, EvalResult } from '../types';

interface EvalRunDetailPanelProps {
  run: EvalRun;
  results: EvalResult[];
  onClose: () => void;
  onLoadMore: () => void;
}

const ITEM_TYPE_LABELS: Record<string, string> = {
  tool_invocation: 'Tool',
  assistant_message: 'Response',
  thinking_block: 'Reasoning',
};

export default function EvalRunDetailPanel({ run, results, onClose, onLoadMore }: EvalRunDetailPanelProps) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1 rounded-md text-[var(--theme-text-tertiary)] hover:text-[var(--theme-text-secondary)] hover:bg-[var(--theme-bg-tertiary)] transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h2 className="text-sm font-mono font-semibold text-[var(--theme-text-primary)]">
              Run #{run.id} — {run.evaluator_type.replace('_', ' ')}
            </h2>
            <div className="text-[10px] font-mono text-[var(--theme-text-quaternary)] mt-0.5">
              {run.progress_total} items scored
              {run.model_name && ` · ${run.model_name}`}
              {run.prompt_version && ` · prompt ${run.prompt_version}`}
            </div>
          </div>
        </div>

        {/* Summary badge */}
        {run.summary_json?.overall_rate != null && (
          <div className="text-sm font-mono font-semibold text-[var(--theme-accent-success)] tabular-nums">
            {(run.summary_json.overall_rate * 100).toFixed(1)}%
          </div>
        )}
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto">
        {results.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-xs font-mono text-[var(--theme-text-quaternary)]">No results</p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--theme-border-primary)]">
            {results.map(result => (
              <ResultRow key={result.id} result={result} evaluatorType={run.evaluator_type} />
            ))}
          </div>
        )}

        {/* Load more */}
        {results.length > 0 && results.length % 100 === 0 && (
          <div className="px-4 py-3 text-center">
            <button
              onClick={onLoadMore}
              className="px-3 py-1.5 text-xs font-mono text-[var(--theme-primary)] border border-[var(--theme-border-glow)] rounded-md hover:bg-[var(--theme-primary-glow)] transition-all"
            >
              Load more
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultRow({ result, evaluatorType }: { result: EvalResult; evaluatorType: string }) {
  const agentId = `${result.source_app}:${result.session_id.substring(0, 8)}`;
  const scoreColor = result.numeric_score >= 0.8 ? 'var(--theme-accent-success)'
    : result.numeric_score >= 0.5 ? 'var(--theme-accent-warning)'
    : 'var(--theme-accent-error)';

  return (
    <div className="px-4 py-2.5 hover:bg-[var(--theme-bg-surface)] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--theme-bg-tertiary)] text-[var(--theme-text-tertiary)]">
              {ITEM_TYPE_LABELS[result.item_type] || result.item_type}
            </span>
            <span className="text-[10px] font-mono text-[var(--theme-text-quaternary)]">
              {agentId}
            </span>
            {result.metadata_json?.tool_name && (
              <span className="text-[10px] font-mono text-[var(--theme-text-tertiary)]">
                {result.metadata_json.tool_name}
              </span>
            )}
          </div>

          {/* Score breakdown */}
          <div className="flex items-center gap-3 text-[11px] font-mono">
            {evaluatorType === 'tool_success' ? (
              <span className={result.scores_json.success ? 'text-[var(--theme-accent-success)]' : 'text-[var(--theme-accent-error)]'}>
                {result.scores_json.success ? 'SUCCESS' : 'FAILURE'}
              </span>
            ) : (
              Object.entries(result.scores_json).filter(([k]) => k !== 'rationale').map(([key, value]) => (
                <span key={key} className="text-[var(--theme-text-secondary)]">
                  {key}: <span className="tabular-nums" style={{ color: (value as number) >= 4 ? 'var(--theme-accent-success)' : (value as number) >= 3 ? 'var(--theme-accent-warning)' : 'var(--theme-accent-error)' }}>{String(value)}</span>
                </span>
              ))
            )}
          </div>

          {/* Rationale */}
          {result.rationale && (
            <p className="text-[11px] font-mono text-[var(--theme-text-quaternary)] mt-1 line-clamp-2">
              {result.rationale}
            </p>
          )}
        </div>

        {/* Score pill */}
        <div
          className="flex-shrink-0 text-sm font-mono font-semibold tabular-nums"
          style={{ color: scoreColor }}
        >
          {evaluatorType === 'tool_success'
            ? (result.numeric_score === 1 ? '✓' : '✗')
            : result.numeric_score.toFixed(1)}
        </div>
      </div>
    </div>
  );
}
