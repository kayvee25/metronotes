import { test, expect } from '@playwright/test';
import { loginAsGuest, createSong, goBackToLibrary } from './helpers';

test.describe('Guest mode limits', () => {
  test('enforces 3-song limit in guest mode', async ({ page }) => {
    await loginAsGuest(page);

    // Create 3 songs
    for (let i = 1; i <= 3; i++) {
      await createSong(page, `Guest Song ${i}`);
      await goBackToLibrary(page);
      await page.waitForTimeout(300);
    }

    // Try to create 4th song
    await page.getByTestId('btn-add-song').click();
    await page.waitForTimeout(300);
    await page.getByTestId('input-song-name').fill('Over Limit');
    await page.getByTestId('btn-create-song').click();
    await page.waitForTimeout(1000);

    // Should see error about guest limit — check for toast or error text
    const limitText = page.getByText(/[Gg]uest/);
    await expect(limitText.first()).toBeVisible({ timeout: 5000 });
  });

  test('guest data persists after reload', async ({ page }) => {
    await loginAsGuest(page);

    const songName = `Persist Guest ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await goBackToLibrary(page);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify song persists
    await expect(page.getByText(songName)).toBeVisible({ timeout: 5000 });
  });
});
