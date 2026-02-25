import { test, expect } from '@playwright/test';
import { postTestTranscript } from './helpers';

test('seed transcript, navigate to Transcripts tab, open session', async ({ page }) => {
  const sessionId = `e2e-transcript-${Date.now()}`;

  // Seed a transcript via API
  await postTestTranscript(sessionId, [
    { role: 'user', content: 'Hello from e2e test' },
    { role: 'assistant', content: 'Hi there, this is the assistant reply' },
  ]);

  await page.goto('/');
  await expect(page.getByText('LIVE', { exact: true })).toBeVisible({ timeout: 10_000 });

  // Navigate to Transcripts tab
  await page.getByRole('button', { name: /transcripts/i }).click();

  // Session should be visible in the list (truncated to 8 chars)
  const truncated = sessionId.substring(0, 8);
  await expect(page.getByText(truncated)).toBeVisible({ timeout: 5_000 });

  // Click on the session to open the slide-out panel
  await page.getByText(truncated).click();

  // Slide-out should show the messages
  await expect(page.getByText('Hello from e2e test')).toBeVisible({ timeout: 5_000 });
  await expect(page.getByText('Hi there, this is the assistant reply')).toBeVisible();

  // Close the panel by clicking the backdrop
  const backdrop = page.locator('.bg-black\\/50');
  if (await backdrop.count() > 0) {
    await backdrop.click({ position: { x: 10, y: 10 } });
  }

  // Panel should close — messages no longer visible
  await expect(page.getByText('Hello from e2e test')).not.toBeVisible({ timeout: 3_000 });
});
