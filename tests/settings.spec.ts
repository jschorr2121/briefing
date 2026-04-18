import { test, expect } from './fixtures/base';
import { mockSubscriptionFree } from './fixtures/mock-data';

test.describe('Settings modal', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.goto('/');
    await expect(page.getByRole('button', { name: /settings/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test('opens via Settings button', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    // The modal has a "Briefing Length" label
    await expect(page.getByText('Briefing Length')).toBeVisible({ timeout: 3_000 });
  });

  test('briefing length options are present', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByText('Briefing Length')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Short', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Medium', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Long', exact: true })).toBeVisible();
  });

  test('tone options are present', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByText('Tone')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Casual' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Professional' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Technical' })).toBeVisible();
  });

  test('persists length selection to localStorage', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByText('Briefing Length')).toBeVisible();

    // Select "Short" then save
    await page.getByRole('button', { name: 'Short', exact: true }).click();
    await page.getByRole('button', { name: 'Save', exact: true }).click();

    // Settings should be persisted in localStorage
    const stored = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('briefing-settings') || '{}')
    );
    expect(stored.briefingLength).toBe('short');
  });

  test('closes with Escape key', async ({ page }) => {
    await page.getByRole('button', { name: /settings/i }).first().click();
    await expect(page.getByText('Briefing Length')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Briefing Length')).toBeHidden({ timeout: 2_000 });
  });
});
