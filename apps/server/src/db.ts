import { Database } from 'bun:sqlite';
import type { HookEvent, FilterOptions, TranscriptMessage, TranscriptSessionSummary } from './types';

let db: Database;

export function initDatabase(): void {
  db = new Database('events.db');

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

export function listTranscriptSessions(): TranscriptSessionSummary[] {
  const stmt = db.prepare(`
    SELECT
      session_id,
      source_app,
      COUNT(*) AS message_count,
      SUM(CASE WHEN role = 'user' THEN 1 ELSE 0 END) AS user_count,
      SUM(CASE WHEN role = 'assistant' THEN 1 ELSE 0 END) AS assistant_count,
      MIN(timestamp) AS first_timestamp,
      MAX(timestamp) AS last_timestamp
    FROM messages
    GROUP BY session_id
    ORDER BY MAX(timestamp) DESC
  `);

  return stmt.all() as TranscriptSessionSummary[];
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

export { db };
