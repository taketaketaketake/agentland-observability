const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

interface ClaudeMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface CallClaudeOpts {
  system: string;
  messages: ClaudeMessage[];
  maxTokens?: number;
  temperature?: number;
}

interface CallClaudeResult {
  text: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

export async function callClaude(opts: CallClaudeOpts): Promise<CallClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const model = process.env.EVAL_MODEL || DEFAULT_MODEL;

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: opts.maxTokens ?? 1024,
      temperature: 0,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json() as any;
  const text = data.content?.[0]?.text || '';

  return {
    text,
    model: data.model || model,
    inputTokens: data.usage?.input_tokens || 0,
    outputTokens: data.usage?.output_tokens || 0,
  };
}

export function getEvalModel(): string {
  return process.env.EVAL_MODEL || DEFAULT_MODEL;
}

export function parseJudgeResponse(text: string): { parsed: Record<string, any> | null; error?: string } {
  // Strategy 1: Extract first fenced code block
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fencedMatch) {
    try {
      return { parsed: JSON.parse(fencedMatch[1].trim()) };
    } catch {
      // Fall through to strategy 2
    }
  }

  // Strategy 2: Try JSON.parse on the full response
  try {
    return { parsed: JSON.parse(text.trim()) };
  } catch {
    // Fall through
  }

  // Strategy 3: Try to find a JSON object in the text
  const jsonMatch = text.match(/\{[\s\S]*?\}/);
  if (jsonMatch) {
    try {
      return { parsed: JSON.parse(jsonMatch[0]) };
    } catch {
      // Fall through
    }
  }

  return { parsed: null, error: `Could not parse judge response: ${text.substring(0, 200)}` };
}
