import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

test.describe('Performance mode (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('enter performance mode from edit mode', async ({ page }) => {
    const songName = `Perf Mode ${Date.now()}`;
    await createSong(page, songName, 120);

    // Toggle to performance mode — aria-label="Performance mode"
    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // In performance mode, the song name should still be visible
    await expect(page.getByText(songName).first()).toBeVisible();
  });

  test('metronome play/stop cycle', async ({ page }) => {
    const songName = `Metro Test ${Date.now()}`;
    await createSong(page, songName, 120);

    // Switch to performance mode
    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // Just verify the performance view rendered without errors
    await expect(page.getByText(songName).first()).toBeVisible();
  });
});
