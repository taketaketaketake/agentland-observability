import { test, expect } from '@playwright/test';

test('dashboard loads with LIVE indicator and stats', async ({ page }) => {
  await page.goto('/');

  // Header renders with logo text
  await expect(page.locator('text=OBSERVABILITY')).toBeVisible();

  // LIVE connection badge appears (exact match to avoid "Live" tab button)
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Stats section visible in the header area
  await expect(page.getByRole('banner').getByText('Events')).toBeVisible();
  await expect(page.getByRole('banner').getByText('Agents')).toBeVisible();
});

test('tab switching: Live → Insights → Transcripts → Live', async ({ page }) => {
  await page.goto('/');

  // Wait for connection
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Click Insights tab
  await page.getByRole('button', { name: /insights/i }).click();
  // Insights panel should render KPI cards
  await expect(page.getByText('Total Events')).toBeVisible();

  // Click Transcripts tab
  await page.getByRole('button', { name: /transcripts/i }).click();
  // Transcripts panel should be visible
  await expect(page.getByRole('button', { name: /transcripts/i })).toBeVisible();

  // Click Live tab to return
  await page.getByRole('button', { name: /live/i }).click();
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible();
});
