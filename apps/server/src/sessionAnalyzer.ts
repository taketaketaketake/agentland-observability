import { getSessionMessages, getSessionAnalysis, upsertSessionAnalysis, updateSessionAnalysis, listSessionAnalyses, getCrossSessionInsight, upsertCrossSessionInsight } from './db';
import { callLLM, parseJudgeResponse, isAnyProviderConfigured, getEvalModel } from './evaluators/llmProvider';

const PROMPT_VERSION = 'session-v1';
const CROSS_SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Transcript Truncation ───

function buildTranscriptExcerpt(messages: { role: string; content: string }[]): string {
  const TOTAL_BUDGET = 6000;
  const parts: string[] = [];
  let used = 0;

  // 1. First user message (up to 800 chars)
  const firstUser = messages.find(m => m.role === 'user');
  if (firstUser) {
    const text = `[FIRST USER MESSAGE]\n${firstUser.content.slice(0, 800)}`;
    parts.push(text);
    used += text.length;
  }

  // 2. Last 6 messages (up to 600 chars each)
  const lastN = messages.slice(-6);
  const lastParts: string[] = [];
  for (const msg of lastN) {
    const text = `[${msg.role.toUpperCase()}]\n${msg.content.slice(0, 600)}`;
    lastParts.push(text);
  }
  const lastText = `\n---\n[RECENT MESSAGES]\n${lastParts.join('\n\n')}`;
  used += lastText.length;
  parts.push(lastText);

  // 3. Sampled middle messages if budget remains
  if (messages.length > 8 && used < TOTAL_BUDGET) {
    const middleStart = 1;
    const middleEnd = messages.length - 6;
    if (middleEnd > middleStart) {
      const step = Math.max(1, Math.floor((middleEnd - middleStart) / 3));
      const sampled: string[] = [];
      for (let i = middleStart; i < middleEnd && sampled.length < 3; i += step) {
        const msg = messages[i]!;
        const remaining = TOTAL_BUDGET - used;
        if (remaining < 100) break;
        const maxLen = Math.min(400, remaining);
        const text = `[${msg.role.toUpperCase()} - mid]\n${msg.content.slice(0, maxLen)}`;
        sampled.push(text);
        used += text.length;
      }
      if (sampled.length > 0) {
        parts.splice(1, 0, `\n---\n[MIDDLE SAMPLES]\n${sampled.join('\n\n')}`);
      }
    }
  }

  return parts.join('\n');
}

// ─── Per-Session Analysis ───

const SESSION_ANALYSIS_SYSTEM = `You are an AI session analyst. Analyze the provided coding session transcript excerpt and produce a structured JSON assessment.

Respond with ONLY a JSON object (no markdown fences, no explanation) with these fields:
{
  "task_summary": "one-sentence description of what the session accomplished",
  "outcome": "success|partial|failure|abandoned|unclear",
  "complexity": "trivial|simple|moderate|complex|highly_complex",
  "tools_used": ["list of tools mentioned, e.g. Read, Edit, Bash"],
  "key_decisions": ["up to 3 key decisions or turning points"],
  "issues": ["up to 3 problems or errors encountered"],
  "quality_score": 1-5,
  "tags": ["up to 5 topic tags like refactoring, debugging, feature, docs"],
  "duration_assessment": "quick|moderate|lengthy"
}

Score guide: 1=poor (many errors, wrong approach), 3=adequate (completed but with issues), 5=excellent (clean, efficient, correct).`;

