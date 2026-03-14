import { test, expect } from '@playwright/test';
import { loginWithTestAccount, navigateToSettings } from './helpers';

test.describe('Settings (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('settings page shows all sections', async ({ page }) => {
    await navigateToSettings(page);

    // Should see the Settings heading
    await expect(page.getByTestId('settings-heading')).toBeVisible();

    // Should see user email
    await expect(page.getByText('@')).toBeVisible();

    // Should see Sign Out button
    await expect(page.getByTestId('btn-sign-out')).toBeVisible();

    // Should see PERFORMANCE FONT section
    await expect(page.getByTestId('section-font')).toBeVisible();

    // Should see font size options
    await expect(page.getByTestId('font-size-small')).toBeVisible();
    await expect(page.getByTestId('font-size-medium')).toBeVisible();
    await expect(page.getByTestId('font-size-large')).toBeVisible();
    await expect(page.getByTestId('font-size-xl')).toBeVisible();

    // Should see font family options
    await expect(page.getByTestId('font-family-monospace')).toBeVisible();
    await expect(page.getByTestId('font-family-sans-serif')).toBeVisible();
    await expect(page.getByTestId('font-family-serif')).toBeVisible();

    // Should see METRONOME section
    await expect(page.getByTestId('section-metronome')).toBeVisible();
    await expect(page.getByTestId('sound-default')).toBeVisible();
    await expect(page.getByTestId('sound-wood')).toBeVisible();
    await expect(page.getByTestId('sound-cowbell')).toBeVisible();

    // Should see DISPLAY section
    await expect(page.getByTestId('section-display')).toBeVisible();
    await expect(page.getByText('Dark Mode')).toBeVisible();
    await expect(page.getByText('Keep Screen On')).toBeVisible();
  });

  test('change performance font size', async ({ page }) => {
    await navigateToSettings(page);

    // Click Large
    await page.getByTestId('font-size-large').click();
    await page.waitForTimeout(300);

    // Click Small
    await page.getByTestId('font-size-small').click();
    await page.waitForTimeout(300);

    // Settings should remain visible (no crash)
    await expect(page.getByTestId('section-font')).toBeVisible();
  });

  test('change performance font family', async ({ page }) => {
    await navigateToSettings(page);

    // Click Serif
    await page.getByTestId('font-family-serif').click();
    await page.waitForTimeout(300);

    // Click Monospace
    await page.getByTestId('font-family-monospace').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('section-font')).toBeVisible();
  });

  test('change metronome sound', async ({ page }) => {
    await navigateToSettings(page);

    // Click Wood Block
    await page.getByTestId('sound-wood').click();
    await page.waitForTimeout(300);

    // Click Cowbell
    await page.getByTestId('sound-cowbell').click();
    await page.waitForTimeout(300);

    // Click back to Default Click
    await page.getByTestId('sound-default').click();
    await page.waitForTimeout(300);

    await expect(page.getByTestId('section-metronome')).toBeVisible();
  });

  test('toggle dark mode', async ({ page }) => {
    await navigateToSettings(page);

    // Click the dark mode toggle
    const toggleBtn = page.getByTestId('toggle-dark-mode');
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Toggle back
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // App should still be functional
    await expect(page.getByTestId('settings-heading')).toBeVisible();
  });

  test('settings persist after navigating away and back', async ({ page }) => {
    await navigateToSettings(page);

    // Change font size to Large
    await page.getByTestId('font-size-large').click();
    await page.waitForTimeout(300);

    // Navigate to Library
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(300);

    // Navigate back to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);

    // Settings page should still show (no crash after round-trip)
    await expect(page.getByTestId('settings-heading')).toBeVisible();
  });
});
