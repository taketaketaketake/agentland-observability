import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, TranscriptMessage, TranscriptSessionSummary, EvalRun, EvalResult, EvalBaseline, EvalRunStatus } from './types';

let db: Database;

export function initDatabase(dbPath: string = 'events.db'): void {
  db = new Database(dbPath);

  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA synchronous = NORMAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_app TEXT NOT NULL,
      session_id TEXT NOT NULL,
      hook_event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      chat TEXT,
      summary TEXT,
      timestamp INTEGER NOT NULL,
      humanInTheLoop TEXT,
      humanInTheLoopStatus TEXT,
      model_name TEXT
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_source_app ON events(source_app)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_id ON events(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_hook_event_type ON events(hook_event_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_timestamp ON events(timestamp)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source_app TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      thinking TEXT,
      model TEXT,
      input_tokens INTEGER,
      output_tokens INTEGER,
      timestamp TEXT NOT NULL,
      uuid TEXT NOT NULL
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp)');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_messages_uuid ON messages(uuid)');

  // ─── Evaluation Tables ───

  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_runs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluator_type TEXT NOT NULL,
      scope_type TEXT NOT NULL,
      scope_session_id TEXT,
      scope_source_app TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      progress_current INTEGER DEFAULT 0,
      progress_total INTEGER DEFAULT 0,
      summary_json TEXT,
      error_message TEXT,
      model_name TEXT,
      prompt_version TEXT,
      options_json TEXT,
      created_at INTEGER NOT NULL,
      started_at INTEGER,
      completed_at INTEGER
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_runs_type ON evaluation_runs(evaluator_type)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_runs_status ON evaluation_runs(status)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_runs_created ON evaluation_runs(created_at)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id INTEGER NOT NULL,
      session_id TEXT NOT NULL,
      source_app TEXT NOT NULL,
      item_type TEXT NOT NULL,
      item_id TEXT NOT NULL,
      numeric_score REAL NOT NULL,
      scores_json TEXT NOT NULL,
      rationale TEXT,
      metadata_json TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_results_run ON evaluation_results(run_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_results_session ON evaluation_results(session_id)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS evaluation_baselines (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      evaluator_type TEXT NOT NULL,
      metric_name TEXT NOT NULL,
      model_name TEXT,
      prompt_version TEXT,
      window_start INTEGER NOT NULL,
      window_end INTEGER NOT NULL,
      sample_count INTEGER NOT NULL,
      mean_score REAL NOT NULL,
      stddev_score REAL NOT NULL,
      percentile_json TEXT,
      created_at INTEGER NOT NULL
    )
  `);

  db.exec('CREATE INDEX IF NOT EXISTS idx_eval_baselines_type ON evaluation_baselines(evaluator_type)');

  // ─── Session Analysis Tables ───

  db.exec(`
    CREATE TABLE IF NOT EXISTS session_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL,
      source_app TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      analysis_json TEXT,
      summary TEXT,
      error_message TEXT,
      model_name TEXT,
      prompt_version TEXT,
      message_count INTEGER,
      tokens_analyzed INTEGER,
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `);

  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_session_analyses_session ON session_analyses(session_id)');
  db.exec('CREATE INDEX IF NOT EXISTS idx_session_analyses_status ON session_analyses(status)');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cross_session_insights (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      insight_key TEXT NOT NULL UNIQUE,
      analysis_json TEXT NOT NULL,
      model_name TEXT,
      session_count INTEGER,
      created_at INTEGER NOT NULL
    )
  `);
}

