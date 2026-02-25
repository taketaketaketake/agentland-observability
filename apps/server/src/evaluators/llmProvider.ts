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
  defaultModel: string;
  isConfigured(): boolean;
  call(opts: LLMCallOpts): Promise<LLMCallResult>;
  getModel(): string;
}

export interface ProviderInfo {
  name: string;
  configured: boolean;
  defaultModel: string;
}

// ─── Anthropic Provider ───

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_DEFAULT_MODEL = 'claude-sonnet-4-20250514';

const anthropicProvider: LLMProvider = {
  name: 'anthropic',
  defaultModel: ANTHROPIC_DEFAULT_MODEL,

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
  defaultModel: GEMINI_DEFAULT_MODEL,

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
 * Register a new LLM provider. It will automatically appear in
 * getProviderList() and the config endpoint / UI dropdown.
 *
 * Example — adding an OpenAI-compatible local model (Ollama, LM Studio):
 *
 *   const ollamaProvider: LLMProvider = {
 *     name: 'ollama',
 *     defaultModel: 'llama3',
 *     isConfigured: () => !!process.env.OLLAMA_BASE_URL,
 *     getModel: () => process.env.OLLAMA_MODEL || 'llama3',
 *     async call(opts) {
 *       const baseUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
 *       const model = this.getModel();
 *       const response = await fetch(`${baseUrl}/v1/chat/completions`, {
 *         method: 'POST',
 *         headers: { 'Content-Type': 'application/json' },
 *         body: JSON.stringify({
 *           model,
 *           max_tokens: opts.maxTokens ?? 1024,
 *           temperature: opts.temperature ?? 0,
 *           messages: [
 *             { role: 'system', content: opts.system },
 *             ...opts.messages,
 *           ],
 *         }),
 *       });
 *       if (!response.ok) throw new Error(`Ollama API error ${response.status}`);
 *       const data = await response.json() as any;
 *       return {
 *         text: data.choices?.[0]?.message?.content || '',
 *         model,
 *         provider: 'ollama',
 *         inputTokens: data.usage?.prompt_tokens || 0,
 *         outputTokens: data.usage?.completion_tokens || 0,
 *       };
 *     },
 *   };
 *   registerProvider(ollamaProvider);
 */
export function registerProvider(provider: LLMProvider): void {
  providers[provider.name] = provider;
}

/**
 * Returns the active provider based on EVAL_PROVIDER env var or an explicit name.
 * If not set, auto-detects: picks the first provider that has a key configured.
 * Throws if no provider is available.
 */
export function getProvider(providerName?: string): LLMProvider {
  const explicit = providerName || process.env.EVAL_PROVIDER;
  if (explicit) {
    const provider = providers[explicit];
    if (!provider) throw new Error(`Unknown provider: ${explicit}. Available: ${Object.keys(providers).join(', ')}`);
    if (!provider.isConfigured()) throw new Error(`Provider "${explicit}" is not configured (missing API key / env var)`);
    return provider;
  }

  // Auto-detect
  for (const provider of Object.values(providers)) {
    if (provider.isConfigured()) return provider;
  }

  throw new Error('No LLM provider configured. Set an API key for your preferred LLM provider.');
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

/**
 * Returns provider info for the UI: name, configured status, and default model.
 */
export function getProviderList(): ProviderInfo[] {
  return Object.values(providers).map(p => ({
    name: p.name,
    configured: p.isConfigured(),
    defaultModel: p.defaultModel,
  }));
}

// ─── Convenience: callLLM + parseJudgeResponse ───

/**
 * Call an LLM provider. When providerName is set, that specific provider is used
 * instead of auto-detect / EVAL_PROVIDER.
 */
export async function callLLM(opts: LLMCallOpts, providerName?: string): Promise<LLMCallResult> {
  const provider = getProvider(providerName);
  return provider.call(opts);
}

export function getEvalModel(providerName?: string): string {
  try {
    return getProvider(providerName).getModel();
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
