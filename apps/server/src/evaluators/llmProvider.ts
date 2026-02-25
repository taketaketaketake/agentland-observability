/**
 * Provider-agnostic LLM interface for evaluation judge calls.
 *
 * Configure via environment variables:
 *   EVAL_PROVIDER=anthropic|gemini  (default: auto-detect based on which key is set)
 *   EVAL_MODEL=<model-id>           (optional, each provider has a sensible default)
 *   ANTHROPIC_API_KEY=sk-ant-...    (required for anthropic provider)
 *   GOOGLE_API_KEY=AI...            (required for gemini provider)
 */

export interface LLMMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface LLMCallOpts {
  system: string;
  messages: LLMMessage[];
  maxTokens?: number;
  temperature?: number;
}

export interface LLMCallResult {
  text: string;
  model: string;
  provider: string;
  inputTokens: number;
  outputTokens: number;
}

export interface LLMProvider {
  name: string;
  isConfigured(): boolean;
  call(opts: LLMCallOpts): Promise<LLMCallResult>;
  getModel(): string;
}

// ─── Anthropic Provider ───

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const anthropicProvider: LLMProvider = {
  name: 'anthropic',

  isConfigured() {
    return !!process.env.ANTHROPIC_API_KEY;
  },

  getModel() {
    return process.env.EVAL_MODEL || ANTHROPIC_DEFAULT_MODEL;
  },

  async call(opts) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');

    const model = this.getModel();
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
        temperature: opts.temperature ?? 0,
        system: opts.system,
        messages: opts.messages,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as any;
    return {
      text: data.content?.[0]?.text || '',
      model: data.model || model,
      provider: 'anthropic',
      inputTokens: data.usage?.input_tokens || 0,
      outputTokens: data.usage?.output_tokens || 0,
    };
  },
};

// ─── Gemini Provider ───

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash';

const geminiProvider: LLMProvider = {
  name: 'gemini',

  isConfigured() {
    return !!process.env.GOOGLE_API_KEY;
  },

  getModel() {
    return process.env.EVAL_MODEL || GEMINI_DEFAULT_MODEL;
  },

  async call(opts) {
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_API_KEY is not set');

    const model = this.getModel();
    const url = `${GEMINI_API_URL}/${model}:generateContent?key=${apiKey}`;

    // Convert system + messages into Gemini's format
    const contents: any[] = [];

    // Gemini uses systemInstruction at the top level
    const systemInstruction = { parts: [{ text: opts.system }] };

    for (const msg of opts.messages) {
      contents.push({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      });
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        systemInstruction,
        contents,
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 1024,
          temperature: opts.temperature ?? 0,
        },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Gemini API error ${response.status}: ${errorBody}`);
    }

    const data = await response.json() as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const usage = data.usageMetadata || {};

    return {
      text,
      model,
      provider: 'gemini',
      inputTokens: usage.promptTokenCount || 0,
      outputTokens: usage.candidatesTokenCount || 0,
    };
  },
};

// ─── Provider Registry ───

const providers: Record<string, LLMProvider> = {
  anthropic: anthropicProvider,
  gemini: geminiProvider,
};

/**
 * Returns the active provider based on EVAL_PROVIDER env var.
 * If not set, auto-detects: picks the first provider that has a key configured.
 * Throws if no provider is available.
 */
export function getProvider(): LLMProvider {
  const explicit = process.env.EVAL_PROVIDER;
  if (explicit) {
    const provider = providers[explicit];
    if (!provider) throw new Error(`Unknown EVAL_PROVIDER: ${explicit}. Available: ${Object.keys(providers).join(', ')}`);
    if (!provider.isConfigured()) throw new Error(`EVAL_PROVIDER=${explicit} but its API key is not set`);
    return provider;
  }

  // Auto-detect
  for (const provider of Object.values(providers)) {
    if (provider.isConfigured()) return provider;
  }

  throw new Error('No LLM provider configured. Set ANTHROPIC_API_KEY or GOOGLE_API_KEY.');
}

/**
 * Returns true if any LLM provider has a valid API key set.
 */
export function isAnyProviderConfigured(): boolean {
  return Object.values(providers).some(p => p.isConfigured());
}

/**
 * Returns the list of configured provider names.
 */
export function getConfiguredProviders(): string[] {
  return Object.values(providers).filter(p => p.isConfigured()).map(p => p.name);
}

// ─── Convenience: callLLM + parseJudgeResponse ───

export async function callLLM(opts: LLMCallOpts): Promise<LLMCallResult> {
  const provider = getProvider();
  return provider.call(opts);
}

export function getEvalModel(): string {
  try {
    return getProvider().getModel();
  } catch {
    return process.env.EVAL_MODEL || ANTHROPIC_DEFAULT_MODEL;
  }
}

export function parseJudgeResponse(text: string): { parsed: Record<string, any> | null; error?: string } {
  // Strategy 1: Extract first fenced code block
  const fencedMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fencedMatch) {
    try {
      return { parsed: JSON.parse(fencedMatch[1].trim()) };
    } catch {
      // Fall through
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
