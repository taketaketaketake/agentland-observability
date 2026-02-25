import { test, expect } from '@playwright/test';
import { postTestEvent, waitForLive } from './helpers';

test('different hook_event_types render with correct badges', async ({ page }) => {
  const suffix = Date.now();

  await postTestEvent({
    hook_event_type: 'PreToolUse',
    payload: { tool_name: `PreTool_${suffix}`, tool_input: {} },
  });
  await postTestEvent({
    hook_event_type: 'PostToolUse',
    payload: { tool_name: `PostTool_${suffix}`, tool_input: {} },
  });
  await postTestEvent({
    hook_event_type: 'Notification',
    payload: { tool_name: `Notify_${suffix}`, title: 'Test notification' },
  });

  await waitForLive(page);

  // All three tool names should appear
  await expect(page.getByText(`PreTool_${suffix}`).first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(`PostTool_${suffix}`).first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText(`Notify_${suffix}`).first()).toBeVisible({ timeout: 5_000 });

  // Event type badges should display
  await expect(page.getByText('Pre Tool Use').first()).toBeVisible();
  await expect(page.getByText('Post Tool Use').first()).toBeVisible();
  await expect(page.getByText('Notification').first()).toBeVisible();
});

test('clear events button removes all events from timeline', async ({ page }) => {
  const uniqueTool = `ClearTest_${Date.now()}`;

  await postTestEvent({
    payload: { tool_name: uniqueTool, tool_input: {} },
  });

  await waitForLive(page);

  // Event should be visible
  await expect(page.getByText(uniqueTool).first()).toBeVisible({ timeout: 5_000 });

  // Click the clear button (trash icon)
  await page.getByRole('button', { name: 'Clear events' }).click();

  // Event should no longer be visible in the timeline
  await expect(page.getByText(uniqueTool)).not.toBeVisible({ timeout: 3_000 });
});

test('event with HITL data renders in timeline', async ({ page }) => {
  const uniqueTool = `HITLTool_${Date.now()}`;

  await postTestEvent({
    hook_event_type: 'PreToolUse',
    payload: {
      tool_name: uniqueTool,
      tool_input: { command: 'rm -rf /' },
    },
    humanInTheLoop: {
      question: 'Allow this dangerous command?',
      status: 'pending',
      responseWebSocketUrl: 'ws://localhost:9999/fake',
    },
  });

  await waitForLive(page);

  // The event should appear with the tool name
  await expect(page.getByText(uniqueTool).first()).toBeVisible({ timeout: 5_000 });
});
