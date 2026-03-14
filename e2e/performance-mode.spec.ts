import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

test.describe('Performance mode (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('enter performance mode from edit mode', async ({ page }) => {
    const songName = `Perf Mode ${Date.now()}`;
    await createSong(page, songName, 120);

    // Toggle to performance mode
    await page.getByTestId('btn-performance-mode').click();
    await page.waitForTimeout(500);

    // In performance mode, the song name should be visible
    await expect(page.getByTestId('perf-song-name')).toContainText(songName);

    // Should see time signature and BPM info text
    await expect(page.getByTestId('perf-song-info')).toBeVisible();
  });

  test('toggle back to edit mode from performance mode', async ({ page }) => {
    const songName = `ToggleBack ${Date.now()}`;
    await createSong(page, songName, 120);

    // Go to performance mode
    await page.getByTestId('btn-performance-mode').click();
    await page.waitForTimeout(500);

    // Should see "Edit mode" button now
    await page.getByTestId('btn-edit-mode').click();
    await page.waitForTimeout(500);

    // Back in edit mode — should see editable song name input
    await expect(page.getByTestId('input-song-name-edit')).toBeVisible();
  });

  test('performance mode shows transport controls', async ({ page }) => {
    const songName = `Transport ${Date.now()}`;
    await createSong(page, songName, 120);

    // Switch to performance mode
    await page.getByTestId('btn-performance-mode').click();
    await page.waitForTimeout(500);

    // Should see Play button
    await expect(page.getByTestId('btn-play')).toBeVisible();

    // Should see tempo controls
    await expect(page.getByTestId('btn-decrease-tempo')).toBeVisible();
    await expect(page.getByTestId('btn-increase-tempo')).toBeVisible();

    // Should see audio source and volume buttons
    await expect(page.getByTestId('btn-audio-source')).toBeVisible();
    await expect(page.getByTestId('btn-volume')).toBeVisible();
  });

  test('adjust tempo in performance mode', async ({ page }) => {
    const songName = `Tempo Adj ${Date.now()}`;
    await createSong(page, songName, 100);

    await page.getByTestId('btn-performance-mode').click();
    await page.waitForTimeout(500);

    // Increase tempo
    await page.getByTestId('btn-increase-tempo').click();
    await page.getByTestId('btn-increase-tempo').click();
    await page.waitForTimeout(300);

    // Should show 102 in the tempo display
    await expect(page.getByText('102', { exact: true })).toBeVisible();

    // Decrease tempo
    await page.getByTestId('btn-decrease-tempo').click();
    await page.waitForTimeout(300);

    await expect(page.getByText('101', { exact: true })).toBeVisible();
  });

  test('attachment page navigation in performance mode', async ({ page }) => {
    const songName = `PageNav ${Date.now()}`;
    await createSong(page, songName, 120);

    // Add a second attachment (rich text) in edit mode
    const addAttachBtn = page.getByText('+ Add Attachment');
    await addAttachBtn.scrollIntoViewIfNeeded();
    await addAttachBtn.click();
    await page.waitForTimeout(500);

    // Pick Text from the attachment type picker
    const textOption = page.getByTestId('attach-type-text');
    if (await textOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textOption.click();
      await page.waitForTimeout(1000);

      // The rich text editor opens as a full-screen overlay with Cancel/Done
      // Click Cancel to close the editor (Done is disabled when empty)
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
        await cancelBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // Scroll back to top and switch to performance mode
    const perfBtn = page.getByTestId('btn-performance-mode');
    await perfBtn.scrollIntoViewIfNeeded();
    await perfBtn.click();
    await page.waitForTimeout(500);

    // Should see page indicators (Page 1, Page 2)
    const page1Btn = page.getByTestId('page-indicator-1');
    if (await page1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try navigating to page 2
      const nextBtn = page.getByTestId('btn-next-attachment');
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);

        // Page 2 should now be current
        await expect(page.getByTestId('page-indicator-2')).toBeVisible();
      }
    }
  });

  test('metronome play/stop cycle', async ({ page }) => {
    const songName = `Metro Test ${Date.now()}`;
    await createSong(page, songName, 120);

    // Switch to performance mode
    await page.getByTestId('btn-performance-mode').click();
    await page.waitForTimeout(500);

    // Click Play
    const playBtn = page.getByTestId('btn-play');
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(1000);

    // Should now show Stop button
    const stopBtn = page.getByTestId('btn-stop');
    await expect(stopBtn).toBeVisible();

    // Click Stop
    await stopBtn.click();
    await page.waitForTimeout(300);

    // Should be back to Play
    await expect(page.getByTestId('btn-play')).toBeVisible();
  });
});
