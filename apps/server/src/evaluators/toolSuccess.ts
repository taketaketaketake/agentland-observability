import type { EvaluatorContext, EvaluatorOutput, Evaluator } from './types';
import type { EvalResult } from '../types';
import { getToolEvents } from '../evaluations';

export const toolSuccessEvaluator: Evaluator = {
  type: 'tool_success',
  requiresApiKey: false,

  async run(ctx: EvaluatorContext): Promise<EvaluatorOutput> {
    const since = ctx.options.time_window_hours
      ? Date.now() - ctx.options.time_window_hours * 60 * 60 * 1000
      : undefined;

    const events = getToolEvents({
      since,
      session_id: ctx.scope.session_id,
      session_ids: ctx.scope.session_ids,
      source_app: ctx.scope.source_app,
      project_dir: ctx.options.project_dir,
    });

    ctx.onProgress(0, events.length);

    const results: Omit<EvalResult, 'id'>[] = [];
    const byTool: Record<string, { success: number; failure: number }> = {};
    const byAgent: Record<string, { success: number; failure: number }> = {};

    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      const isSuccess = event.hook_event_type === 'PostToolUse';
      const toolName = event.payload?.tool_name || event.payload?.tool || 'unknown';
      const agentKey = `${event.source_app}:${event.session_id.substring(0, 8)}`;

      // Track by tool
      if (!byTool[toolName]) byTool[toolName] = { success: 0, failure: 0 };
      if (isSuccess) byTool[toolName].success++;
      else byTool[toolName].failure++;

      // Track by agent
      if (!byAgent[agentKey]) byAgent[agentKey] = { success: 0, failure: 0 };
      if (isSuccess) byAgent[agentKey].success++;
      else byAgent[agentKey].failure++;

      results.push({
        run_id: ctx.run.id,
        session_id: event.session_id,
        source_app: event.source_app,
        item_type: 'tool_invocation',
        item_id: String(event.id),
        numeric_score: isSuccess ? 1.0 : 0.0,
        scores_json: { success: isSuccess },
        rationale: null,
        metadata_json: { tool_name: toolName, hook_event_type: event.hook_event_type },
        created_at: Date.now(),
      });

      if ((i + 1) % 50 === 0 || i === events.length - 1) {
        ctx.onProgress(i + 1, events.length);
      }
    }

    const totalSuccess = results.filter(r => r.numeric_score === 1.0).length;
    const totalFailure = results.length - totalSuccess;
    const overallRate = results.length > 0 ? totalSuccess / results.length : 0;

    // Compute rates per tool
    const byToolWithRates: Record<string, { success: number; failure: number; rate: number }> = {};
    for (const [tool, counts] of Object.entries(byTool)) {
      const total = counts.success + counts.failure;
      byToolWithRates[tool] = { ...counts, rate: total > 0 ? counts.success / total : 0 };
    }

    // Compute rates per agent
    const byAgentWithRates: Record<string, { success: number; failure: number; rate: number }> = {};
    for (const [agent, counts] of Object.entries(byAgent)) {
      const total = counts.success + counts.failure;
      byAgentWithRates[agent] = { ...counts, rate: total > 0 ? counts.success / total : 0 };
    }

    const summary = {
      overall_rate: overallRate,
      total_success: totalSuccess,
      total_failure: totalFailure,
      total_events: results.length,
      by_tool: byToolWithRates,
      by_agent: byAgentWithRates,
    };

    return { results, summary };
  },
};
