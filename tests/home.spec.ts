import { test, expect } from './fixtures/base';
import {
  mockSubscriptionFree,
  mockSubscriptionLimitReached,
  mockTopicsResponse,
  mockGenerateResponse,
  mockGenerateLimitReached,
} from './fixtures/mock-data';

test.describe('Home page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.route('/api/topics', route =>
      route.fulfill({ json: mockTopicsResponse })
    );

    await page.goto('/');
    // Wait for the input to confirm React has hydrated
    const input = page.getByPlaceholder(/add any topics/i);
    await expect(input).toBeVisible({ timeout: 10_000 });

    // Add topics via UI — same flow as a real user
    await input.fill('Artificial Intelligence');
    await input.press('Enter');
    await input.fill('World News');
    await input.press('Enter');
  });

  test('renders hero section and topic input', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Your Daily News Brief' })).toBeVisible();
    await expect(page.getByPlaceholder(/add any topics/i)).toBeVisible();
  });

  test('shows added topics as chips', async ({ page }) => {
    await expect(page.getByText('Artificial Intelligence')).toBeVisible();
    await expect(page.getByText('World News')).toBeVisible();
  });

  test('generate button is enabled when a topic is active', async ({ page }) => {
    const btn = page.getByRole('button', { name: /generate briefing/i });
    await expect(btn).toBeEnabled();
  });

  test('generate button is disabled when no topics are enabled', async ({ page }) => {
    // Remove all topics from localStorage
    await page.evaluate(() => localStorage.setItem('briefing-topics', '[]'));
    await page.reload();
    const btn = page.getByRole('button', { name: /generate briefing/i });
    await expect(btn).toBeDisabled();
  });

  test('adding a topic via input appends it to the list', async ({ page }) => {
    const input = page.getByPlaceholder(/add any topics/i);
    await input.fill('Climate Change');
    await input.press('Enter');
    await expect(page.getByText('Climate Change')).toBeVisible();
    // Input should be cleared
    await expect(input).toHaveValue('');
  });

  test('clicking a suggestion chip adds it as a topic', async ({ page }) => {
    // Suggestions render as "+ Finance", "+ Sports" etc.
    const financeChip = page.getByRole('button', { name: /\+ finance/i });
    await expect(financeChip).toBeVisible();
    await financeChip.click();
    // After clicking, Finance should appear as a topic chip (without the "+ " prefix)
    await expect(page.getByText('Finance')).toBeVisible();
  });

  test('removing a topic removes it from the list', async ({ page }) => {
    // Each topic chip is a div containing the name span and an X button
    const aiChip = page.locator('div').filter({ hasText: /^Artificial Intelligence$/ }).first();
    await expect(aiChip).toBeVisible();
    // The X button is the last button inside the chip div
    await aiChip.getByRole('button').click();
    // The topic chip should be gone
    await expect(
      page.locator('div').filter({ hasText: /^Artificial Intelligence$/ })
    ).toHaveCount(0);
  });

  test('generate button shows loading state during generation', async ({ page }) => {
    // Delay the mock so we can catch the loading state
    await page.route('/api/generate', async route => {
      await new Promise(r => setTimeout(r, 300));
      await route.fulfill({ json: mockGenerateResponse });
    });

    const btn = page.getByRole('button', { name: /generate briefing/i });
    await btn.click();
    await expect(page.getByText('Generating...')).toBeVisible();
    // After mock resolves, briefings appear
    await expect(page.getByText('Artificial Intelligence')).toBeVisible({ timeout: 5_000 });
  });

  test('successful generation renders briefing cards', async ({ page }) => {
    await page.route('/api/generate', route =>
      route.fulfill({ json: mockGenerateResponse })
    );

    await page.getByRole('button', { name: /generate briefing/i }).click();

    // Both briefing cards should appear
    await expect(page.getByText('OpenAI Releases Next-Generation Reasoning Model')).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('G7 Leaders Convene for Emergency Economic Summit')).toBeVisible({ timeout: 5_000 });
  });

  test('429 limit-reached response shows upgrade modal', async ({ page }) => {
    await page.route('/api/generate', route =>
      route.fulfill({ status: 429, json: mockGenerateLimitReached })
    );
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionLimitReached })
    );

    await page.getByRole('button', { name: /generate briefing/i }).click();

    // UpgradeModal should appear
    await expect(
      page.getByText(/upgrade/i).or(page.getByText(/daily limit/i)).first()
    ).toBeVisible({ timeout: 5_000 });
  });

  test('free tier usage indicator is visible after generating', async ({ page }) => {
    // Subscription shows 1 of 3 used
    await expect(page.getByText(/free briefings used today/i)).toBeVisible();
  });
});