export function insertEvent(event: HookEvent): HookEvent {
  const stmt = db.prepare(`
    INSERT INTO events (source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const timestamp = event.timestamp || Date.now();

  let humanInTheLoopStatus = event.humanInTheLoopStatus;
  if (event.humanInTheLoop && !humanInTheLoopStatus) {
    humanInTheLoopStatus = { status: 'pending' };
  }

  const result = stmt.run(
    event.source_app,
    event.session_id,
    event.hook_event_type,
    JSON.stringify(event.payload),
    event.chat ? JSON.stringify(event.chat) : null,
    event.summary || null,
    timestamp,
    event.humanInTheLoop ? JSON.stringify(event.humanInTheLoop) : null,
    humanInTheLoopStatus ? JSON.stringify(humanInTheLoopStatus) : null,
    event.model_name || null
  );

  return {
    ...event,
    id: result.lastInsertRowid as number,
    timestamp,
    humanInTheLoopStatus,
  };
}

export function getFilterOptions(): FilterOptions {
  const sourceApps = db.prepare('SELECT DISTINCT source_app FROM events ORDER BY source_app').all() as { source_app: string }[];
  const sessionIds = db.prepare('SELECT DISTINCT session_id FROM events ORDER BY session_id DESC LIMIT 300').all() as { session_id: string }[];
  const hookEventTypes = db.prepare('SELECT DISTINCT hook_event_type FROM events ORDER BY hook_event_type').all() as { hook_event_type: string }[];

  return {
    source_apps: sourceApps.map(row => row.source_app),
    session_ids: sessionIds.map(row => row.session_id),
    hook_event_types: hookEventTypes.map(row => row.hook_event_type),
  };
}

export function getRecentEvents(limit: number = 300): HookEvent[] {
  const stmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name
    FROM events
    ORDER BY timestamp DESC
    LIMIT ?
  `);

  const rows = stmt.all(limit) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
  })).reverse();
}

export function updateEventHITLResponse(id: number, response: any): HookEvent | null {
  const status = {
    status: 'responded',
    respondedAt: response.respondedAt,
    response,
  };

  const stmt = db.prepare('UPDATE events SET humanInTheLoopStatus = ? WHERE id = ?');
  stmt.run(JSON.stringify(status), id);

  const selectStmt = db.prepare(`
    SELECT id, source_app, session_id, hook_event_type, payload, chat, summary, timestamp, humanInTheLoop, humanInTheLoopStatus, model_name
    FROM events
    WHERE id = ?
  `);
  const row = selectStmt.get(id) as any;

  if (!row) return null;

  return {
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    chat: row.chat ? JSON.parse(row.chat) : undefined,
    summary: row.summary || undefined,
    timestamp: row.timestamp,
    humanInTheLoop: row.humanInTheLoop ? JSON.parse(row.humanInTheLoop) : undefined,
    humanInTheLoopStatus: row.humanInTheLoopStatus ? JSON.parse(row.humanInTheLoopStatus) : undefined,
    model_name: row.model_name || undefined,
  };
}

