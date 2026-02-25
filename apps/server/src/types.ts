export interface HumanInTheLoop {
  question: string;
  responseWebSocketUrl: string;
  type: 'question' | 'permission' | 'choice';
  choices?: string[];
  timeout?: number;
  requiresResponse?: boolean;
}

export interface HumanInTheLoopResponse {
  response?: string;
  permission?: boolean;
  choice?: string;
  hookEvent: HookEvent;
  respondedAt: number;
  respondedBy?: string;
}

export interface HumanInTheLoopStatus {
  status: 'pending' | 'responded' | 'timeout' | 'error';
  respondedAt?: number;
  response?: HumanInTheLoopResponse;
}

export interface HookEvent {
  id?: number;
  source_app: string;
  session_id: string;
  hook_event_type: string;
  payload: Record<string, any>;
  chat?: any[];
  summary?: string;
  timestamp?: number;
  model_name?: string;
  humanInTheLoop?: HumanInTheLoop;
  humanInTheLoopStatus?: HumanInTheLoopStatus;
}

export interface FilterOptions {
  source_apps: string[];
  session_ids: string[];
  hook_event_types: string[];
}

export interface TranscriptMessage {
  id?: number;
  session_id: string;
  source_app: string;
  role: 'user' | 'assistant';
  content: string;
  thinking?: string;
  model?: string;
  input_tokens?: number;
  output_tokens?: number;
  timestamp: string;
  uuid: string;
}

export interface TranscriptSessionSummary {
  session_id: string;
  source_app: string;
  message_count: number;
  user_count: number;
  assistant_count: number;
  first_timestamp: string;
  last_timestamp: string;
}

/* ─── Evaluation Types ─── */

export type EvaluatorType = 'tool_success' | 'transcript_quality' | 'reasoning_quality' | 'regression';
export type EvalScopeType = 'session' | 'agent' | 'global';
export type EvalRunStatus = 'pending' | 'running' | 'completed' | 'failed';
export type EvalItemType = 'tool_invocation' | 'assistant_message' | 'thinking_block';

export interface EvalScope {
  type: EvalScopeType;
  session_id?: string;
  source_app?: string;
}

export interface EvalRunOptions {
  time_window_hours?: number;
  sample_limit?: number;
  temperature?: number;
  max_tokens?: number;
}

export interface EvalRunRequest {
  evaluator_type: EvaluatorType;
  scope: EvalScope;
  options?: EvalRunOptions;
}

export interface EvalRun {
  id: number;
  evaluator_type: EvaluatorType;
  scope_type: EvalScopeType;
  scope_session_id: string | null;
  scope_source_app: string | null;
  status: EvalRunStatus;
  progress_current: number;
  progress_total: number;
  summary_json: any | null;
  error_message: string | null;
  model_name: string | null;
  prompt_version: string | null;
  options_json: EvalRunOptions | null;
  created_at: number;
  started_at: number | null;
  completed_at: number | null;
}

export interface EvalResult {
  id: number;
  run_id: number;
  session_id: string;
  source_app: string;
  item_type: EvalItemType;
  item_id: string;
  numeric_score: number;
  scores_json: Record<string, any>;
  rationale: string | null;
  metadata_json: Record<string, any> | null;
  created_at: number;
}

export interface EvalBaseline {
  id: number;
  evaluator_type: EvaluatorType;
  metric_name: string;
  model_name: string | null;
  prompt_version: string | null;
  window_start: number;
  window_end: number;
  sample_count: number;
  mean_score: number;
  stddev_score: number;
  percentile_json: Record<string, number> | null;
  created_at: number;
}

export interface EvalSummary {
  evaluator_type: EvaluatorType;
  last_run_id: number | null;
  last_run_status: EvalRunStatus | null;
  last_run_at: number | null;
  last_run_model: string | null;
  last_run_prompt_version: string | null;
  last_run_sample_count: number | null;
  summary: any | null;
}

export interface EvalConfig {
  api_key_configured: boolean;
  available_evaluators: EvaluatorType[];
  configured_providers?: string[];
}
