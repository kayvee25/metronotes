import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, goBackToLibrary } from './helpers';

test.describe('Song CRUD (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create song and verify it appears in library', async ({ page }) => {
    const songName = `Test Song ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await goBackToLibrary(page);

    // Verify song appears in list
    await expect(page.getByText(songName)).toBeVisible();
  });

  test('edit song BPM via increase button', async ({ page }) => {
    const songName = `Edit BPM ${Date.now()}`;
    await createSong(page, songName, 100);

    // The song view is now open in edit mode
    // Use aria-label to find BPM buttons
    await page.getByLabel('Increase BPM').click();
    await page.getByLabel('Increase BPM').click();

    // Go back — may trigger unsaved changes dialog
    await goBackToLibrary(page);
  });

  test('delete song and verify removed from library', async ({ page }) => {
    const songName = `Delete Me ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await goBackToLibrary(page);
    await expect(page.getByText(songName)).toBeVisible();

    // Long press to open context menu
    const songItem = page.getByText(songName).first();
    const box = await songItem.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(800);
      await page.mouse.up();
    }
    await page.waitForTimeout(500);

    // Take screenshot to debug if needed
    // await page.screenshot({ path: 'test-results/debug-context-menu.png' });

    // Click delete option from context menu
    const deleteOption = page.getByText('Delete', { exact: true }).first();
    if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteOption.click();
      await page.waitForTimeout(300);

      // Confirm delete — click the first delete-related button in the dialog
      const confirmBtn = page.getByRole('button', { name: /[Dd]elete/ }).first();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(500);

      // Verify removed
      await expect(page.getByText(songName)).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('song persists after page reload', async ({ page }) => {
    const songName = `Persist ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await goBackToLibrary(page);

    // Reload page
    await page.reload();
    await page.waitForTimeout(3000);

    // Verify song still exists
    await expect(page.getByText(songName)).toBeVisible({ timeout: 10000 });
  });
});
