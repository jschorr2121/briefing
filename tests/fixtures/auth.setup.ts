import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../../playwright/.auth/user.json');

/**
 * Global auth setup — runs once before all test suites.
 * Calls the dev-only /api/test/auth-setup endpoint to get a real
 * NextAuth session cookie, then saves browser storage state so all
 * tests start pre-authenticated.
 */
setup('authenticate as test user', async ({ page }) => {
  // Navigate the browser to the dev-only endpoint so it receives and stores
  // the Set-Cookie header in the browser's own cookie jar.
  await page.goto('/api/test/auth-setup');
  const body = await page.evaluate(() => document.body.innerText);
  expect(body).toContain('"ok":true');

  // Navigate to the home page to confirm auth works end-to-end
  await page.goto('/');
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.getByText('Your Daily News Brief')).toBeVisible({ timeout: 15_000 });

  // Persist cookies + localStorage for all subsequent tests
  await page.context().storageState({ path: authFile });
});
