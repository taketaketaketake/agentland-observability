import type { EvaluatorContext, EvaluatorOutput, Evaluator } from './types';
import { getCompletedRunIds, getEvalResultScores, insertEvalBaseline, getEvalBaselines } from '../evaluations';
import type { EvaluatorType } from '../types';

const METRICS: Record<string, { evaluator: EvaluatorType; field: string }[]> = {
  tool_success_rate: [{ evaluator: 'tool_success', field: 'numeric_score' }],
  avg_input_clarity: [{ evaluator: 'transcript_quality', field: 'input_clarity' }],
  avg_input_context: [{ evaluator: 'transcript_quality', field: 'input_context' }],
  avg_helpfulness: [{ evaluator: 'transcript_quality', field: 'helpfulness' }],
  avg_accuracy: [{ evaluator: 'transcript_quality', field: 'accuracy' }],
  avg_conciseness: [{ evaluator: 'transcript_quality', field: 'conciseness' }],
  avg_depth: [{ evaluator: 'reasoning_quality', field: 'depth' }],
  avg_coherence: [{ evaluator: 'reasoning_quality', field: 'coherence' }],
  avg_self_correction: [{ evaluator: 'reasoning_quality', field: 'self_correction' }],
};

interface RegressionAlert {
  metric: string;
  baseline_mean: number;
  current_mean: number;
  z_score: number;
  effect_size: number;
  direction: 'degraded' | 'improved';
}

function stddev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map(v => (v - mean) ** 2);
  return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / (values.length - 1));
}

function percentiles(sorted: number[]): Record<string, number> {
  if (sorted.length === 0) return {};
  const p = (pct: number) => {
    const idx = Math.ceil(pct / 100 * sorted.length) - 1;
    return sorted[Math.max(0, idx)];
  };
  return { p25: p(25), p50: p(50), p75: p(75) };
}

export const regressionEvaluator: Evaluator = {
  type: 'regression',
  requiresApiKey: false,

  async run(ctx: EvaluatorContext): Promise<EvaluatorOutput> {
    const now = Date.now();
    const currentWindowHours = ctx.options.time_window_hours ?? 24;
    const currentStart = now - currentWindowHours * 60 * 60 * 1000;
    const baselineEnd = currentStart;
    const baselineStart = baselineEnd - 7 * 24 * 60 * 60 * 1000; // 7 days before current window

    const alerts: RegressionAlert[] = [];
    let metricsChecked = 0;
    let metricsFlagged = 0;

    const metricEntries = Object.entries(METRICS);
    ctx.onProgress(0, metricEntries.length);

    for (let i = 0; i < metricEntries.length; i++) {
      const [metricName, sources] = metricEntries[i];

      for (const source of sources) {
        // Get baseline run IDs (older window)
        const baselineRunIds = getCompletedRunIds(source.evaluator, {
          since: baselineStart,
          until: baselineEnd,
        });

        // Get current run IDs (recent window)
        const currentRunIds = getCompletedRunIds(source.evaluator, {
          since: currentStart,
        });

        if (baselineRunIds.length === 0 || currentRunIds.length === 0) continue;

        // Get scores
        const baselineScores = getEvalResultScores(baselineRunIds);
        const currentScores = getEvalResultScores(currentRunIds);

        // Extract numeric scores
        const baselineValues = baselineScores.map(s => s.numeric_score);
        const currentValues = currentScores.map(s => s.numeric_score);

        // Minimum data requirements
        if (baselineValues.length < 10 || currentValues.length < 5) continue;

        metricsChecked++;

        const baselineMean = baselineValues.reduce((a, b) => a + b, 0) / baselineValues.length;
        const currentMean = currentValues.reduce((a, b) => a + b, 0) / currentValues.length;
        const baselineStddev = stddev(baselineValues, baselineMean);

        let zScore: number;

        if (metricName === 'tool_success_rate') {
          // Proportion z-test
          const p1 = baselineMean;
          const p2 = currentMean;
          const n1 = baselineValues.length;
          const n2 = currentValues.length;
          const pooled = (p1 * n1 + p2 * n2) / (n1 + n2);
          const se = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
          zScore = se > 0 ? (p2 - p1) / se : 0;
        } else {
          // Standard z-score test
          zScore = baselineStddev > 0 ? (currentMean - baselineMean) / baselineStddev : 0;
        }

        const effectSize = currentMean - baselineMean;

        if (zScore < -2.0) {
          alerts.push({
            metric: metricName,
            baseline_mean: baselineMean,
            current_mean: currentMean,
            z_score: zScore,
            effect_size: effectSize,
            direction: 'degraded',
          });
          metricsFlagged++;
        } else if (zScore > 2.0) {
          alerts.push({
            metric: metricName,
            baseline_mean: baselineMean,
            current_mean: currentMean,
            z_score: zScore,
            effect_size: effectSize,
            direction: 'improved',
          });
          metricsFlagged++;
        }

        // Save baseline snapshot
        const sortedBaseline = [...baselineValues].sort((a, b) => a - b);
        insertEvalBaseline({
          evaluator_type: source.evaluator,
          metric_name: metricName,
          model_name: null,
          prompt_version: null,
          window_start: currentStart,
          window_end: now,
          sample_count: currentValues.length,
          mean_score: currentMean,
          stddev_score: stddev(currentValues, currentMean),
          percentile_json: percentiles(sortedBaseline),
          created_at: now,
        });
      }

      ctx.onProgress(i + 1, metricEntries.length);
    }

    const summary = {
      alerts,
      metrics_checked: metricsChecked,
      metrics_flagged: metricsFlagged,
      baseline_window: { start: baselineStart, end: baselineEnd },
      current_window: { start: currentStart, end: now },
    };

    return { results: [], summary };
  },
};
