import { db } from './db';
import type { EvalRun, EvalResult, EvalBaseline, EvalRunStatus, EvaluatorType } from './types';

// ─── Evaluation Runs ───

export function createEvalRun(run: Omit<EvalRun, 'id'>): EvalRun {
  const stmt = db.prepare(`
    INSERT INTO evaluation_runs (evaluator_type, scope_type, scope_session_id, scope_source_app, status, progress_current, progress_total, summary_json, error_message, model_name, prompt_version, options_json, created_at, started_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    run.evaluator_type,
    run.scope_type,
    run.scope_session_id ?? null,
    run.scope_source_app ?? null,
    run.status,
    run.progress_current,
    run.progress_total,
    run.summary_json ? JSON.stringify(run.summary_json) : null,
    run.error_message ?? null,
    run.model_name ?? null,
    run.prompt_version ?? null,
    run.options_json ? JSON.stringify(run.options_json) : null,
    run.created_at,
    run.started_at ?? null,
    run.completed_at ?? null,
  );

  return { ...run, id: result.lastInsertRowid as number };
}

function parseEvalRun(row: any): EvalRun {
  return {
    id: row.id,
    evaluator_type: row.evaluator_type,
    scope_type: row.scope_type,
    scope_session_id: row.scope_session_id ?? null,
    scope_source_app: row.scope_source_app ?? null,
    status: row.status,
    progress_current: row.progress_current,
    progress_total: row.progress_total,
    summary_json: row.summary_json ? JSON.parse(row.summary_json) : null,
    error_message: row.error_message ?? null,
    model_name: row.model_name ?? null,
    prompt_version: row.prompt_version ?? null,
    options_json: row.options_json ? JSON.parse(row.options_json) : null,
    created_at: row.created_at,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
  };
}

export function getEvalRun(id: number): EvalRun | null {
  const row = db.prepare('SELECT * FROM evaluation_runs WHERE id = ?').get(id) as any;
  return row ? parseEvalRun(row) : null;
}

export function listEvalRuns(opts?: { limit?: number; evaluator_type?: string; status?: string }): EvalRun[] {
  const conditions: string[] = [];
  const params: any[] = [];

  if (opts?.evaluator_type) {
    conditions.push('evaluator_type = ?');
    params.push(opts.evaluator_type);
  }
  if (opts?.status) {
    conditions.push('status = ?');
    params.push(opts.status);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = opts?.limit ?? 50;
  params.push(limit);

  const rows = db.prepare(`SELECT * FROM evaluation_runs ${where} ORDER BY created_at DESC LIMIT ?`).all(...params) as any[];
  return rows.map(parseEvalRun);
}

export function updateEvalRunStatus(id: number, status: EvalRunStatus, extra?: {
  progress_current?: number;
  progress_total?: number;
  summary_json?: any;
  error_message?: string;
  started_at?: number;
  completed_at?: number;
  model_name?: string;
  prompt_version?: string;
}): void {
  const sets: string[] = ['status = ?'];
  const params: any[] = [status];

  if (extra?.progress_current !== undefined) {
    sets.push('progress_current = ?');
    params.push(extra.progress_current);
  }
  if (extra?.progress_total !== undefined) {
    sets.push('progress_total = ?');
    params.push(extra.progress_total);
  }
  if (extra?.summary_json !== undefined) {
    sets.push('summary_json = ?');
    params.push(JSON.stringify(extra.summary_json));
  }
  if (extra?.error_message !== undefined) {
    sets.push('error_message = ?');
    params.push(extra.error_message);
  }
  if (extra?.started_at !== undefined) {
    sets.push('started_at = ?');
    params.push(extra.started_at);
  }
  if (extra?.completed_at !== undefined) {
    sets.push('completed_at = ?');
    params.push(extra.completed_at);
  }
  if (extra?.model_name !== undefined) {
    sets.push('model_name = ?');
    params.push(extra.model_name);
  }
  if (extra?.prompt_version !== undefined) {
    sets.push('prompt_version = ?');
    params.push(extra.prompt_version);
  }

  params.push(id);
  db.prepare(`UPDATE evaluation_runs SET ${sets.join(', ')} WHERE id = ?`).run(...params);
}

export function deleteEvalRun(id: number): boolean {
  db.prepare('DELETE FROM evaluation_results WHERE run_id = ?').run(id);
  const result = db.prepare('DELETE FROM evaluation_runs WHERE id = ?').run(id);
  return result.changes > 0;
}

// ─── Evaluation Results ───

export function insertEvalResults(results: Omit<EvalResult, 'id'>[]): void {
  const stmt = db.prepare(`
    INSERT INTO evaluation_results (run_id, session_id, source_app, item_type, item_id, numeric_score, scores_json, rationale, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const CHUNK_SIZE = 25;
  for (let i = 0; i < results.length; i += CHUNK_SIZE) {
    const chunk = results.slice(i, i + CHUNK_SIZE);
    const insertChunk = db.transaction((rows: Omit<EvalResult, 'id'>[]) => {
      for (const r of rows) {
        stmt.run(
          r.run_id,
          r.session_id,
          r.source_app,
          r.item_type,
          r.item_id,
          r.numeric_score,
          JSON.stringify(r.scores_json),
          r.rationale ?? null,
          r.metadata_json ? JSON.stringify(r.metadata_json) : null,
          r.created_at,
        );
      }
    });
    insertChunk(chunk);
  }
}

export function getEvalResults(runId: number, opts?: { limit?: number; offset?: number; include_rationale?: boolean }): EvalResult[] {
  const limit = opts?.limit ?? 100;
  const offset = opts?.offset ?? 0;
  const includeRationale = opts?.include_rationale !== false;

  const cols = includeRationale
    ? '*'
    : 'id, run_id, session_id, source_app, item_type, item_id, numeric_score, scores_json, metadata_json, created_at';

  const rows = db.prepare(`SELECT ${cols} FROM evaluation_results WHERE run_id = ? ORDER BY created_at ASC LIMIT ? OFFSET ?`).all(runId, limit, offset) as any[];

  return rows.map(row => ({
    id: row.id,
    run_id: row.run_id,
    session_id: row.session_id,
    source_app: row.source_app,
    item_type: row.item_type,
    item_id: row.item_id,
    numeric_score: row.numeric_score,
    scores_json: JSON.parse(row.scores_json),
    rationale: includeRationale ? (row.rationale ?? null) : null,
    metadata_json: row.metadata_json ? JSON.parse(row.metadata_json) : null,
    created_at: row.created_at,
  }));
}

// ─── Evaluation Baselines ───

export function insertEvalBaseline(baseline: Omit<EvalBaseline, 'id'>): EvalBaseline {
  const stmt = db.prepare(`
    INSERT INTO evaluation_baselines (evaluator_type, metric_name, model_name, prompt_version, window_start, window_end, sample_count, mean_score, stddev_score, percentile_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    baseline.evaluator_type,
    baseline.metric_name,
    baseline.model_name ?? null,
    baseline.prompt_version ?? null,
    baseline.window_start,
    baseline.window_end,
    baseline.sample_count,
    baseline.mean_score,
    baseline.stddev_score,
    baseline.percentile_json ? JSON.stringify(baseline.percentile_json) : null,
    baseline.created_at,
  );

  return { ...baseline, id: result.lastInsertRowid as number };
}

export function getEvalBaselines(evaluatorType: EvaluatorType, opts?: { prompt_version?: string; model_name?: string }): EvalBaseline[] {
  const conditions: string[] = ['evaluator_type = ?'];
  const params: any[] = [evaluatorType];

  if (opts?.prompt_version) {
    conditions.push('prompt_version = ?');
    params.push(opts.prompt_version);
  }
  if (opts?.model_name) {
    conditions.push('model_name = ?');
    params.push(opts.model_name);
  }

  const rows = db.prepare(`SELECT * FROM evaluation_baselines WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`).all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    evaluator_type: row.evaluator_type,
    metric_name: row.metric_name,
    model_name: row.model_name ?? null,
    prompt_version: row.prompt_version ?? null,
    window_start: row.window_start,
    window_end: row.window_end,
    sample_count: row.sample_count,
    mean_score: row.mean_score,
    stddev_score: row.stddev_score,
    percentile_json: row.percentile_json ? JSON.parse(row.percentile_json) : null,
    created_at: row.created_at,
  }));
}

// ─── Summary / Aggregation ───

export function getEvalSummary() {
  const types: EvaluatorType[] = ['tool_success', 'transcript_quality', 'reasoning_quality', 'regression'];

  return types.map(evaluator_type => {
    const lastRun = db.prepare(
      'SELECT * FROM evaluation_runs WHERE evaluator_type = ? ORDER BY created_at DESC LIMIT 1'
    ).get(evaluator_type) as any;

    const lastCompleted = lastRun?.status === 'completed' ? lastRun : db.prepare(
      "SELECT * FROM evaluation_runs WHERE evaluator_type = ? AND status = 'completed' ORDER BY created_at DESC LIMIT 1"
    ).get(evaluator_type) as any;

    const sampleCount = lastCompleted
      ? (db.prepare('SELECT COUNT(*) as cnt FROM evaluation_results WHERE run_id = ?').get(lastCompleted.id) as any)?.cnt ?? 0
      : 0;

    return {
      evaluator_type,
      last_run_id: lastRun?.id ?? null,
      last_run_status: lastRun?.status ?? null,
      last_run_at: lastRun?.created_at ?? null,
      last_run_model: lastCompleted?.model_name ?? null,
      last_run_prompt_version: lastCompleted?.prompt_version ?? null,
      last_run_sample_count: sampleCount,
      summary: lastCompleted?.summary_json ? JSON.parse(lastCompleted.summary_json) : null,
    };
  });
}

// ─── Queries for evaluators ───

export function getToolEvents(opts: { since?: number; session_id?: string; source_app?: string }) {
  const conditions: string[] = ["hook_event_type IN ('PostToolUse', 'PostToolUseFailure')"];
  const params: any[] = [];

  if (opts.since) {
    conditions.push('timestamp >= ?');
    params.push(opts.since);
  }
  if (opts.session_id) {
    conditions.push('session_id = ?');
    params.push(opts.session_id);
  }
  if (opts.source_app) {
    conditions.push('source_app = ?');
    params.push(opts.source_app);
  }

  // Defense in depth: exclude evaluation system events
  conditions.push("source_app != 'evaluation-runner'");

  const rows = db.prepare(
    `SELECT id, source_app, session_id, hook_event_type, payload, timestamp FROM events WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC`
  ).all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    source_app: row.source_app,
    session_id: row.session_id,
    hook_event_type: row.hook_event_type,
    payload: JSON.parse(row.payload),
    timestamp: row.timestamp,
  }));
}

export function getAssistantMessages(opts: { since?: number; session_id?: string; source_app?: string; with_thinking?: boolean }) {
  const conditions: string[] = ["role = 'assistant'", "source_app != 'evaluation-runner'"];
  const params: any[] = [];

  if (opts.since) {
    conditions.push("timestamp >= ?");
    params.push(new Date(opts.since).toISOString());
  }
  if (opts.session_id) {
    conditions.push('session_id = ?');
    params.push(opts.session_id);
  }
  if (opts.source_app) {
    conditions.push('source_app = ?');
    params.push(opts.source_app);
  }
  if (opts.with_thinking) {
    conditions.push('thinking IS NOT NULL');
  }

  const rows = db.prepare(
    `SELECT * FROM messages WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC`
  ).all(...params) as any[];

  return rows.map(row => ({
    id: row.id,
    session_id: row.session_id,
    source_app: row.source_app,
    role: row.role as 'user' | 'assistant',
    content: row.content,
    thinking: row.thinking ?? undefined,
    model: row.model ?? undefined,
    input_tokens: row.input_tokens ?? undefined,
    output_tokens: row.output_tokens ?? undefined,
    timestamp: row.timestamp,
    uuid: row.uuid,
  }));
}

export function getPrecedingUserMessage(sessionId: string, assistantTimestamp: string) {
  const row = db.prepare(
    `SELECT * FROM messages WHERE session_id = ? AND role = 'user' AND timestamp < ? ORDER BY timestamp DESC LIMIT 1`
  ).get(sessionId, assistantTimestamp) as any;

  if (!row) return null;

  return {
    id: row.id,
    session_id: row.session_id,
    source_app: row.source_app,
    role: row.role as 'user',
    content: row.content,
    timestamp: row.timestamp,
    uuid: row.uuid,
  };
}

export function getEvalResultScores(runIds: number[]) {
  if (runIds.length === 0) return [];
  const placeholders = runIds.map(() => '?').join(',');
  return db.prepare(
    `SELECT run_id, numeric_score, scores_json FROM evaluation_results WHERE run_id IN (${placeholders})`
  ).all(...runIds) as { run_id: number; numeric_score: number; scores_json: string }[];
}

export function getCompletedRunIds(evaluatorType: EvaluatorType, opts?: { since?: number; until?: number; prompt_version?: string }): number[] {
  const conditions: string[] = ["evaluator_type = ?", "status = 'completed'"];
  const params: any[] = [evaluatorType];

  if (opts?.since) {
    conditions.push('created_at >= ?');
    params.push(opts.since);
  }
  if (opts?.until) {
    conditions.push('created_at <= ?');
    params.push(opts.until);
  }
  if (opts?.prompt_version) {
    conditions.push('prompt_version = ?');
    params.push(opts.prompt_version);
  }

  const rows = db.prepare(
    `SELECT id FROM evaluation_runs WHERE ${conditions.join(' AND ')} ORDER BY created_at ASC`
  ).all(...params) as { id: number }[];

  return rows.map(r => r.id);
}
