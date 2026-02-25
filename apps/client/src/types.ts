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

export interface Filters {
  sourceApp: string;
  sessionId: string;
  eventType: string;
}

export interface WebSocketMessage {
  type: 'initial' | 'event' | 'hitl_response';
  data: HookEvent | HookEvent[] | HumanInTheLoopResponse;
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

export type TimeRange = '1m' | '3m' | '5m' | '10m';

export interface ChartDataPoint {
  timestamp: number;
  count: number;
  eventTypes: Record<string, number>;
  toolEvents?: Record<string, number>;
  sessions: Record<string, number>;
}

/* ─── Insights Dashboard Types ─── */

export interface InsightsKPI {
  totalEvents: number;
  totalAgents: number;
  activeAgents: number;
  avgEventsPerAgent: number;
  topEventType: string;
  topTool: string;
  eventsPerMinute: number;
  sessionDurationAvgMs: number;
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface AreaPoint {
  timestamp: number;
  value: number;
}

export interface BarItem {
  label: string;
  value: number;
  color: string;
}

export interface InsightsData {
  kpis: InsightsKPI;
  eventTypeBreakdown: DonutSlice[];
  toolUsageBreakdown: DonutSlice[];
  eventTimeline: AreaPoint[];
  topToolsRanking: BarItem[];
  agentActivity: BarItem[];
}
