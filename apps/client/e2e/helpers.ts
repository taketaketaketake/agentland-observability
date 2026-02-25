const SERVER_URL = 'http://localhost:4444';

export async function postTestEvent(overrides: Record<string, any> = {}) {
  const event = {
    source_app: 'e2e-test',
    session_id: 'e2e-sess-11112222-3333-4444-5555-666677778888',
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'Bash', tool_input: { command: 'echo hello' } },
    ...overrides,
  };
  const res = await fetch(`${SERVER_URL}/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  return res.json();
}

export async function postTestTranscript(sessionId: string, messages: Array<{ role: string; content: string }>) {
  const formatted = messages.map((m, i) => ({
    session_id: sessionId,
    source_app: 'e2e-test',
    role: m.role,
    content: m.content,
    timestamp: new Date(Date.now() + i * 1000).toISOString(),
    uuid: crypto.randomUUID(),
  }));
  const res = await fetch(`${SERVER_URL}/transcripts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: formatted }),
  });
  return res.json();
}
