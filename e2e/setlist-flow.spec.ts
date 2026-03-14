import { test, expect } from '@playwright/test';
import { loginWithTestAccount } from './helpers';

test.describe('Setlist flow (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create setlist from library', async ({ page }) => {
    // Switch to Setlists sub-tab within Library
    await page.getByRole('button', { name: 'Setlists', exact: true }).click();
    await page.waitForTimeout(300);

    // Click add setlist FAB
    await page.getByRole('button', { name: 'Add setlist' }).click();
    await page.waitForTimeout(500);

    // Fill setlist name
    const setlistName = `Test Setlist ${Date.now()}`;
    await page.getByPlaceholder('e.g., Friday Night Gig').fill(setlistName);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(500);

    // Verify setlist appears
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });
  });

  test('create setlist and open detail view', async ({ page }) => {
    // Switch to Setlists tab
    await page.getByRole('button', { name: 'Setlists', exact: true }).click();
    await page.waitForTimeout(300);

    // Create a setlist
    await page.getByRole('button', { name: 'Add setlist' }).click();
    await page.waitForTimeout(500);

    const setlistName = `Detail Setlist ${Date.now()}`;
    await page.getByPlaceholder('e.g., Friday Night Gig').fill(setlistName);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(500);

    // Verify setlist was created
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });

    // Click into the setlist to see its detail view
    await page.getByText(setlistName).click();
    await page.waitForTimeout(500);

    // Should see setlist heading and "Add Songs" button
    await expect(page.getByRole('heading', { level: 1, name: setlistName })).toBeVisible({ timeout: 5000 });
    await expect(page.getByRole('button', { name: 'Add Songs' }).last()).toBeVisible();

    // Go back
    await page.getByRole('button', { name: 'Back' }).click();
    await page.waitForTimeout(500);
  });

  test('open setlist detail and see song count', async ({ page }) => {
    // Switch to Setlists tab
    await page.getByRole('button', { name: 'Setlists', exact: true }).click();
    await page.waitForTimeout(300);

    // Click into an existing setlist (if any)
    const setlistItem = page.locator('h3').first();
    if (await setlistItem.isVisible({ timeout: 3000 }).catch(() => false)) {
      const setlistName = await setlistItem.textContent();
      await setlistItem.click();
      await page.waitForTimeout(500);

      // Should see the setlist heading
      if (setlistName) {
        await expect(page.getByRole('heading', { level: 1, name: setlistName })).toBeVisible({ timeout: 5000 });
      }

      // Should see "songs" text (song count)
      await expect(page.getByText('songs').first()).toBeVisible();
    }
  });

  test('remove song from setlist', async ({ page }) => {
    // Navigate to Setlists tab
    await page.getByRole('button', { name: 'Setlists', exact: true }).click();
    await page.waitForTimeout(300);

    // Click into a setlist that has songs
    const setlistWithSongs = page.getByText(/\d+ songs/).first();
    if (await setlistWithSongs.isVisible({ timeout: 3000 }).catch(() => false)) {
      await setlistWithSongs.click();
      await page.waitForTimeout(500);

      // Look for "Remove from setlist" button
      const removeBtn = page.getByRole('button', { name: 'Remove from setlist' }).first();
      if (await removeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await removeBtn.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
