import { test, expect } from '@playwright/test';
import { postTestEvent, waitForLive } from './helpers';

test('insights panel shows KPI cards with live event data', async ({ page }) => {
  // Seed multiple events from different agents (avoid "insights" in names to prevent selector collisions)
  for (let i = 0; i < 5; i++) {
    await postTestEvent({
      source_app: 'kpi-agent-a',
      session_id: 'kpitest-a-1111-2222-3333-444455556666',
      payload: { tool_name: 'Read', tool_input: {} },
    });
  }
  await postTestEvent({
    source_app: 'kpi-agent-b',
    session_id: 'kpitest-b-1111-2222-3333-444455556666',
    payload: { tool_name: 'Write', tool_input: {} },
  });

  await waitForLive(page);

  // Navigate to Insights tab (use exact match to avoid matching agent buttons)
  await page.getByRole('button', { name: 'Insights', exact: true }).click();

  // Live sub-tab should be active by default
  await expect(page.getByText('Total Events')).toBeVisible({ timeout: 5_000 });

  // KPI values should reflect seeded data — at least some agents visible
  await expect(page.getByText('Agents').first()).toBeVisible();
  await expect(page.getByText('Events/Min')).toBeVisible();
  await expect(page.getByText('Top Tool')).toBeVisible();
  await expect(page.getByText('Top Event')).toBeVisible();

  // Charts should render
  await expect(page.getByText('Event Volume')).toBeVisible();
  await expect(page.getByText('Event Types')).toBeVisible();
  await expect(page.getByText('Tool Usage')).toBeVisible();
  await expect(page.getByText('Tool Rankings')).toBeVisible();
  await expect(page.getByText('Agent Activity')).toBeVisible();
});

test('insights sub-tabs: Live → Historical → AI Insights', async ({ page }) => {
  // Seed at least one event so live view renders charts
  await postTestEvent({
    source_app: 'subtab-agent',
    session_id: 'subtab-1111-2222-3333-444455556666',
  });

  await waitForLive(page);
  await page.getByRole('button', { name: 'Insights', exact: true }).click();

  // Default is Live sub-tab
  await expect(page.getByText('Total Events')).toBeVisible({ timeout: 5_000 });

  // Switch to Historical sub-tab
  await page.getByRole('button', { name: 'Historical' }).click();
  // Historical KPIs should appear (or loading state)
  await expect(page.getByText('Sessions').first()).toBeVisible({ timeout: 5_000 });

  // Switch to AI Insights sub-tab
  await page.getByRole('button', { name: 'AI Insights' }).click();
  // Should show either insights content or a "no provider" / "insufficient data" message
  await expect(
    page.getByText('No LLM provider configured').or(
      page.getByText('Insufficient data')
    ).or(
      page.getByText('Overall Summary')
    ).or(
      page.getByText('Synthesizing AI insights')
    ).first()
  ).toBeVisible({ timeout: 10_000 });

  // Switch back to Live sub-tab (scoped to main to avoid matching the header Live tab)
  await page.getByRole('main').getByRole('button', { name: 'Live' }).click();
  await expect(page.getByText('Total Events')).toBeVisible();
});
