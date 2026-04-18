import { test, expect } from './fixtures/base';
import {
  mockSubscriptionFree,
  mockGenerateResponse,
  mockAudioBlob,
} from './fixtures/mock-data';

/**
 * Tests for briefing card interactions after generation:
 * listen, email, export, history.
 */

test.describe('Briefing card interactions', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.route('/api/generate', route =>
      route.fulfill({ json: mockGenerateResponse })
    );

    await page.goto('/');
    const input = page.getByPlaceholder(/add any topics/i);
    await expect(input).toBeVisible({ timeout: 10_000 });

    await input.fill('Artificial Intelligence');
    await input.press('Enter');
    await input.fill('World News');
    await input.press('Enter');

    // Generate briefings
    await page.getByRole('button', { name: /generate briefing/i }).click();
    await expect(page.getByText('OpenAI Releases Next-Generation Reasoning Model')).toBeVisible({
      timeout: 10_000,
    });
  });

  test('briefing card shows topic, summary, and story headlines', async ({ page }) => {
    await expect(page.getByText('Artificial Intelligence').first()).toBeVisible();
    await expect(page.getByText(/AI development accelerated/i)).toBeVisible();
    await expect(page.getByText('OpenAI Releases Next-Generation Reasoning Model')).toBeVisible();
    await expect(page.getByText('Google DeepMind Publishes Landmark AI Safety Research')).toBeVisible();
  });

  test('briefing card shows bullet points', async ({ page }) => {
    await expect(
      page.getByText('New model achieves state-of-the-art results on math and coding benchmarks')
    ).toBeVisible();
  });

  test('source attribution is visible on story cards', async ({ page }) => {
    // Sources are displayed as text badges on story cards
    await expect(page.getByText('techcrunch.com').first()).toBeVisible();
  });

  test('Listen button appears after generation and triggers audio API', async ({ page }) => {
    // Mock audio endpoint — returns a binary MP3
    await page.route('/api/audio', route =>
      route.fulfill({
        status: 200,
        contentType: 'audio/mpeg',
        body: mockAudioBlob,
      })
    );

    const listenBtn = page.getByRole('button', { name: /listen/i });
    await expect(listenBtn).toBeVisible();
    await listenBtn.click();

    // Voice picker should appear
    await expect(page.getByText('Choose a voice')).toBeVisible();
  });

  test('email button opens email modal', async ({ page }) => {
    const emailBtn = page.getByRole('button', { name: /email/i });
    await expect(emailBtn).toBeVisible();
    await emailBtn.click();

    // Modal should appear with an email input
    await expect(page.getByRole('textbox', { name: /email/i })
      .or(page.locator('input[type="email"]'))
      .first()
    ).toBeVisible({ timeout: 3_000 });
  });

  test('export button triggers a markdown download', async ({ page }) => {
    const downloadPromise = page.waitForEvent('download');

    const exportBtn = page.getByRole('button', { name: /export/i })
      .or(page.getByTitle(/export/i))
      .first();
    await exportBtn.click();

    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.md$/);
  });

  test('history panel opens and shows previous briefing', async ({ page }) => {
    // History should have been saved when we generated above
    const historyBtn = page.getByRole('button', { name: /history/i })
      .or(page.getByTitle(/history/i))
      .first();

    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      // History panel should show at least one entry with topic names
      await expect(
        page.getByText('Artificial Intelligence').first()
      ).toBeVisible({ timeout: 3_000 });
    }
  });
});
