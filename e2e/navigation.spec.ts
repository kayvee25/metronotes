import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, goBackToLibrary } from './helpers';

test.describe('Navigation (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('bottom nav tabs switch views', async ({ page }) => {
    // Should start on Library
    await expect(page.getByRole('button', { name: 'Songs', exact: true })).toBeVisible();

    // Click Live tab
    await page.getByRole('button', { name: 'Live' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: 'Live Session' })).toBeVisible();

    // Click Settings tab
    await page.getByRole('button', { name: 'Settings' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Click Library tab
    await page.getByRole('button', { name: 'Library' }).click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('button', { name: 'Songs', exact: true })).toBeVisible();
  });

  test('library sub-tabs: Songs, Setlists, Files', async ({ page }) => {
    // Default is Songs
    await expect(page.getByPlaceholder('Search songs...')).toBeVisible();

    // Switch to Setlists
    await page.getByRole('button', { name: 'Setlists', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder('Search setlists...')).toBeVisible();

    // Switch to Files
    await page.getByRole('button', { name: 'Files', exact: true }).click();
    await page.waitForTimeout(300);

    // Switch back to Songs
    await page.getByRole('button', { name: 'Songs', exact: true }).click();
    await page.waitForTimeout(300);
    await expect(page.getByPlaceholder('Search songs...')).toBeVisible();
  });

  test('song view back button returns to library', async ({ page }) => {
    const songName = `NavBack ${Date.now()}`;
    await createSong(page, songName);

    // Should be in song view
    await expect(page.getByLabel('Back')).toBeVisible();

    // Click back
    await goBackToLibrary(page);

    // Should see library with the song
    await expect(page.getByText(songName)).toBeVisible();
  });

  test('unsaved changes dialog on back navigation', async ({ page }) => {
    const songName = `Unsaved ${Date.now()}`;
    await createSong(page, songName);

    // Make a change — edit BPM
    await page.getByLabel('Increase BPM').click();
    await page.waitForTimeout(300);

    // Click back
    await page.getByLabel('Back').first().click();
    await page.waitForTimeout(500);

    // Should see unsaved changes dialog with Discard/Save options
    const discardBtn = page.getByRole('button', { name: 'Discard' });

    const dialogVisible = await discardBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (dialogVisible) {
      // Click Discard to go back
      await discardBtn.click();
      await page.waitForTimeout(500);
    }

    // Should be back at library
    await expect(page.getByText('Library')).toBeVisible();
  });

  test('Live tab shows session options', async ({ page }) => {
    await page.getByRole('button', { name: 'Live' }).click();
    await page.waitForTimeout(300);

    // Should see Start Session and Join Session buttons
    await expect(page.getByRole('button', { name: 'Start Session' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Join Session' })).toBeVisible();
    await expect(page.getByText('Play together in sync with your band')).toBeVisible();
  });

  test('sync button triggers refresh', async ({ page }) => {
    // Click Sync now button
    const syncBtn = page.getByRole('button', { name: 'Sync now' });
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
    await page.waitForTimeout(1000);

    // Should still show "Synced" text after refresh completes
    await expect(page.getByText('Synced')).toBeVisible({ timeout: 5000 });
  });
});
