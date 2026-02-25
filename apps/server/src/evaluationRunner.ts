import type { EvalRun, EvalScope, EvalRunOptions } from './types';
import { updateEvalRunStatus, insertEvalResults } from './evaluations';
import { toolSuccessEvaluator } from './evaluators/toolSuccess';
import { transcriptQualityEvaluator } from './evaluators/transcriptQuality';
import { reasoningQualityEvaluator } from './evaluators/reasoningQuality';
import { regressionEvaluator } from './evaluators/regression';
import { isAnyProviderConfigured } from './evaluators/llmProvider';
import type { Evaluator, EvaluatorContext } from './evaluators/types';

const evaluators: Record<string, Evaluator> = {
  tool_success: toolSuccessEvaluator,
  transcript_quality: transcriptQualityEvaluator,
  reasoning_quality: reasoningQualityEvaluator,
  regression: regressionEvaluator,
};

type ProgressBroadcast = (runId: number, status: string, current: number, total: number) => void;

export async function runEvaluation(
  run: EvalRun,
  scope: EvalScope,
  options: EvalRunOptions,
  broadcastProgress: ProgressBroadcast,
): Promise<void> {
  const evaluator = evaluators[run.evaluator_type];

  if (!evaluator) {
    updateEvalRunStatus(run.id, 'failed', {
      error_message: `Unknown evaluator type: ${run.evaluator_type}`,
      completed_at: Date.now(),
    });
    broadcastProgress(run.id, 'failed', 0, 0);
    return;
  }

  // Check LLM provider requirement
  if (evaluator.requiresApiKey && !isAnyProviderConfigured()) {
    updateEvalRunStatus(run.id, 'failed', {
      error_message: `${run.evaluator_type} requires an LLM provider. Set an API key for your preferred LLM provider.`,
      completed_at: Date.now(),
    });
    broadcastProgress(run.id, 'failed', 0, 0);
    return;
  }

  // Mark as running
  updateEvalRunStatus(run.id, 'running', { started_at: Date.now() });
  broadcastProgress(run.id, 'running', 0, 0);

  try {
    const ctx: EvaluatorContext = {
      run,
      scope,
      options,
      onProgress: (current, total) => {
        updateEvalRunStatus(run.id, 'running', {
          progress_current: current,
          progress_total: total,
        });
        broadcastProgress(run.id, 'running', current, total);
      },
    };

    const output = await evaluator.run(ctx);

    // Insert results in chunks with micro-delays to avoid blocking
    const CHUNK = 25;
    for (let i = 0; i < output.results.length; i += CHUNK) {
      const chunk = output.results.slice(i, i + CHUNK);
      insertEvalResults(chunk);
      if (i + CHUNK < output.results.length) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    // Mark complete
    updateEvalRunStatus(run.id, 'completed', {
      summary_json: output.summary,
      model_name: output.model_name,
      prompt_version: output.prompt_version,
      progress_current: output.results.length,
      progress_total: output.results.length,
      completed_at: Date.now(),
    });
    broadcastProgress(run.id, 'completed', output.results.length, output.results.length);
  } catch (error: any) {
    console.error(`[evaluations] Evaluator ${run.evaluator_type} error:`, error);
    updateEvalRunStatus(run.id, 'failed', {
      error_message: error.message || 'Unknown error',
      completed_at: Date.now(),
    });
    broadcastProgress(run.id, 'failed', 0, 0);
  }
}

export function registerEvaluator(evaluator: Evaluator) {
  evaluators[evaluator.type] = evaluator;
}
