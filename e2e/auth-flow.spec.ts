import { test, expect } from '@playwright/test';
import { loginWithTestAccount, loginAsGuest, navigateToSettings } from './helpers';

test.describe('Auth flow', () => {
  test('email sign-in redirects to authenticated app', async ({ page }) => {
    await loginWithTestAccount(page);

    // Should see the library tab
    await expect(page.getByText('Library')).toBeVisible();

    // Should NOT see the auth screen buttons
    await expect(page.getByRole('button', { name: 'Continue as Guest' })).not.toBeVisible();
  });

  test('sign out redirects to auth screen', async ({ page }) => {
    await loginWithTestAccount(page);
    await navigateToSettings(page);

    // Click sign out
    await page.getByRole('button', { name: 'Sign Out' }).click();

    // Confirm sign out dialog
    const confirmButton = page.getByRole('button', { name: 'Sign Out' }).last();
    await confirmButton.click();
    await page.waitForTimeout(1000);

    // Should see auth screen
    await expect(page.getByRole('button', { name: 'Continue as Guest' })).toBeVisible({ timeout: 5000 });
  });

  test('guest mode shows library without sign in', async ({ page }) => {
    await loginAsGuest(page);

    // Should see the library tab
    await expect(page.getByText('Library')).toBeVisible();
  });
});
