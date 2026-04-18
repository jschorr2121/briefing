import { test, expect } from '@playwright/test';

/**
 * Smoke tests — public-facing pages and auth redirection.
 * These run without needing to mock any APIs.
 */

test.describe('Public pages', () => {

  test('login page renders correctly', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('heading', { name: 'Welcome to Briefing' })).toBeVisible();
    await expect(page.getByRole('button', { name: /continue with google/i })).toBeVisible();
  });

  test('pricing page loads without error', async ({ page }) => {
    await page.goto('/pricing');
    await expect(page).toHaveTitle(/briefing/i);
    // No 500 error
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
    await expect(page.locator('body')).not.toContainText('Application error');
  });

  test('privacy page loads without error', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page).toHaveTitle(/briefing/i);
    await expect(page.locator('body')).not.toContainText('Internal Server Error');
  });

  test('unauthenticated visit to / redirects to login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
  });

  test('unauthenticated visit to /schedule redirects to login', async ({ page }) => {
    await page.goto('/schedule');
    await expect(page).toHaveURL(/\/login/);
  });
});
