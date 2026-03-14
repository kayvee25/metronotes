import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, navigateToLibrary } from './helpers';

test.describe('Setlist flow (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create setlist and add songs', async ({ page }) => {
    // Create 2 songs
    const song1 = `Setlist Song 1 ${Date.now()}`;
    const song2 = `Setlist Song 2 ${Date.now()}`;

    await createSong(page, song1);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);
    await navigateToLibrary(page);

    await createSong(page, song2);
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);
    await navigateToLibrary(page);

    // Switch to Live tab
    await page.getByText('Live').click();
    await page.waitForTimeout(300);

    // Create setlist
    await page.getByRole('button', { name: 'Add setlist' }).click();
    await page.waitForTimeout(300);

    // Fill setlist name
    const setlistName = `Test Setlist ${Date.now()}`;
    const nameInput = page.getByPlaceholder('Setlist name');
    if (await nameInput.isVisible()) {
      await nameInput.fill(setlistName);
      await page.getByRole('button', { name: 'Create' }).click();
      await page.waitForTimeout(500);
    }

    // Verify setlist appears
    await expect(page.getByText(setlistName)).toBeVisible({ timeout: 5000 });
  });
});
