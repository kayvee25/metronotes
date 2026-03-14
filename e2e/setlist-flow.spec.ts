import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, goBackToLibrary } from './helpers';

test.describe('Setlist flow (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create setlist from library', async ({ page }) => {
    // Switch to Setlists sub-tab within Library
    await page.getByText('Setlists').click();
    await page.waitForTimeout(300);

    // Click add setlist FAB
    await page.getByRole('button', { name: 'Add setlist' }).click();
    await page.waitForTimeout(500);

    // Fill setlist name — placeholder is "e.g., Friday Night Gig"
    const setlistName = `Test Setlist ${Date.now()}`;
    await page.getByPlaceholder('e.g., Friday Night Gig').fill(setlistName);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(500);

    // Verify setlist appears
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });
  });

  test('create songs then create setlist', async ({ page }) => {
    // Create a song first
    const songName = `Setlist Song ${Date.now()}`;
    await createSong(page, songName);
    await goBackToLibrary(page);

    // Switch to Setlists tab
    await page.getByText('Setlists').click();
    await page.waitForTimeout(300);

    // Create a setlist
    await page.getByRole('button', { name: 'Add setlist' }).click();
    await page.waitForTimeout(500);

    const setlistName = `My Setlist ${Date.now()}`;
    await page.getByPlaceholder('e.g., Friday Night Gig').fill(setlistName);
    await page.getByRole('button', { name: 'Create' }).click();
    await page.waitForTimeout(500);

    // Verify setlist was created
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });
  });
});
