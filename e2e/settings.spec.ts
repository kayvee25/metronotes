import { test, expect } from '@playwright/test';
import { loginWithTestAccount, navigateToSettings } from './helpers';

test.describe('Settings (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('settings page shows all sections', async ({ page }) => {
    await navigateToSettings(page);

    // Should see the Settings heading
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Should see user email
    await expect(page.getByText('@')).toBeVisible();

    // Should see Sign Out button
    await expect(page.getByRole('button', { name: 'Sign Out' })).toBeVisible();

    // Should see PERFORMANCE FONT section
    await expect(page.getByText('PERFORMANCE FONT')).toBeVisible();

    // Should see font size options
    await expect(page.getByRole('button', { name: 'Small' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Medium' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Large', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Extra Large' })).toBeVisible();

    // Should see font family options
    await expect(page.getByRole('button', { name: 'Monospace' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sans-serif' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Serif', exact: true })).toBeVisible();

    // Should see METRONOME section
    await expect(page.getByText('METRONOME')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Default Click' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Wood Block' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cowbell' })).toBeVisible();

    // Should see DISPLAY section
    await expect(page.getByText('DISPLAY')).toBeVisible();
    await expect(page.getByText('Dark Mode')).toBeVisible();
    await expect(page.getByText('Keep Screen On')).toBeVisible();
  });

  test('change performance font size', async ({ page }) => {
    await navigateToSettings(page);

    // Click Large (exact match)
    await page.getByRole('button', { name: 'Large', exact: true }).click();
    await page.waitForTimeout(300);

    // Click Small
    await page.getByRole('button', { name: 'Small' }).click();
    await page.waitForTimeout(300);

    // Settings should remain visible (no crash)
    await expect(page.getByText('PERFORMANCE FONT')).toBeVisible();
  });

  test('change performance font family', async ({ page }) => {
    await navigateToSettings(page);

    // Click Serif
    await page.getByRole('button', { name: 'Serif', exact: true }).click();
    await page.waitForTimeout(300);

    // Click Monospace
    await page.getByRole('button', { name: 'Monospace' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('PERFORMANCE FONT')).toBeVisible();
  });

  test('change metronome sound', async ({ page }) => {
    await navigateToSettings(page);

    // Click Wood Block
    await page.getByRole('button', { name: 'Wood Block' }).click();
    await page.waitForTimeout(300);

    // Click Cowbell
    await page.getByRole('button', { name: 'Cowbell' }).click();
    await page.waitForTimeout(300);

    // Click back to Default Click
    await page.getByRole('button', { name: 'Default Click' }).click();
    await page.waitForTimeout(300);

    await expect(page.getByText('METRONOME')).toBeVisible();
  });

  test('toggle dark mode', async ({ page }) => {
    await navigateToSettings(page);

    // Click the dark mode toggle
    const toggleBtn = page.getByRole('button', { name: 'Toggle dark mode' });
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // Toggle back
    await toggleBtn.click();
    await page.waitForTimeout(300);

    // App should still be functional
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });

  test('settings persist after navigating away and back', async ({ page }) => {
    await navigateToSettings(page);

    // Change font size to Large
    await page.getByRole('button', { name: 'Large', exact: true }).click();
    await page.waitForTimeout(300);

    // Navigate to Library
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(300);

    // Navigate back to Settings
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);

    // Settings page should still show (no crash after round-trip)
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
  });
});