export function insertMessages(messages: TranscriptMessage[]): number {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO messages (session_id, source_app, role, content, thinking, model, input_tokens, output_tokens, timestamp, uuid)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((msgs: TranscriptMessage[]) => {
    let inserted = 0;
    for (const msg of msgs) {
      const result = stmt.run(
        msg.session_id,
        msg.source_app,
        msg.role,
        msg.content,
        msg.thinking || null,
        msg.model || null,
        msg.input_tokens ?? null,
        msg.output_tokens ?? null,
        msg.timestamp,
        msg.uuid,
      );
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  return insertMany(messages);
}

export function listTranscriptSessions(projectDir?: string): TranscriptSessionSummary[] {
  const firstMsgSubquery = `(SELECT substr(m2.content, 1, 120) FROM messages m2 WHERE m2.session_id = m.session_id AND m2.role = 'user' ORDER BY m2.timestamp ASC LIMIT 1)`;

  if (projectDir) {
    const stmt = db.prepare(`
      SELECT
        m.session_id,
        m.source_app,
        COUNT(*) AS message_count,
        SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS user_count,
        SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) AS assistant_count,
        MIN(m.timestamp) AS first_timestamp,
        MAX(m.timestamp) AS last_timestamp,
        ${firstMsgSubquery} AS first_user_message
      FROM messages m
      WHERE m.session_id IN (
        SELECT DISTINCT session_id FROM events
        WHERE json_extract(payload, '$.cwd') = ? OR json_extract(payload, '$.cwd') LIKE ? || '/%'
      )
      GROUP BY m.session_id
      ORDER BY MAX(m.timestamp) DESC
    `);
    return stmt.all(projectDir, projectDir) as TranscriptSessionSummary[];
  }

  const stmt = db.prepare(`
    SELECT
      m.session_id,
      m.source_app,
      COUNT(*) AS message_count,
      SUM(CASE WHEN m.role = 'user' THEN 1 ELSE 0 END) AS user_count,
      SUM(CASE WHEN m.role = 'assistant' THEN 1 ELSE 0 END) AS assistant_count,
      MIN(m.timestamp) AS first_timestamp,
      MAX(m.timestamp) AS last_timestamp,
      ${firstMsgSubquery} AS first_user_message
    FROM messages m
    GROUP BY m.session_id
    ORDER BY MAX(m.timestamp) DESC
  `);

  return stmt.all() as TranscriptSessionSummary[];
}

export function getDistinctProjects(): { project_dir: string; display_name: string; session_count: number }[] {
  const rows = db.prepare(`
    SELECT
      json_extract(payload, '$.cwd') AS cwd,
      COUNT(DISTINCT session_id) AS session_count
    FROM events
    WHERE json_extract(payload, '$.cwd') IS NOT NULL
    GROUP BY cwd
    ORDER BY session_count DESC
  `).all() as { cwd: string; session_count: number }[];

  // Deduplicate by shared root: group subdirectories under their parent
  // Sort shortest-first so roots are encountered before their children
  const sorted = [...rows].sort((a, b) => a.cwd.length - b.cwd.length);
  const groups = new Map<string, number>();

  for (const row of sorted) {
    let merged = false;
    for (const [root, count] of groups) {
      if (row.cwd === root || row.cwd.startsWith(root + '/')) {
        groups.set(root, count + row.session_count);
        merged = true;
        break;
      }
    }
    if (!merged) {
      groups.set(row.cwd, row.session_count);
    }
  }

  return Array.from(groups.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([dir, count]) => ({
      project_dir: dir,
      display_name: dir.split('/').pop() || dir,
      session_count: count,
    }));
}

export function getSessionMessages(sessionId: string): TranscriptMessage[] {
  const stmt = db.prepare(`
    SELECT id, session_id, source_app, role, content, thinking, model, input_tokens, output_tokens, timestamp, uuid
    FROM messages
    WHERE session_id = ?
    ORDER BY timestamp ASC
  `);

  const rows = stmt.all(sessionId) as any[];

  return rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    source_app: row.source_app,
    role: row.role,
    content: row.content,
    thinking: row.thinking || undefined,
    model: row.model || undefined,
    input_tokens: row.input_tokens ?? undefined,
    output_tokens: row.output_tokens ?? undefined,
    timestamp: row.timestamp,
    uuid: row.uuid,
  }));
}

export interface HistoricalInsightsResponse {
  kpis: {
    total_sessions: number;
    total_messages: number;
    avg_messages_per_session: number;
    total_tokens: number;
    unique_models: number;
    active_days: number;
    tool_success_rate: number;
    avg_quality_score: number | null;
  };
  session_volume: Array<{ day: string; session_count: number }>;
  token_by_model: Array<{ model: string; total_input: number; total_output: number; total_tokens: number }>;
  quality_trend: Array<{ run_id: number; evaluator_type: string; timestamp: number; avg_score: number }>;
  tool_reliability: Array<{ tool_name: string; success_count: number; failure_count: number; total_count: number }>;
  activity_by_hour: Array<{ hour: number; event_count: number }>;
}