export async function analyzeSession(sessionId: string, sourceApp: string): Promise<void> {
  // Guard: no LLM provider
  if (!isAnyProviderConfigured()) {
    console.log(`[session-analyzer] Skipping analysis for ${sessionId.substring(0, 8)} — no LLM provider configured`);
    return;
  }

  // Guard: already analyzed or running
  const existing = getSessionAnalysis(sessionId);
  if (existing && (existing.status === 'completed' || existing.status === 'running')) {
    return;
  }

  // Fetch messages
  const messages = getSessionMessages(sessionId);
  if (messages.length < 2) {
    upsertSessionAnalysis({
      session_id: sessionId,
      source_app: sourceApp,
      status: 'completed',
      summary: 'Session too short for analysis',
      message_count: messages.length,
      created_at: Date.now(),
      completed_at: Date.now(),
    });
    return;
  }

  // Mark as running
  upsertSessionAnalysis({
    session_id: sessionId,
    source_app: sourceApp,
    status: 'running',
    message_count: messages.length,
    created_at: Date.now(),
  });

  try {
    const excerpt = buildTranscriptExcerpt(messages);
    const model = getEvalModel();

    const result = await callLLM({
      system: SESSION_ANALYSIS_SYSTEM,
      messages: [{ role: 'user', content: `Analyze this session transcript:\n\n${excerpt}` }],
      maxTokens: 1024,
      temperature: 0,
    });

    const { parsed, error } = parseJudgeResponse(result.text);
    if (!parsed) {
      updateSessionAnalysis(sessionId, {
        status: 'failed',
        error_message: error || 'Failed to parse LLM response',
        model_name: result.model,
        completed_at: Date.now(),
      });
      return;
    }

    updateSessionAnalysis(sessionId, {
      status: 'completed',
      analysis_json: JSON.stringify(parsed),
      summary: parsed.task_summary || null,
      model_name: result.model,
      prompt_version: PROMPT_VERSION,
      tokens_analyzed: result.inputTokens + result.outputTokens,
      completed_at: Date.now(),
    });

    console.log(`[session-analyzer] Completed analysis for ${sessionId.substring(0, 8)}: ${parsed.task_summary}`);
  } catch (err: any) {
    console.error(`[session-analyzer] Failed for ${sessionId.substring(0, 8)}:`, err.message);
    updateSessionAnalysis(sessionId, {
      status: 'failed',
      error_message: err.message,
      completed_at: Date.now(),
    });
  }
}

// ─── Cross-Session Synthesis ───

const CROSS_SESSION_SYSTEM = `You are an AI productivity analyst. Given summaries of multiple coding sessions, synthesize patterns and insights.

Respond with ONLY a JSON object (no markdown fences, no explanation):
{
  "overall_summary": "2-3 sentence overview of the sessions",
  "common_patterns": ["up to 5 recurring patterns"],
  "top_tools": ["most frequently used tools"],
  "common_issues": ["up to 4 recurring problems"],
  "quality_distribution": {"high": 0, "medium": 0, "low": 0},
  "task_categories": {"category": count},
  "outcome_distribution": {"success": 0, "partial": 0, "failure": 0},
  "recommendations": ["up to 4 actionable recommendations"],
  "productivity_assessment": "one sentence overall assessment"
}

For quality_distribution: high=4-5, medium=3, low=1-2.`;

export async function synthesizeCrossSessions(): Promise<any> {
  // Check cache
  const cached = getCrossSessionInsight('latest');
  if (cached && (Date.now() - cached.created_at) < CROSS_SESSION_TTL_MS) {
    return JSON.parse(cached.analysis_json);
  }

  if (!isAnyProviderConfigured()) {
    return { error: 'no_provider', message: 'No LLM provider configured. Set an API key to enable AI insights.' };
  }

  const analyses = listSessionAnalyses({ status: 'completed', limit: 50 });
  const withData = analyses.filter(a => a.analysis_json);

  if (withData.length < 2) {
    return { error: 'insufficient_data', message: `Need at least 2 analyzed sessions. Currently have ${withData.length}.` };
  }

  // Build summaries for the LLM
  const summaryLines = withData.map((a, i) => {
    const data = JSON.parse(a.analysis_json!);
    return `Session ${i + 1} (${a.source_app}:${a.session_id.substring(0, 8)}): ${data.task_summary || 'No summary'} | outcome=${data.outcome} | complexity=${data.complexity} | quality=${data.quality_score}/5 | tools=[${(data.tools_used || []).join(',')}] | tags=[${(data.tags || []).join(',')}]`;
  }).join('\n');

  try {
    const result = await callLLM({
      system: CROSS_SESSION_SYSTEM,
      messages: [{ role: 'user', content: `Synthesize insights from these ${withData.length} coding sessions:\n\n${summaryLines}` }],
      maxTokens: 4096,
      temperature: 0,
    });

    const { parsed, error } = parseJudgeResponse(result.text);
    if (!parsed) {
      return { error: 'parse_error', message: error || 'Failed to parse LLM response' };
    }

    upsertCrossSessionInsight('latest', {
      analysis_json: JSON.stringify(parsed),
      model_name: result.model,
      session_count: withData.length,
    });

    return parsed;
  } catch (err: any) {
    console.error(`[session-analyzer] Cross-session synthesis failed:`, err.message);
    return { error: 'llm_error', message: err.message };
  }
}
