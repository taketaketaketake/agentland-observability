import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createServer } from '../src/index';
import { mkdtempSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

let server: ReturnType<typeof createServer>;
let baseUrl: string;
let tmpDir: string;

beforeAll(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'obs-test-'));
  const dbPath = join(tmpDir, 'test.db');
  server = createServer({ port: 0, dbPath });
  baseUrl = `http://localhost:${server.port}`;
});

afterAll(() => {
  server.stop();
  rmSync(tmpDir, { recursive: true, force: true });
});

function postEvent(event: Record<string, any>) {
  return fetch(`${baseUrl}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
}

function validEvent(overrides: Record<string, any> = {}) {
  return {
    source_app: 'test-app',
    session_id: 'sess-00001111-2222-3333-4444-555566667777',
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'Read', tool_input: { path: '/tmp/x' } },
    ...overrides,
  };
}

describe('POST /events', () => {
  test('accepts valid event and returns id + timestamp', async () => {
    const res = await postEvent(validEvent());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBeGreaterThan(0);
    expect(body.timestamp).toBeGreaterThan(0);
    expect(body.source_app).toBe('test-app');
  });

  test('rejects missing required fields', async () => {
    const res = await postEvent({ source_app: 'x' });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Missing');
  });

  test('rejects invalid JSON', async () => {
    const res = await fetch(`${baseUrl}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not json',
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /events/recent', () => {
  test('returns posted events', async () => {
    const res = await fetch(`${baseUrl}/events/recent`);
    expect(res.status).toBe(200);
    const events = await res.json();
    expect(events.length).toBeGreaterThan(0);
  });

  test('respects limit parameter', async () => {
    const res = await fetch(`${baseUrl}/events/recent?limit=1`);
    const events = await res.json();
    expect(events).toHaveLength(1);
  });
});

describe('GET /events/filter-options', () => {
  test('returns correct structure', async () => {
    const res = await fetch(`${baseUrl}/events/filter-options`);
    expect(res.status).toBe(200);
    const opts = await res.json();
    expect(opts).toHaveProperty('source_apps');
    expect(opts).toHaveProperty('session_ids');
    expect(opts).toHaveProperty('hook_event_types');
    expect(opts.source_apps).toContain('test-app');
  });
});

describe('POST /events/:id/respond', () => {
  test('updates HITL response', async () => {
    const hitl = { question: 'Run command?', responseWebSocketUrl: 'ws://localhost:9999', type: 'permission' };
    const createRes = await postEvent(validEvent({ humanInTheLoop: hitl }));
    const created = await createRes.json();

    const res = await fetch(`${baseUrl}/events/${created.id}/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission: true, hookEvent: created }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.humanInTheLoopStatus.status).toBe('responded');
  });

  test('returns 404 for missing event', async () => {
    const res = await fetch(`${baseUrl}/events/99999/respond`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ permission: false, hookEvent: {} }),
    });
    expect(res.status).toBe(404);
  });
});

describe('POST /transcripts', () => {
  test('inserts messages', async () => {
    const res = await fetch(`${baseUrl}/transcripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [
          { session_id: 'ts-1', source_app: 'app', role: 'user', content: 'hello', timestamp: '2024-01-01T00:00:00Z', uuid: crypto.randomUUID() },
          { session_id: 'ts-1', source_app: 'app', role: 'assistant', content: 'hi', timestamp: '2024-01-01T00:00:01Z', uuid: crypto.randomUUID() },
        ],
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.inserted).toBe(2);
  });

  test('rejects empty array', async () => {
    const res = await fetch(`${baseUrl}/transcripts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: [] }),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /transcripts', () => {
  test('lists sessions', async () => {
    const res = await fetch(`${baseUrl}/transcripts`);
    expect(res.status).toBe(200);
    const sessions = await res.json();
    expect(sessions.length).toBeGreaterThan(0);
    expect(sessions[0]).toHaveProperty('session_id');
    expect(sessions[0]).toHaveProperty('message_count');
  });
});

describe('GET /transcripts/:session_id', () => {
  test('returns messages for session', async () => {
    const res = await fetch(`${baseUrl}/transcripts/ts-1`);
    expect(res.status).toBe(200);
    const messages = await res.json();
    expect(messages.length).toBeGreaterThan(0);
    expect(messages[0].session_id).toBe('ts-1');
  });
});

describe('CORS', () => {
  test('OPTIONS returns CORS headers', async () => {
    const res = await fetch(`${baseUrl}/events`, { method: 'OPTIONS' });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(res.headers.get('Access-Control-Allow-Methods')).toContain('POST');
  });
});

describe('WebSocket /stream', () => {
  test('sends initial events on connect', async () => {
    const ws = new WebSocket(`ws://localhost:${server.port}/stream`);
    const msg = await new Promise<any>((resolve, reject) => {
      ws.onmessage = (e) => resolve(JSON.parse(e.data as string));
      ws.onerror = reject;
      setTimeout(() => reject(new Error('ws timeout')), 5000);
    });
    ws.close();
    expect(msg.type).toBe('initial');
    expect(Array.isArray(msg.data)).toBe(true);
  });

  test('broadcasts new events to connected clients', async () => {
    const ws = new WebSocket(`ws://localhost:${server.port}/stream`);
    // Wait for initial message first
    await new Promise<void>((resolve, reject) => {
      ws.onmessage = () => resolve();
      ws.onerror = reject;
      setTimeout(() => reject(new Error('ws timeout')), 5000);
    });

    // Now listen for the broadcast
    const broadcastPromise = new Promise<any>((resolve, reject) => {
      ws.onmessage = (e) => resolve(JSON.parse(e.data as string));
      setTimeout(() => reject(new Error('ws broadcast timeout')), 5000);
    });

    // Post an event to trigger a broadcast
    await postEvent(validEvent({ hook_event_type: 'ws-broadcast-test' }));

    const msg = await broadcastPromise;
    ws.close();
    expect(msg.type).toBe('event');
    expect(msg.data.hook_event_type).toBe('ws-broadcast-test');
  });
});
