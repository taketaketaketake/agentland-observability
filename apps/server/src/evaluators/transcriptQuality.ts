import type { EvaluatorContext, EvaluatorOutput, Evaluator } from './types';
import type { EvalResult } from '../types';
import { getAssistantMessages, getPrecedingUserMessage } from '../evaluations';
import { callLLM, getEvalModel, parseJudgeResponse } from './llmProvider';

export const TRANSCRIPT_QUALITY_PROMPT_VERSION = 'v1';

const SYSTEM_PROMPT = `You are an evaluation judge. Score the assistant's response on three dimensions:
- helpfulness (1-5): How well does the response address the user's needs?
- accuracy (1-5): Is the information factually correct and the code/solution valid?
- conciseness (1-5): Is the response appropriately concise without unnecessary verbosity?

Respond with a JSON object inside a fenced code block:
\`\`\`json
{"helpfulness": <1-5>, "accuracy": <1-5>, "conciseness": <1-5>, "rationale": "<brief explanation>"}
\`\`\``;

function stratifiedSample<T extends { session_id: string }>(items: T[], limit: number): T[] {
  // Group by session_id
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

  // Round 1: Take up to perSessionLimit from each session (random selection)
  for (const [, sessionItems] of bySession) {
    const shuffled = [...sessionItems].sort(() => Math.random() - 0.5);
    selected.push(...shuffled.slice(0, perSessionLimit));
  }

  // If we got more than needed, trim
  if (selected.length > limit) {
    return selected.sort(() => Math.random() - 0.5).slice(0, limit);
  }

  // Round 2: If still under limit, fill from sessions with remaining items
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

export const transcriptQualityEvaluator: Evaluator = {
  type: 'transcript_quality',
  requiresApiKey: true,

  async run(ctx: EvaluatorContext): Promise<EvaluatorOutput> {
    const sampleLimit = ctx.options.sample_limit ?? 50;
    const since = ctx.options.time_window_hours
      ? Date.now() - ctx.options.time_window_hours * 60 * 60 * 1000
      : undefined;

    const allMessages = getAssistantMessages({
      since,
      session_id: ctx.scope.session_id,
      source_app: ctx.scope.source_app,
    });

    const sampled = stratifiedSample(allMessages, sampleLimit);
    ctx.onProgress(0, sampled.length);

    const results: Omit<EvalResult, 'id'>[] = [];
    let totalHelpfulness = 0, totalAccuracy = 0, totalConciseness = 0;
    let scoredCount = 0;

    for (let i = 0; i < sampled.length; i++) {
      const msg = sampled[i];
      const userMsg = getPrecedingUserMessage(msg.session_id, msg.timestamp);

      const userContent = userMsg?.content || '[No preceding user message]';
      const truncatedUser = userContent.length > 2000 ? userContent.substring(0, 2000) + '...' : userContent;
      const truncatedAssistant = msg.content.length > 3000 ? msg.content.substring(0, 3000) + '...' : msg.content;

      try {
        const response = await callLLM({
          system: SYSTEM_PROMPT,
          messages: [{
            role: 'user',
            content: `## User Message\n${truncatedUser}\n\n## Assistant Response\n${truncatedAssistant}`,
          }],
          maxTokens: 512,
        });

        const { parsed, error } = parseJudgeResponse(response.text);

        if (parsed && typeof parsed.helpfulness === 'number') {
          const numericScore = (parsed.helpfulness + parsed.accuracy + parsed.conciseness) / 3;
          totalHelpfulness += parsed.helpfulness;
          totalAccuracy += parsed.accuracy;
          totalConciseness += parsed.conciseness;
          scoredCount++;

          results.push({
            run_id: ctx.run.id,
            session_id: msg.session_id,
            source_app: msg.source_app,
            item_type: 'assistant_message',
            item_id: msg.uuid,
            numeric_score: numericScore,
            scores_json: {
              helpfulness: parsed.helpfulness,
              accuracy: parsed.accuracy,
              conciseness: parsed.conciseness,
            },
            rationale: parsed.rationale || null,
            metadata_json: {
              message_snippet: msg.content.substring(0, 100),
              model: msg.model,
            },
            created_at: Date.now(),
          });
        } else {
          // Parse error — record with score 0 and note the error
          results.push({
            run_id: ctx.run.id,
            session_id: msg.session_id,
            source_app: msg.source_app,
            item_type: 'assistant_message',
            item_id: msg.uuid,
            numeric_score: 0,
            scores_json: { error: error || 'parse_error' },
            rationale: error || 'Failed to parse judge response',
            metadata_json: { message_snippet: msg.content.substring(0, 100) },
            created_at: Date.now(),
          });
        }
      } catch (err: any) {
        // API error — record and continue
        results.push({
          run_id: ctx.run.id,
          session_id: msg.session_id,
          source_app: msg.source_app,
          item_type: 'assistant_message',
          item_id: msg.uuid,
          numeric_score: 0,
          scores_json: { error: err.message },
          rationale: `API error: ${err.message}`,
          metadata_json: { message_snippet: msg.content.substring(0, 100) },
          created_at: Date.now(),
        });
      }

      ctx.onProgress(i + 1, sampled.length);

      // Small delay between API calls
      if (i < sampled.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    }

    const summary = {
      avg_helpfulness: scoredCount > 0 ? totalHelpfulness / scoredCount : 0,
      avg_accuracy: scoredCount > 0 ? totalAccuracy / scoredCount : 0,
      avg_conciseness: scoredCount > 0 ? totalConciseness / scoredCount : 0,
      sample_count: scoredCount,
      errors: results.length - scoredCount,
    };

    return {
      results,
      summary,
      model_name: getEvalModel(),
      prompt_version: TRANSCRIPT_QUALITY_PROMPT_VERSION,
    };
  },
};
