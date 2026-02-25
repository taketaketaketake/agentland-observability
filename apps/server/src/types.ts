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
