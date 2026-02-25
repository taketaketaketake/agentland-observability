import { test, expect } from '@playwright/test';
import { postTestEvent, waitForLive } from './helpers';

test('agent sidebar shows agents after events are received', async ({ page }) => {
  await postTestEvent({
    source_app: 'sidebar-agent',
    session_id: 'sidebar-1111-2222-3333-444455556666',
    payload: { tool_name: 'Bash', tool_input: {} },
  });

  await waitForLive(page);

  // Sidebar should be visible by default with "Agents" header
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByText('Agents')).toBeVisible();

  // The agent should appear in the sidebar with its ID (source_app:truncated_session)
  await expect(sidebar.getByText('sidebar-agent').first()).toBeVisible({ timeout: 5_000 });
  await expect(sidebar.getByText('sidebar-').first()).toBeVisible();

  // Status should show ACTIVE or IDLE
  const statusText = sidebar.getByText(/ACTIVE|IDLE/).first();
  await expect(statusText).toBeVisible();
});

test('toggle sidebar visibility', async ({ page }) => {
  await postTestEvent({
    source_app: 'toggle-agent',
    session_id: 'toggle-1111-2222-3333-444455556666',
    payload: { tool_name: 'Read', tool_input: {} },
  });

  await waitForLive(page);

  // Sidebar should be visible by default
  const sidebar = page.locator('aside');
  await expect(sidebar).toBeVisible();

  // Click the toggle agents panel button to hide sidebar
  await page.getByRole('button', { name: 'Toggle agents panel' }).click();
  await expect(sidebar).not.toBeVisible();

  // Click again to show sidebar
  await page.getByRole('button', { name: 'Toggle agents panel' }).click();
  await expect(sidebar).toBeVisible();
});

test('agent sidebar shows event count per agent', async ({ page }) => {
  const sourceApp = `count-agent-${Date.now()}`;
  const sessionId = `count-1111-2222-3333-444455556666`;

  // Post 3 events from the same agent
  for (let i = 0; i < 3; i++) {
    await postTestEvent({
      source_app: sourceApp,
      session_id: sessionId,
      payload: { tool_name: `Tool${i}`, tool_input: {} },
    });
  }

  await waitForLive(page);

  const sidebar = page.locator('aside');
  // The agent card should be visible with the source app name, and event count
  const agentCard = sidebar.getByRole('button', { name: new RegExp(sourceApp) });
  await expect(agentCard).toBeVisible({ timeout: 5_000 });
  // Event count "3" appears in a small span — use exact text match to avoid matching "3s" time display
  await expect(agentCard.getByText('3', { exact: true })).toBeVisible();
});

test('agent sidebar shows "No agents connected" when empty after clear', async ({ page }) => {
  await waitForLive(page);

  // Click clear events to reset the timeline
  await page.getByRole('button', { name: 'Clear events' }).click();

  // Sidebar should show the empty state
  const sidebar = page.locator('aside');
  await expect(sidebar.getByText('No agents connected')).toBeVisible({ timeout: 3_000 });
});
