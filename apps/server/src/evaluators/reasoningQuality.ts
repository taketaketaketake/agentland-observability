import type { EvaluatorContext, EvaluatorOutput, Evaluator } from './types';
import type { EvalResult } from '../types';
import { getAssistantMessages, getPrecedingUserMessage } from '../evaluations';
import { callLLM, getEvalModel, parseJudgeResponse } from './llmProvider';

export const REASONING_QUALITY_PROMPT_VERSION = 'v1';

const SYSTEM_PROMPT = `You are an evaluation judge for AI reasoning quality. Score the thinking/reasoning block on three dimensions:
- depth (1-5): How thorough and detailed is the reasoning? Does it consider edge cases and alternatives?
- coherence (1-5): Is the reasoning logically structured and easy to follow?
- self_correction (1-5): Does the reasoning identify and correct mistakes or reconsider assumptions?

Respond with a JSON object inside a fenced code block:
\`\`\`json
{"depth": <1-5>, "coherence": <1-5>, "self_correction": <1-5>, "rationale": "<brief explanation>"}
\`\`\``;

function stratifiedSample<T extends { session_id: string }>(items: T[], limit: number): T[] {
  const bySession = new Map<string, T[]>();
  for (const item of items) {
    const list = bySession.get(item.session_id) || [];
    list.push(item);
    bySession.set(item.session_id, list);
  }

  const sessionCount = bySession.size;
  if (sessionCount === 0) return [];

  const perSessionLimit = Math.ceil(limit / sessionCount);
  const selected: T[] = [];

  for (const [, sessionItems] of bySession) {
    const shuffled = [...sessionItems].sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, perSessionLimit));
  }

  if (selected.length > limit) {
    return selected.sort(() => Math.random() - 0.5).slice(0, limit);
  }

  if (selected.length < limit) {
    const selectedIds = new Set(selected.map(s => (s as any).uuid || (s as any).id));
    const remaining: T[] = [];
    for (const [, sessionItems] of bySession) {
      for (const item of sessionItems) {
        const itemId = (item as any).uuid || (item as any).id;
        if (!selectedIds.has(itemId)) {
          remaining.push(item);
        }
      }
    }
    remaining.sort(() => Math.random() - 0.5);
    selected.push(...remaining.slice(0, limit - selected.length));
  }

  return selected;
}

export const reasoningQualityEvaluator: Evaluator = {
  type: 'reasoning_quality',
  requiresApiKey: true,

  async run(ctx: EvaluatorContext): Promise<EvaluatorOutput> {
    const sampleLimit = ctx.options.sample_limit ?? 30;
    const since = ctx.options.time_window_hours
      ? Date.now() - ctx.options.time_window_hours * 60 * 60 * 1000
      : undefined;

    const allMessages = getAssistantMessages({
      since,
      session_id: ctx.scope.session_id,
      source_app: ctx.scope.source_app,
      with_thinking: true,
      project_dir: ctx.options.project_dir,
    });

    const sampled = stratifiedSample(allMessages, sampleLimit);
    ctx.onProgress(0, sampled.length);

    const results: Omit<EvalResult, 'id'>[] = [];
    let totalDepth = 0, totalCoherence = 0, totalSelfCorrection = 0;
    let scoredCount = 0;

    for (let i = 0; i < sampled.length; i++) {
      const msg = sampled[i];
      const userMsg = getPrecedingUserMessage(msg.session_id, msg.timestamp);

      const userContent = userMsg?.content || '[No preceding user message]';
      const truncatedUser = userContent.length > 1500 ? userContent.substring(0, 1500) + '...' : userContent;
      const truncatedThinking = (msg.thinking || '').length > 3000 ? msg.thinking!.substring(0, 3000) + '...' : (msg.thinking || '');
      const truncatedResponse = msg.content.length > 1500 ? msg.content.substring(0, 1500) + '...' : msg.content;
      const thinkingTokenCount = msg.thinking ? msg.thinking.split(/\s+/).length : 0;

      try {
        const response = await callLLM({
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `## User Request\n${truncatedUser}\n\n## Thinking/Reasoning Block\n${truncatedThinking}\n\n## Final Response\n${truncatedResponse}`,
          }],
          maxTokens: 512,
        }, ctx.options.provider);

        const { parsed, error } = parseJudgeResponse(response.text);

        if (parsed && typeof parsed.depth === 'number') {
          const numericScore = (parsed.depth + parsed.coherence + parsed.self_correction) / 3;
          totalDepth += parsed.depth;
          totalCoherence += parsed.coherence;
          totalSelfCorrection += parsed.self_correction;
          scoredCount++;

          results.push({
            run_id: ctx.run.id,
            session_id: msg.session_id,
            source_app: msg.source_app,
            item_type: 'thinking_block',
            item_id: msg.uuid,
            numeric_score: numericScore,
            scores_json: {
              depth: parsed.depth,
              coherence: parsed.coherence,
              self_correction: parsed.self_correction,
            },
            rationale: parsed.rationale || null,
            metadata_json: {
              thinking_token_count: thinkingTokenCount,
              message_snippet: msg.content.substring(0, 100),
              model: msg.model,
            },
            created_at: Date.now(),
          });
        } else {
          results.push({
            run_id: ctx.run.id,
            session_id: msg.session_id,
            source_app: msg.source_app,
            item_type: 'thinking_block',
            item_id: msg.uuid,
            numeric_score: 0,
            scores_json: { error: error || 'parse_error' },
            rationale: error || 'Failed to parse judge response',
            metadata_json: { thinking_token_count: thinkingTokenCount },
            created_at: Date.now(),
          });
        }
      } catch (err: any) {
        results.push({
          run_id: ctx.run.id,
          session_id: msg.session_id,
          source_app: msg.source_app,
          item_type: 'thinking_block',
          item_id: msg.uuid,
          numeric_score: 0,
          scores_json: { error: err.message },
          rationale: `API error: ${err.message}`,
          metadata_json: { thinking_token_count: thinkingTokenCount },
          created_at: Date.now(),
        });
      }

      ctx.onProgress(i + 1, sampled.length);

      if (i < sampled.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const summary = {
      avg_depth: scoredCount > 0 ? totalDepth / scoredCount : 0,
      avg_coherence: scoredCount > 0 ? totalCoherence / scoredCount : 0,
      avg_self_correction: scoredCount > 0 ? totalSelfCorrection / scoredCount : 0,
      sample_count: scoredCount,
      errors: results.length - scoredCount,
    };

    return {
      results,
      summary,
      model_name: getEvalModel(ctx.options.provider),
      prompt_version: REASONING_QUALITY_PROMPT_VERSION,
    };
  },
};
