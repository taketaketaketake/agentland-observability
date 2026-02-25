import { describe, test, expect, beforeEach } from 'bun:test';
import { initDatabase, insertEvent, getRecentEvents, getFilterOptions, updateEventHITLResponse, insertMessages, listTranscriptSessions, getSessionMessages } from '../src/db';

beforeEach(() => {
  initDatabase(':memory:');
});

function makeEvent(overrides: Record<string, any> = {}) {
  return {
    source_app: 'claude-code',
    session_id: 'abc12345-6789-0000-0000-000000000000',
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'Bash', tool_input: { command: 'echo hi' } },
    ...overrides,
  };
}

describe('initDatabase', () => {
  test('creates tables without error', () => {
    expect(() => initDatabase(':memory:')).not.toThrow();
  });
});

describe('insertEvent + getRecentEvents', () => {
  test('insert returns id and timestamp', () => {
    const saved = insertEvent(makeEvent());
    expect(saved.id).toBeGreaterThan(0);
    expect(saved.timestamp).toBeGreaterThan(0);
  });

  test('getRecentEvents retrieves inserted event', () => {
    insertEvent(makeEvent());
    const events = getRecentEvents();
    expect(events).toHaveLength(1);
    expect(events[0].source_app).toBe('claude-code');
    expect(events[0].payload.tool_name).toBe('Bash');
  });

  test('auto-increments ids', () => {
    const e1 = insertEvent(makeEvent());
    const e2 = insertEvent(makeEvent({ hook_event_type: 'PostToolUse' }));
    expect(e2.id).toBeGreaterThan(e1.id!);
  });

  test('returns events in chronological order', () => {
    insertEvent(makeEvent({ timestamp: 1000 }));
    insertEvent(makeEvent({ timestamp: 2000 }));
    insertEvent(makeEvent({ timestamp: 1500 }));
    const events = getRecentEvents();
    expect(events[0].timestamp).toBe(1000);
    expect(events[1].timestamp).toBe(1500);
    expect(events[2].timestamp).toBe(2000);
  });

  test('respects limit parameter', () => {
    for (let i = 0; i < 5; i++) insertEvent(makeEvent());
    const events = getRecentEvents(2);
    expect(events).toHaveLength(2);
  });

  test('stores humanInTheLoop data', () => {
    const hitl = { question: 'Allow?', responseWebSocketUrl: 'ws://localhost:1234', type: 'permission' as const };
    insertEvent(makeEvent({ humanInTheLoop: hitl }));
    const events = getRecentEvents();
    expect(events[0].humanInTheLoop).toEqual(hitl);
    expect(events[0].humanInTheLoopStatus).toEqual({ status: 'pending' });
  });
});

describe('getFilterOptions', () => {
  test('returns distinct values', () => {
    insertEvent(makeEvent({ source_app: 'app-a', hook_event_type: 'PreToolUse' }));
    insertEvent(makeEvent({ source_app: 'app-b', hook_event_type: 'PostToolUse' }));
    insertEvent(makeEvent({ source_app: 'app-a', hook_event_type: 'PreToolUse' }));
    const opts = getFilterOptions();
    expect(opts.source_apps).toEqual(['app-a', 'app-b']);
    expect(opts.hook_event_types).toEqual(['PostToolUse', 'PreToolUse']);
  });

  test('returns empty arrays when DB is empty', () => {
    const opts = getFilterOptions();
    expect(opts.source_apps).toEqual([]);
    expect(opts.session_ids).toEqual([]);
    expect(opts.hook_event_types).toEqual([]);
  });
});

describe('updateEventHITLResponse', () => {
  test('updates status to responded', () => {
    const hitl = { question: 'Allow?', responseWebSocketUrl: 'ws://localhost:1234', type: 'permission' as const };
    const saved = insertEvent(makeEvent({ humanInTheLoop: hitl }));
    const response = { permission: true, respondedAt: Date.now() };
    const updated = updateEventHITLResponse(saved.id!, response);
    expect(updated).not.toBeNull();
    expect(updated!.humanInTheLoopStatus!.status).toBe('responded');
  });

  test('returns null for missing ID', () => {
    const result = updateEventHITLResponse(99999, { respondedAt: Date.now() });
    expect(result).toBeNull();
  });
});

describe('insertMessages', () => {
  function makeMessage(overrides: Record<string, any> = {}) {
    return {
      session_id: 'sess-1111',
      source_app: 'claude-code',
      role: 'user' as const,
      content: 'Hello',
      timestamp: new Date().toISOString(),
      uuid: crypto.randomUUID(),
      ...overrides,
    };
  }

  test('inserts messages and returns count', () => {
    const msgs = [makeMessage(), makeMessage({ role: 'assistant', content: 'Hi there' })];
    const count = insertMessages(msgs);
    expect(count).toBe(2);
  });

  test('deduplicates by uuid', () => {
    const uuid = crypto.randomUUID();
    const msgs = [makeMessage({ uuid }), makeMessage({ uuid })];
    const count = insertMessages(msgs);
    expect(count).toBe(1);
  });
});

describe('listTranscriptSessions', () => {
  test('groups by session and counts correctly', () => {
    const msgs = [
      { session_id: 's1', source_app: 'app', role: 'user' as const, content: 'hi', timestamp: '2024-01-01T00:00:00Z', uuid: crypto.randomUUID() },
      { session_id: 's1', source_app: 'app', role: 'assistant' as const, content: 'hello', timestamp: '2024-01-01T00:00:01Z', uuid: crypto.randomUUID() },
      { session_id: 's2', source_app: 'app', role: 'user' as const, content: 'hey', timestamp: '2024-01-01T00:01:00Z', uuid: crypto.randomUUID() },
    ];
    insertMessages(msgs);
    const sessions = listTranscriptSessions();
    expect(sessions).toHaveLength(2);
    const s1 = sessions.find(s => s.session_id === 's1')!;
    expect(s1.message_count).toBe(2);
    expect(s1.user_count).toBe(1);
    expect(s1.assistant_count).toBe(1);
  });
});

describe('getSessionMessages', () => {
  test('returns messages in chronological order', () => {
    const msgs = [
      { session_id: 'sess-x', source_app: 'app', role: 'user' as const, content: 'first', timestamp: '2024-01-01T00:00:00Z', uuid: crypto.randomUUID() },
      { session_id: 'sess-x', source_app: 'app', role: 'assistant' as const, content: 'second', timestamp: '2024-01-01T00:00:01Z', uuid: crypto.randomUUID() },
    ];
    insertMessages(msgs);
    const result = getSessionMessages('sess-x');
    expect(result).toHaveLength(2);
    expect(result[0].content).toBe('first');
    expect(result[1].content).toBe('second');
  });

  test('returns empty array for unknown session', () => {
    const result = getSessionMessages('nonexistent');
    expect(result).toEqual([]);
  });
});
