import { test, expect } from '@playwright/test';
import { postTestEvent } from './helpers';

test('event posted via API appears in UI via WebSocket', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Post an event with a unique tool name
  await postTestEvent({
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'UniqueTestTool', tool_input: {} },
  });

  // Event should appear — tool name visible somewhere on page
  await expect(page.getByText('UniqueTestTool').first()).toBeVisible({ timeout: 5_000 });

  // Truncated session ID visible (first 8 chars)
  await expect(page.getByText('e2e-sess').first()).toBeVisible();

  // Event type badge visible (displayed as "Pre Tool Use" with uppercase CSS)
  await expect(page.getByText('Pre Tool Use').first()).toBeVisible();
});

test('multiple agents show up with distinct tags', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Post events from two different agents
  await postTestEvent({
    source_app: 'agent-alpha',
    session_id: 'alpha111-2222-3333-4444-555566667777',
    payload: { tool_name: 'Read', tool_input: {} },
  });
  await postTestEvent({
    source_app: 'agent-beta',
    session_id: 'beta2222-3333-4444-5555-666677778888',
    payload: { tool_name: 'Write', tool_input: {} },
  });

  // Both agent tags should appear (use first() to handle sidebar + timeline duplicates)
  await expect(page.getByText('alpha111').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('beta2222').first()).toBeVisible({ timeout: 5_000 });
});
