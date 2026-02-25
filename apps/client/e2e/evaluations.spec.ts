import { test, expect } from '@playwright/test';
import { waitForLive } from './helpers';

test('evaluations tab renders evaluator cards and empty run history', async ({ page }) => {
  await waitForLive(page);

  // Navigate to Evaluations tab
  await page.getByRole('button', { name: /evals/i }).click();

  // KPI cards should render with default "—" values
  await expect(page.getByText('Tool Success').first()).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Avg Helpfulness')).toBeVisible();
  await expect(page.getByText('Avg Accuracy')).toBeVisible();
  await expect(page.getByText('Regression Alerts')).toBeVisible();

  // Evaluator card titles should be visible
  await expect(page.getByText('Tool Success Rate').first()).toBeVisible();
  await expect(page.getByText('Transcript Quality').first()).toBeVisible();
  await expect(page.getByText('Reasoning Quality').first()).toBeVisible();
  await expect(page.getByText('Regression Detection').first()).toBeVisible();

  // Run buttons should exist
  const runButtons = page.getByRole('button', { name: 'Run' });
  expect(await runButtons.count()).toBeGreaterThanOrEqual(1);

  // Run History section should show empty state
  await expect(page.getByText('Run History')).toBeVisible();
  await expect(page.getByText('No evaluation runs yet')).toBeVisible();
});

test('evaluations tab has scope filter controls', async ({ page }) => {
  await waitForLive(page);

  await page.getByRole('button', { name: /evals/i }).click();

  // Scope filter section should be visible
  await expect(page.getByText('Scope')).toBeVisible({ timeout: 5_000 });

  // Time range dropdown should have options
  const timeSelect = page.locator('select').filter({ hasText: 'Last 24 hours' });
  await expect(timeSelect).toBeVisible();

  // "All Projects" dropdown
  const projectSelect = page.locator('select').filter({ hasText: 'All Projects' });
  await expect(projectSelect).toBeVisible();

  // "All Sessions" placeholder for multi-select
  await expect(page.getByText('All Sessions')).toBeVisible();
});
