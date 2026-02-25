import { useState, useCallback, useEffect } from 'react';
import { useEvaluations } from '../hooks/useEvaluations';
import type { EvaluatorType, EvalRun, EvalSummary, EvalProgress } from '../types';
import SuccessRateChart from './charts/SuccessRateChart';
import ScoreDistributionChart from './charts/ScoreDistributionChart';
import EvalRunDetailPanel from './EvalRunDetailPanel';

interface EvaluationsPanelProps {
  onEvaluationProgress?: (callback: (progress: EvalProgress) => void) => void;
}

const EVALUATOR_LABELS: Record<EvaluatorType, string> = {
  tool_success: 'Tool Success Rate',
  transcript_quality: 'Transcript Quality',
  reasoning_quality: 'Reasoning Quality',
  regression: 'Regression Detection',
};

const EVALUATOR_DESCRIPTIONS: Record<EvaluatorType, string> = {
  tool_success: 'Measures tool invocation success/failure rates across agents and tools',
  transcript_quality: 'LLM-as-judge scoring of helpfulness, accuracy, and conciseness',
  reasoning_quality: 'LLM-as-judge scoring of thinking depth, coherence, and self-correction',
  regression: 'Statistical comparison of current vs baseline metrics to detect regressions',
};

function formatTimeAgo(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return 'just now';
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`;
  return `${Math.floor(diff / 86400_000)}d ago`;
}

export default function EvaluationsPanel({ onEvaluationProgress }: EvaluationsPanelProps) {
  const {
    config,
    summaries,
    runs,
    runningEvals,
    loading,
    error,
    startEvaluation,
    deleteRun,
    fetchRun,
    fetchResults,
    selectedRun,
    selectedResults,
    setSelectedRun,
    handleProgress,
  } = useEvaluations();

  const [detailRunId, setDetailRunId] = useState<number | null>(null);
  const [runningButtons, setRunningButtons] = useState<Set<EvaluatorType>>(new Set());

  // Wire up WebSocket progress
  useEffect(() => {
    if (onEvaluationProgress) {
      onEvaluationProgress(handleProgress);
    }
  }, [onEvaluationProgress, handleProgress]);

  const handleRun = useCallback(async (type: EvaluatorType) => {
    if (runningButtons.has(type)) return;
    setRunningButtons(prev => new Set(prev).add(type));
    await startEvaluation(type, { type: 'global' }, { time_window_hours: 24 });
    // Debounce: prevent re-run for 2 seconds
    setTimeout(() => {
      setRunningButtons(prev => {
        const next = new Set(prev);
        next.delete(type);
        return next;
      });
    }, 2000);
  }, [startEvaluation, runningButtons]);

  const handleViewDetail = useCallback(async (runId: number) => {
    setDetailRunId(runId);
    await fetchRun(runId);
    await fetchResults(runId);
  }, [fetchRun, fetchResults]);

  const getSummary = (type: EvaluatorType): EvalSummary | undefined => {
    return summaries.find(s => s.evaluator_type === type);
  };

  const getRunProgress = (type: EvaluatorType): EvalProgress | undefined => {
    for (const [, progress] of runningEvals) {
      const run = runs.find(r => r.id === progress.run_id);
      if (run?.evaluator_type === type) return progress;
    }
    return undefined;
  };

  const isEvaluatorAvailable = (type: EvaluatorType): boolean => {
    return config?.available_evaluators.includes(type) ?? false;
  };

  if (detailRunId && selectedRun) {
    return (
      <EvalRunDetailPanel
        run={selectedRun}
        results={selectedResults}
        onClose={() => { setDetailRunId(null); setSelectedRun(null); }}
        onLoadMore={async () => {
          await fetchResults(detailRunId, { offset: selectedResults.length });
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 mobile:p-3">
      {/* ─── Config Banner ─── */}
      {config && !config.api_key_configured && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(212,160,74,0.3)] bg-[rgba(212,160,74,0.06)]">
          <svg className="w-4 h-4 text-[var(--theme-accent-warning)] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-xs font-mono text-[var(--theme-accent-warning)]">
            Set ANTHROPIC_API_KEY or GOOGLE_API_KEY for LLM evaluations (transcript quality, reasoning quality). Tool success works without it.
          </span>
        </div>
      )}

      {/* ─── Error Banner ─── */}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-3 py-2 rounded-lg border border-[rgba(201,96,96,0.3)] bg-[rgba(201,96,96,0.06)]">
          <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent-error)]" />
          <span className="text-xs font-mono text-[var(--theme-accent-error)]">{error}</span>
        </div>
      )}

      {/* ─── KPI Row ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <KpiCard
          label="Tool Success"
          value={getSummary('tool_success')?.summary?.overall_rate != null
            ? `${(getSummary('tool_success')!.summary.overall_rate * 100).toFixed(1)}%`
            : '—'}
          accent="var(--theme-accent-success)"
        />
        <KpiCard
          label="Avg Helpfulness"
          value={getSummary('transcript_quality')?.summary?.avg_helpfulness != null
            ? getSummary('transcript_quality')!.summary.avg_helpfulness.toFixed(1)
            : '—'}
          accent="var(--theme-accent-info)"
        />
        <KpiCard
          label="Avg Accuracy"
          value={getSummary('transcript_quality')?.summary?.avg_accuracy != null
            ? getSummary('transcript_quality')!.summary.avg_accuracy.toFixed(1)
            : '—'}
          accent="var(--theme-accent-info)"
        />
        <KpiCard
          label="Regression Alerts"
          value={getSummary('regression')?.summary?.metrics_flagged != null
            ? String(getSummary('regression')!.summary.metrics_flagged)
            : '—'}
          accent={
            (getSummary('regression')?.summary?.metrics_flagged ?? 0) > 0
              ? 'var(--theme-accent-error)'
              : 'var(--theme-accent-success)'
          }
        />
      </div>

      {/* ─── Evaluator Cards Grid ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Tool Success Card */}
        <EvaluatorCard
          type="tool_success"
          summary={getSummary('tool_success')}
          progress={getRunProgress('tool_success')}
          available={isEvaluatorAvailable('tool_success')}
          running={runningButtons.has('tool_success')}
          loading={loading}
          onRun={() => handleRun('tool_success')}
        >
          {getSummary('tool_success')?.summary?.by_tool && (
            <SuccessRateChart
              data={getSummary('tool_success')!.summary.by_tool}
              title="By Tool"
            />
          )}
        </EvaluatorCard>

        {/* Transcript Quality Card */}
        <EvaluatorCard
          type="transcript_quality"
          summary={getSummary('transcript_quality')}
          progress={getRunProgress('transcript_quality')}
          available={isEvaluatorAvailable('transcript_quality')}
          running={runningButtons.has('transcript_quality')}
          loading={loading}
          onRun={() => handleRun('transcript_quality')}
        >
          {getSummary('transcript_quality')?.summary && (
            <ScoreDistributionChart
              scores={{
                Helpfulness: getSummary('transcript_quality')!.summary.avg_helpfulness,
                Accuracy: getSummary('transcript_quality')!.summary.avg_accuracy,
                Conciseness: getSummary('transcript_quality')!.summary.avg_conciseness,
              }}
              maxScore={5}
            />
          )}
        </EvaluatorCard>

        {/* Reasoning Quality Card */}
        <EvaluatorCard
          type="reasoning_quality"
          summary={getSummary('reasoning_quality')}
          progress={getRunProgress('reasoning_quality')}
          available={isEvaluatorAvailable('reasoning_quality')}
          running={runningButtons.has('reasoning_quality')}
          loading={loading}
          onRun={() => handleRun('reasoning_quality')}
        >
          {getSummary('reasoning_quality')?.summary && (
            <ScoreDistributionChart
              scores={{
                Depth: getSummary('reasoning_quality')!.summary.avg_depth,
                Coherence: getSummary('reasoning_quality')!.summary.avg_coherence,
                'Self-Correction': getSummary('reasoning_quality')!.summary.avg_self_correction,
              }}
              maxScore={5}
            />
          )}
        </EvaluatorCard>

        {/* Regression Detection Card */}
        <EvaluatorCard
          type="regression"
          summary={getSummary('regression')}
          progress={getRunProgress('regression')}
          available={isEvaluatorAvailable('regression')}
          running={runningButtons.has('regression')}
          loading={loading}
          onRun={() => handleRun('regression')}
        >
          {getSummary('regression')?.summary?.alerts && (
            <RegressionAlerts alerts={getSummary('regression')!.summary.alerts} />
          )}
        </EvaluatorCard>
      </div>

      {/* ─── Run History ─── */}
      <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)]">
        <div className="px-4 py-3 border-b border-[var(--theme-border-primary)]">
          <h3 className="text-xs font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">
            Run History
          </h3>
        </div>
        {runs.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs font-mono text-[var(--theme-text-quaternary)]">No evaluation runs yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-left px-4 py-2">Status</th>
                  <th className="text-left px-4 py-2">Scope</th>
                  <th className="text-right px-4 py-2">Items</th>
                  <th className="text-right px-4 py-2">When</th>
                  <th className="text-right px-4 py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {runs.slice(0, 20).map(run => (
                  <RunRow
                    key={run.id}
                    run={run}
                    progress={runningEvals.get(run.id)}
                    onView={() => handleViewDetail(run.id)}
                    onDelete={() => deleteRun(run.id)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Sub-components ─── */

function KpiCard({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] px-3 py-2.5">
      <div className="text-[10px] font-mono text-[var(--theme-text-tertiary)] uppercase tracking-wider mb-1">
        {label}
      </div>
      <div
        className="text-lg font-semibold tabular-nums truncate"
        style={{ color: accent || 'var(--theme-text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

function EvaluatorCard({
  type,
  summary,
  progress,
  available,
  running,
  loading,
  onRun,
  children,
}: {
  type: EvaluatorType;
  summary?: EvalSummary;
  progress?: EvalProgress;
  available: boolean;
  running: boolean;
  loading: boolean;
  onRun: () => void;
  children?: React.ReactNode;
}) {
  const isRunning = progress?.status === 'running' || running;
  const progressPct = progress && progress.progress_total > 0
    ? (progress.progress_current / progress.progress_total) * 100
    : 0;

  return (
    <div className="rounded-lg border border-[var(--theme-border-primary)] bg-[var(--theme-bg-secondary)] p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-sm font-mono text-[var(--theme-text-primary)] font-semibold">
            {EVALUATOR_LABELS[type]}
          </h3>
          <p className="text-[11px] font-mono text-[var(--theme-text-quaternary)] mt-0.5">
            {EVALUATOR_DESCRIPTIONS[type]}
          </p>
        </div>
        <button
          onClick={onRun}
          disabled={!available || isRunning || loading}
          className={`flex-shrink-0 px-3 py-1.5 rounded-md text-xs font-mono transition-all duration-150 ${
            !available
              ? 'text-[var(--theme-text-quaternary)] border border-[var(--theme-border-primary)] cursor-not-allowed opacity-50'
              : isRunning
                ? 'text-[var(--theme-accent-warning)] border border-[rgba(212,160,74,0.3)] bg-[rgba(212,160,74,0.06)] cursor-wait'
                : 'text-[var(--theme-primary)] border border-[var(--theme-border-glow)] bg-[var(--theme-primary-glow)] hover:bg-[var(--theme-primary-glow-strong)]'
          }`}
        >
          {isRunning ? 'Running...' : !available ? 'Unavailable' : 'Run'}
        </button>
      </div>

      {/* Progress bar */}
      {isRunning && (
        <div className="mb-3">
          <div className="h-1 bg-[var(--theme-bg-primary)] rounded-full overflow-hidden">
            <div
              className="h-full bg-[var(--theme-primary)] rounded-full transition-all duration-300"
              style={{ width: `${Math.max(progressPct, 2)}%` }}
            />
          </div>
          {progress && progress.progress_total > 0 && (
            <div className="text-[10px] font-mono text-[var(--theme-text-quaternary)] mt-1">
              {progress.progress_current} / {progress.progress_total}
            </div>
          )}
        </div>
      )}

      {/* Last run info */}
      {summary?.last_run_at && (
        <div className="text-[10px] font-mono text-[var(--theme-text-quaternary)] mb-3 flex items-center gap-2">
          <span>Last run: {formatTimeAgo(summary.last_run_at)}</span>
          {summary.last_run_sample_count != null && summary.last_run_sample_count > 0 && (
            <span>({summary.last_run_sample_count} items)</span>
          )}
          {summary.last_run_model && (
            <span className="text-[var(--theme-text-quaternary)]">{summary.last_run_model.split('-').slice(-1)[0]}</span>
          )}
        </div>
      )}

      {/* Chart / content */}
      <div className="mt-2">
        {children || (
          <div className="text-xs text-[var(--theme-text-quaternary)] font-mono text-center py-4">
            Run an evaluation to see results
          </div>
        )}
      </div>
    </div>
  );
}

function RunRow({
  run,
  progress,
  onView,
  onDelete,
}: {
  run: EvalRun;
  progress?: EvalProgress;
  onView: () => void;
  onDelete: () => void;
}) {
  const statusColors: Record<string, string> = {
    pending: 'text-[var(--theme-text-tertiary)] bg-[var(--theme-bg-tertiary)]',
    running: 'text-[var(--theme-accent-warning)] bg-[rgba(212,160,74,0.1)]',
    completed: 'text-[var(--theme-accent-success)] bg-[rgba(109,186,130,0.1)]',
    failed: 'text-[var(--theme-accent-error)] bg-[rgba(201,96,96,0.1)]',
  };

  const displayStatus = progress?.status || run.status;
  const displayProgress = progress || { progress_current: run.progress_current, progress_total: run.progress_total };

  return (
    <tr className="border-t border-[var(--theme-border-primary)] hover:bg-[var(--theme-bg-surface)] transition-colors">
      <td className="px-4 py-2 text-xs font-mono text-[var(--theme-text-secondary)]">
        {EVALUATOR_LABELS[run.evaluator_type]}
      </td>
      <td className="px-4 py-2">
        <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${statusColors[displayStatus] || ''}`}>
          {displayStatus === 'running' && (
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--theme-accent-warning)] animate-pulse" />
          )}
          {displayStatus}
        </span>
        {displayStatus === 'running' && displayProgress.progress_total > 0 && (
          <span className="ml-1.5 text-[10px] font-mono text-[var(--theme-text-quaternary)]">
            {displayProgress.progress_current}/{displayProgress.progress_total}
          </span>
        )}
      </td>
      <td className="px-4 py-2 text-xs font-mono text-[var(--theme-text-tertiary)]">
        {run.scope_type}
        {run.scope_source_app && ` (${run.scope_source_app})`}
      </td>
      <td className="px-4 py-2 text-xs font-mono text-[var(--theme-text-tertiary)] text-right tabular-nums">
        {run.progress_total || '—'}
      </td>
      <td className="px-4 py-2 text-xs font-mono text-[var(--theme-text-quaternary)] text-right">
        {formatTimeAgo(run.created_at)}
      </td>
      <td className="px-4 py-2 text-right">
        <div className="flex items-center justify-end gap-1">
          {run.status === 'completed' && (
            <button
              onClick={onView}
              className="px-2 py-0.5 text-[10px] font-mono text-[var(--theme-primary)] hover:text-[var(--theme-primary-light)] transition-colors"
            >
              View
            </button>
          )}
          <button
            onClick={onDelete}
            className="px-2 py-0.5 text-[10px] font-mono text-[var(--theme-text-quaternary)] hover:text-[var(--theme-accent-error)] transition-colors"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}

function RegressionAlerts({ alerts }: { alerts: any[] }) {
  if (!alerts || alerts.length === 0) {
    return (
      <div className="text-xs text-[var(--theme-accent-success)] font-mono text-center py-2">
        No regressions detected
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {alerts.map((alert, i) => (
        <div
          key={i}
          className={`flex items-center justify-between px-2 py-1.5 rounded text-[11px] font-mono ${
            alert.direction === 'degraded'
              ? 'bg-[rgba(201,96,96,0.08)] text-[var(--theme-accent-error)]'
              : 'bg-[rgba(109,186,130,0.08)] text-[var(--theme-accent-success)]'
          }`}
        >
          <span>{alert.metric}</span>
          <span className="tabular-nums">
            {alert.direction === 'degraded' ? '↓' : '↑'} {Math.abs(alert.effect_size).toFixed(2)}
            <span className="text-[var(--theme-text-quaternary)] ml-1">(z={alert.z_score.toFixed(1)})</span>
          </span>
        </div>
      ))}
    </div>
  );
}
