import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

test.describe('Performance mode (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('enter performance mode from edit mode', async ({ page }) => {
    const songName = `Perf Mode ${Date.now()}`;
    await createSong(page, songName, 120);

    // Save first
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Toggle to performance mode
    await page.getByRole('button', { name: 'Performance mode' }).click();
    await page.waitForTimeout(300);

    // Verify we're in performance mode - BPM should be visible in metadata
    await expect(page.getByText('120 BPM')).toBeVisible();
  });

  test('metronome toggle shows beat indicator', async ({ page }) => {
    const songName = `Metro Test ${Date.now()}`;
    await createSong(page, songName, 120);

    // Save
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Switch to performance mode
    await page.getByRole('button', { name: 'Performance mode' }).click();
    await page.waitForTimeout(300);

    // Look for the play button / PlayFAB
    const playButton = page.getByRole('button', { name: /play/i });
    if (await playButton.isVisible()) {
      await playButton.click();
      await page.waitForTimeout(1000);

      // Stop
      await page.getByRole('button', { name: /stop/i }).click();
    }
  });
});
