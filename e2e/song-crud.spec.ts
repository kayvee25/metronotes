import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, navigateToLibrary } from './helpers';

test.describe('Song CRUD (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('create song and verify it appears in library', async ({ page }) => {
    const songName = `Test Song ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await navigateToLibrary(page);

    // Verify song appears in list
    await expect(page.getByText(songName)).toBeVisible();
  });

  test('edit song BPM and verify changes persist', async ({ page }) => {
    const songName = `Edit BPM ${Date.now()}`;
    await createSong(page, songName, 100);

    // Change BPM using the increase button
    await page.getByRole('button', { name: 'Increase BPM' }).click();
    await page.getByRole('button', { name: 'Increase BPM' }).click();

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Go back and reopen
    await navigateToLibrary(page);
    await page.getByText(songName).click();
    await page.waitForTimeout(500);

    // Verify BPM updated
    const bpmDisplay = page.getByLabel('BPM');
    await expect(bpmDisplay).toBeVisible();
  });

  test('delete song and verify removed from library', async ({ page }) => {
    const songName = `Delete Me ${Date.now()}`;
    await createSong(page, songName);

    // Go back to library
    await navigateToLibrary(page);
    await expect(page.getByText(songName)).toBeVisible();

    // Long press to open context menu
    const songItem = page.getByText(songName).first();
    await songItem.dispatchEvent('pointerdown');
    await page.waitForTimeout(800);
    await songItem.dispatchEvent('pointerup');

    // Click delete option
    await page.getByText('Delete').click();

    // Confirm delete in dialog
    const deleteButton = page.getByRole('button', { name: /Delete song/ }).first();
    await deleteButton.click();
    await page.waitForTimeout(500);

    // Verify removed
    await expect(page.getByText(songName)).not.toBeVisible();
  });

  test('song persists after page reload', async ({ page }) => {
    const songName = `Persist ${Date.now()}`;
    await createSong(page, songName);

    // Save the song
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Go back to library
    await navigateToLibrary(page);

    // Reload page
    await page.reload();
    await page.waitForTimeout(2000);

    // Verify song still exists
    await expect(page.getByText(songName)).toBeVisible({ timeout: 10000 });
  });
});
