/**
 * Authenticated base fixture.
 *
 * All tests that need a signed-in user should import { test, expect } from
 * this file instead of '@playwright/test'. The fixture intercepts
 * /api/auth/session — the exact endpoint useSession() calls — and returns a
 * mock authenticated session, bypassing Google OAuth entirely.
 */

import { test as base, expect } from '@playwright/test';

const MOCK_SESSION = {
  user: {
    name: 'Test User',
    email: 'test@briefing.dev',
    image: null,
  },
  expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const test = base.extend<object>({
  page: async ({ page }, use) => {
    // Intercept the NextAuth session check before any navigation
    await page.route('**/api/auth/session', route =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SESSION),
      })
    );
    await use(page);
  },
});

export { expect };