export function getHistoricalInsights(): HistoricalInsightsResponse {
  // Q1: Message KPIs
  const msgKpis = db.prepare(`
    SELECT COUNT(DISTINCT session_id) AS total_sessions,
           COUNT(*) AS total_messages,
           COALESCE(SUM(COALESCE(input_tokens,0) + COALESCE(output_tokens,0)), 0) AS total_tokens,
           COUNT(DISTINCT model) AS unique_models
    FROM messages WHERE source_app != 'evaluation-runner'
  `).get() as any;

  // Q2: Event KPIs
  const eventKpis = db.prepare(`
    SELECT COUNT(DISTINCT date(timestamp/1000, 'unixepoch', 'localtime')) AS active_days,
           SUM(CASE WHEN hook_event_type='PostToolUse' THEN 1 ELSE 0 END) AS tool_success,
           SUM(CASE WHEN hook_event_type='PostToolUseFailure' THEN 1 ELSE 0 END) AS tool_failure
    FROM events WHERE source_app != 'evaluation-runner'
  `).get() as any;

  // Q3: Avg quality score
  const qualityKpi = db.prepare(`
    SELECT ROUND(AVG(numeric_score), 3) AS avg_quality_score
    FROM evaluation_results WHERE run_id IN (SELECT id FROM evaluation_runs WHERE status='completed')
  `).get() as any;

  // Q4: Sessions by day (30 days)
  const sessionRows = db.prepare(`
    SELECT date(timestamp, 'localtime') AS day, COUNT(DISTINCT session_id) AS session_count
    FROM messages WHERE timestamp >= date('now','-30 days') AND source_app != 'evaluation-runner'
    GROUP BY day ORDER BY day ASC
  `).all() as Array<{ day: string; session_count: number }>;

  // Fill missing days for continuous chart
  const sessionVolume: Array<{ day: string; session_count: number }> = [];
  const dayMap = new Map(sessionRows.map(r => [r.day, r.session_count]));
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const dayStr = d.toISOString().slice(0, 10);
    sessionVolume.push({ day: dayStr, session_count: dayMap.get(dayStr) ?? 0 });
  }

  // Q5: Tokens by model (top 8)
  const tokenByModel = db.prepare(`
    SELECT model, SUM(COALESCE(input_tokens,0)) AS total_input,
           SUM(COALESCE(output_tokens,0)) AS total_output
    FROM messages WHERE model IS NOT NULL AND source_app != 'evaluation-runner'
    GROUP BY model ORDER BY (total_input + total_output) DESC LIMIT 8
  `).all() as Array<{ model: string; total_input: number; total_output: number }>;

  // Q6: Quality trend (per completed eval run)
  const qualityTrend = db.prepare(`
    SELECT r.id AS run_id, r.evaluator_type, r.completed_at AS timestamp, ROUND(AVG(res.numeric_score), 3) AS avg_score
    FROM evaluation_runs r JOIN evaluation_results res ON res.run_id = r.id
    WHERE r.status='completed' GROUP BY r.id ORDER BY r.completed_at ASC
  `).all() as Array<{ run_id: number; evaluator_type: string; timestamp: number; avg_score: number }>;

  // Q7: Tool reliability (top 12)
  const toolReliability = db.prepare(`
    SELECT json_extract(payload, '$.tool_name') AS tool_name,
           SUM(CASE WHEN hook_event_type='PostToolUse' THEN 1 ELSE 0 END) AS success_count,
           SUM(CASE WHEN hook_event_type='PostToolUseFailure' THEN 1 ELSE 0 END) AS failure_count,
           COUNT(*) AS total_count
    FROM events WHERE hook_event_type IN ('PostToolUse','PostToolUseFailure')
      AND json_extract(payload, '$.tool_name') IS NOT NULL AND source_app != 'evaluation-runner'
    GROUP BY tool_name ORDER BY total_count DESC LIMIT 12
  `).all() as Array<{ tool_name: string; success_count: number; failure_count: number; total_count: number }>;

  // Q8: Activity by hour
  const activityByHour = db.prepare(`
    SELECT CAST(strftime('%H', timestamp/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
           COUNT(*) AS event_count
    FROM events WHERE source_app != 'evaluation-runner'
    GROUP BY hour ORDER BY hour ASC
  `).all() as Array<{ hour: number; event_count: number }>;

  // Compute derived KPIs
  const totalSessions = msgKpis.total_sessions ?? 0;
  const totalMessages = msgKpis.total_messages ?? 0;
  const toolSuccess = eventKpis.tool_success ?? 0;
  const toolFailure = eventKpis.tool_failure ?? 0;
  const toolTotal = toolSuccess + toolFailure;

  return {
    kpis: {
      total_sessions: totalSessions,
      total_messages: totalMessages,
      avg_messages_per_session: totalSessions > 0 ? Math.round(totalMessages / totalSessions) : 0,
      total_tokens: msgKpis.total_tokens ?? 0,
      unique_models: msgKpis.unique_models ?? 0,
      active_days: eventKpis.active_days ?? 0,
      tool_success_rate: toolTotal > 0 ? Math.round((toolSuccess / toolTotal) * 10000) / 100 : 0,
      avg_quality_score: qualityKpi.avg_quality_score ?? null,
    },
    session_volume: sessionVolume,
    token_by_model: tokenByModel.map(r => ({
      ...r,
      total_tokens: r.total_input + r.total_output,
    })),
    quality_trend: qualityTrend,
    tool_reliability: toolReliability,
    activity_by_hour: activityByHour,
  };
}

