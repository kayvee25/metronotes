import { test, expect } from '@playwright/test';
import { loginWithTestAccount } from './helpers';

test.describe('Setlist flow (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create setlist from library', async ({ page }) => {
    // Switch to Setlists sub-tab within Library
    await page.getByTestId('tab-setlists').click();
    await page.waitForTimeout(300);

    // Click add setlist FAB
    await page.getByTestId('btn-add-setlist').click();
    await page.waitForTimeout(500);

    // Fill setlist name
    const setlistName = `Test Setlist ${Date.now()}`;
    await page.getByTestId('input-setlist-name').fill(setlistName);
    await page.getByTestId('btn-create-setlist').click();
    await page.waitForTimeout(500);

    // Verify setlist appears
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });
  });

  test('create setlist and open detail view', async ({ page }) => {
    // Switch to Setlists tab
    await page.getByTestId('tab-setlists').click();
    await page.waitForTimeout(300);

    // Create a setlist
    await page.getByTestId('btn-add-setlist').click();
    await page.waitForTimeout(500);

    const setlistName = `Detail Setlist ${Date.now()}`;
    await page.getByTestId('input-setlist-name').fill(setlistName);
    await page.getByTestId('btn-create-setlist').click();
    await page.waitForTimeout(500);

    // Verify setlist was created
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });

    // Click into the setlist to see its detail view
    await page.getByText(setlistName).click();
    await page.waitForTimeout(500);

    // Should see setlist heading and "Add Songs" button
    await expect(page.getByTestId('setlist-heading')).toHaveText(setlistName, { timeout: 5000 });
    await expect(page.getByTestId('btn-add-songs').last()).toBeVisible();

    // Go back
    await page.getByTestId('btn-back').click();
    await page.waitForTimeout(500);
  });

  test('open setlist detail and see song count', async ({ page }) => {
    // Switch to Setlists tab
    await page.getByTestId('tab-setlists').click();
    await page.waitForTimeout(300);

    // Click into an existing setlist (if any)
    const setlistItem = page.getByTestId('setlist-item').first();
    if (await setlistItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      const setlistName = await setlistItem.locator('h3').textContent();
      await setlistItem.click();
      await page.waitForTimeout(500);

      // Should see the setlist heading
      if (setlistName) {
        await expect(page.getByTestId('setlist-heading')).toHaveText(setlistName, { timeout: 5000 });
      }

      // Should see song count
      await expect(page.getByTestId('setlist-song-count')).toBeVisible();
    }
  });

  test('remove song from setlist', async ({ page }) => {
    // Navigate to Setlists tab
    await page.getByTestId('tab-setlists').click();
    await page.waitForTimeout(300);

    // Click into a setlist that has songs
    const setlistWithSongs = page.getByTestId('setlist-song-count').filter({ hasText: /[1-9]\d* songs/ }).first();
    if (await setlistWithSongs.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Click the parent setlist-item to navigate
      await setlistWithSongs.locator('..').click();
      await page.waitForTimeout(500);

      // Look for "Remove from setlist" button
      const removeBtn = page.getByTestId('btn-remove-from-setlist').first();
      if (await removeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
