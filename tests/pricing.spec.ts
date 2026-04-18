import { test, expect } from './fixtures/base';
import { mockSubscriptionFree, mockSubscriptionPro, mockStripePrices } from './fixtures/mock-data';

test.describe('Pricing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('/api/stripe/prices', route =>
      route.fulfill({ json: mockStripePrices })
    );
    // /api/subscription is also called by useSubscription hook
  });

  test('renders Free and Pro tiers', async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.goto('/pricing');
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible({ timeout: 10_000 });

    await expect(page.getByText(/free/i).first()).toBeVisible();
    await expect(page.getByText(/pro/i).first()).toBeVisible();
  });

  test('shows upgrade CTA for free users', async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.goto('/pricing');
    // Wait for the page to fully render (prices fetch + subscription fetch)
    await expect(page.getByRole('button', { name: /upgrade to pro/i })).toBeVisible({ timeout: 10_000 });
  });

  test('shows manage subscription for pro users', async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionPro })
    );
    await page.goto('/pricing');

    await expect(
      page.getByText(/manage/i).or(page.getByText(/current plan/i)).first()
    ).toBeVisible();
  });

  test('lists key Pro features', async ({ page }) => {
    await page.route('/api/subscription', route =>
      route.fulfill({ json: mockSubscriptionFree })
    );
    await page.goto('/pricing');

    // At least one pro feature mention should be visible
    await expect(
      page.getByText(/unlimited/i).first()
    ).toBeVisible();
  });
});
