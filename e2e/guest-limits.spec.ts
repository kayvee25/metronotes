import { test, expect } from '@playwright/test';
import { loginAsGuest, createSong, navigateToLibrary } from './helpers';

test.describe('Guest mode limits', () => {
  test('enforces 3-song limit in guest mode', async ({ page }) => {
    await loginAsGuest(page);

    // Create 3 songs
    for (let i = 1; i <= 3; i++) {
      await createSong(page, `Guest Song ${i}`);
      // Save each song
      const saveButton = page.getByRole('button', { name: 'Save' });
      if (await saveButton.isEnabled()) {
        await saveButton.click();
        await page.waitForTimeout(500);
      }
      await navigateToLibrary(page);
      await page.waitForTimeout(300);
    }

    // Try to create 4th song
    await page.getByRole('button', { name: 'Add song' }).click();
    await page.getByPlaceholder('Song name').fill('Over Limit');
    await page.getByRole('button', { name: 'Create' }).click();

    // Should see error toast or message about guest limit
    await expect(page.getByText(/Guest mode/i)).toBeVisible({ timeout: 5000 });
  });

  test('guest data persists after reload', async ({ page }) => {
    await loginAsGuest(page);

    const songName = `Persist Guest ${Date.now()}`;
    await createSong(page, songName);

    // Save
    const saveButton = page.getByRole('button', { name: 'Save' });
    if (await saveButton.isEnabled()) {
      await saveButton.click();
      await page.waitForTimeout(500);
    }

    await navigateToLibrary(page);
    await page.waitForTimeout(300);

    // Reload
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify song persists
    await expect(page.getByText(songName)).toBeVisible({ timeout: 5000 });
  });
});
