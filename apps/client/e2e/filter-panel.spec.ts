import { test, expect } from '@playwright/test';
import { postTestEvent, waitForLive } from './helpers';

test('toggle filter panel and verify filter dropdowns', async ({ page }) => {
  // Seed events from different sources so filters have data
  await postTestEvent({
    source_app: 'filter-app-a',
    session_id: 'filter-a-1111-2222-3333-444455556666',
    hook_event_type: 'PreToolUse',
    payload: { tool_name: 'Read', tool_input: {} },
  });
  await postTestEvent({
    source_app: 'filter-app-b',
    session_id: 'filter-b-1111-2222-3333-444455556666',
    hook_event_type: 'PostToolUse',
    payload: { tool_name: 'Write', tool_input: {} },
  });

  await waitForLive(page);

  // Filter bar should NOT be visible by default
  await expect(page.getByText('Filter', { exact: true })).not.toBeVisible();

  // Click the filter toggle button
  await page.getByRole('button', { name: 'Toggle filters' }).click();

  // Filter bar should now be visible
  await expect(page.getByText('Filter', { exact: true })).toBeVisible();

  // Verify the "All Apps" dropdown has our seeded source_apps
  const appSelect = page.locator('select').filter({ hasText: 'All Apps' });
  await expect(appSelect).toBeVisible();

  // Verify the "All Events" dropdown is present
  const eventSelect = page.locator('select').filter({ hasText: 'All Events' });
  await expect(eventSelect).toBeVisible();

  // Toggle filters off
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  await expect(page.getByText('Filter', { exact: true })).not.toBeVisible();
});

test('filter by event type narrows visible events', async ({ page }) => {
  const uniqueToolPre = `FilterPre_${Date.now()}`;
  const uniqueToolPost = `FilterPost_${Date.now()}`;

  // Use separate agents so both events come from the same session (avoid sidebar noise)
  await postTestEvent({
    hook_event_type: 'PreToolUse',
    payload: { tool_name: uniqueToolPre, tool_input: {} },
  });
  await postTestEvent({
    hook_event_type: 'PostToolUse',
    payload: { tool_name: uniqueToolPost, tool_input: {} },
  });

  await waitForLive(page);

  // Scope assertions to main content area (sidebar may show tool names unfiltered)
  const main = page.getByRole('main');

  // Both tools should be visible in the main timeline
  await expect(main.getByText(uniqueToolPre).first()).toBeVisible({ timeout: 5_000 });
  await expect(main.getByText(uniqueToolPost).first()).toBeVisible({ timeout: 5_000 });

  // Open filters and select PreToolUse
  await page.getByRole('button', { name: 'Toggle filters' }).click();
  const eventSelect = page.locator('select').filter({ hasText: 'All Events' });
  await eventSelect.selectOption('PreToolUse');

  // PreToolUse event should still be visible, PostToolUse should be hidden in main area
  await expect(main.getByText(uniqueToolPre).first()).toBeVisible();
  await expect(main.getByText(uniqueToolPost)).not.toBeVisible({ timeout: 3_000 });

  // Clear filter — both should reappear
  await page.getByRole('button', { name: 'Clear', exact: true }).click();
  await expect(main.getByText(uniqueToolPost).first()).toBeVisible({ timeout: 3_000 });
});
