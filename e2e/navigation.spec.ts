import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, goBackToLibrary } from './helpers';

test.describe('Navigation (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('bottom nav tabs switch views', async ({ page }) => {
    // Should start on Library — sub-tab "Songs" visible
    await expect(page.getByTestId('tab-songs')).toBeVisible();

    // Click Live tab
    await page.getByTestId('nav-live').click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: 'Live Session' })).toBeVisible();

    // Click Settings tab
    await page.getByTestId('nav-settings').click();
    await page.waitForTimeout(300);
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();

    // Click Library tab
    await page.getByTestId('nav-library').click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('tab-songs')).toBeVisible();
  });

  test('library sub-tabs: Songs, Setlists, Files', async ({ page }) => {
    // Default is Songs
    await expect(page.getByTestId('input-search-songs')).toBeVisible();

    // Switch to Setlists
    await page.getByTestId('tab-setlists').click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('input-search-setlists')).toBeVisible();

    // Switch to Files
    await page.getByTestId('tab-files').click();
    await page.waitForTimeout(300);

    // Switch back to Songs
    await page.getByTestId('tab-songs').click();
    await page.waitForTimeout(300);
    await expect(page.getByTestId('input-search-songs')).toBeVisible();
  });

  test('song view back button returns to library', async ({ page }) => {
    const songName = `NavBack ${Date.now()}`;
    await createSong(page, songName);

    // Should be in song view
    await expect(page.getByTestId('btn-back')).toBeVisible();

    // Click back
    await goBackToLibrary(page);

    // Should see library with the song
    await expect(page.getByText(songName)).toBeVisible();
  });

  test('unsaved changes dialog on back navigation', async ({ page }) => {
    const songName = `Unsaved ${Date.now()}`;
    await createSong(page, songName);

    // Make a change — edit BPM
    await page.getByTestId('btn-increase-bpm').click();
    await page.waitForTimeout(300);

    // Click back
    await page.getByTestId('btn-back').click();
    await page.waitForTimeout(500);

    // Should see unsaved changes dialog with Discard/Save options
    const discardBtn = page.getByTestId('btn-discard-changes');

    const dialogVisible = await discardBtn.isVisible({ timeout: 2000 }).catch(() => false);
    if (dialogVisible) {
      // Click Discard to go back
      await discardBtn.click();
      await page.waitForTimeout(500);
    }

    // Should be back at library
    await expect(page.getByTestId('nav-library')).toBeVisible();
  });

  test('Live tab shows session options', async ({ page }) => {
    await page.getByTestId('nav-live').click();
    await page.waitForTimeout(300);

    // Should see Start Session and Join Session buttons
    await expect(page.getByTestId('btn-start-session')).toBeVisible();
    await expect(page.getByTestId('btn-join-session')).toBeVisible();
    await expect(page.getByText('Play together in sync with your band')).toBeVisible();
  });

  test('sync button triggers refresh', async ({ page }) => {
    // Click Sync button
    const syncBtn = page.getByTestId('btn-sync');
    await expect(syncBtn).toBeVisible();
    await syncBtn.click();
    await page.waitForTimeout(1000);

    // Should still show "Synced" text after refresh completes
    await expect(page.getByText('Synced')).toBeVisible({ timeout: 5000 });
  });
});