// ─── Session Analysis CRUD ───

export interface SessionAnalysisRow {
  id: number;
  session_id: string;
  source_app: string;
  status: string;
  analysis_json: string | null;
  summary: string | null;
  error_message: string | null;
  model_name: string | null;
  prompt_version: string | null;
  message_count: number | null;
  tokens_analyzed: number | null;
  created_at: number;
  completed_at: number | null;
}

export function upsertSessionAnalysis(data: {
  session_id: string;
  source_app: string;
  status: string;
  analysis_json?: string | null;
  summary?: string | null;
  error_message?: string | null;
  model_name?: string | null;
  prompt_version?: string | null;
  message_count?: number | null;
  tokens_analyzed?: number | null;
  created_at: number;
  completed_at?: number | null;
}): void {
  db.prepare(`
    INSERT OR REPLACE INTO session_analyses
      (session_id, source_app, status, analysis_json, summary, error_message, model_name, prompt_version, message_count, tokens_analyzed, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    data.session_id,
    data.source_app,
    data.status,
    data.analysis_json ?? null,
    data.summary ?? null,
    data.error_message ?? null,
    data.model_name ?? null,
    data.prompt_version ?? null,
    data.message_count ?? null,
    data.tokens_analyzed ?? null,
    data.created_at,
    data.completed_at ?? null,
  );
}

export function getSessionAnalysis(sessionId: string): SessionAnalysisRow | null {
  return db.prepare('SELECT * FROM session_analyses WHERE session_id = ?').get(sessionId) as SessionAnalysisRow | null;
}

export function updateSessionAnalysis(sessionId: string, updates: Partial<Omit<SessionAnalysisRow, 'id' | 'session_id'>>): void {
  const fields: string[] = [];
  const values: any[] = [];
  for (const [key, val] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(val ?? null);
  }
  if (fields.length === 0) return;
  values.push(sessionId);
  db.prepare(`UPDATE session_analyses SET ${fields.join(', ')} WHERE session_id = ?`).run(...values);
}

export function listSessionAnalyses(opts?: { status?: string; limit?: number }): SessionAnalysisRow[] {
  const conditions: string[] = [];
  const params: any[] = [];
  if (opts?.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts?.limit ?? 100;
  params.push(limit);
  return db.prepare(`SELECT * FROM session_analyses ${where} ORDER BY created_at DESC LIMIT ?`).all(...params) as SessionAnalysisRow[];
}

export function getCrossSessionInsight(key: string): { analysis_json: string; model_name: string | null; session_count: number | null; created_at: number } | null {
  return db.prepare('SELECT analysis_json, model_name, session_count, created_at FROM cross_session_insights WHERE insight_key = ?').get(key) as any;
}

export function upsertCrossSessionInsight(key: string, data: { analysis_json: string; model_name?: string | null; session_count?: number | null }): void {
  db.prepare(`
    INSERT OR REPLACE INTO cross_session_insights (insight_key, analysis_json, model_name, session_count, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(key, data.analysis_json, data.model_name ?? null, data.session_count ?? null, Date.now());
}

export { db };
