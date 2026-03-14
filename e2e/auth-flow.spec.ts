import { test, expect } from '@playwright/test';
import { loginWithTestAccount, loginAsGuest, navigateToSettings } from './helpers';

test.describe('Auth flow', () => {
  test('email sign-in redirects to authenticated app', async ({ page }) => {
    await loginWithTestAccount(page);

    // Should see the library nav tab
    await expect(page.getByTestId('nav-library')).toBeVisible();

    // Should NOT see the auth screen buttons
    await expect(page.getByTestId('btn-guest')).not.toBeVisible();
  });

  test('sign out redirects to auth screen', async ({ page }) => {
    await loginWithTestAccount(page);
    await navigateToSettings(page);

    // Click sign out
    await page.getByTestId('btn-sign-out').click();
    await page.waitForTimeout(300);

    // Confirm sign out dialog
    await page.getByTestId('btn-confirm-ok').click();
    await page.waitForTimeout(1000);

    // Should see auth screen
    await expect(page.getByTestId('btn-guest')).toBeVisible({ timeout: 5000 });
  });

  test('guest mode shows library without sign in', async ({ page }) => {
    await loginAsGuest(page);

    // Should see the library nav tab
    await expect(page.getByTestId('nav-library')).toBeVisible();
  });
});
