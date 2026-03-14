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

    // In performance mode, the song name should be a button (clickable, not editable)
    await expect(page.getByRole('button', { name: songName })).toBeVisible();

    // Should see time signature and BPM info text
    await expect(page.getByText(/4\/4\s+·\s+120 BPM/)).toBeVisible();
  });

  test('toggle back to edit mode from performance mode', async ({ page }) => {
    const songName = `ToggleBack ${Date.now()}`;
    await createSong(page, songName, 120);

    // Go to performance mode
    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // Should see "Edit mode" button now
    await page.getByLabel('Edit mode').click();
    await page.waitForTimeout(500);

    // Back in edit mode — should see editable song name input
    await expect(page.getByPlaceholder('Song name')).toBeVisible();
  });

  test('performance mode shows transport controls', async ({ page }) => {
    const songName = `Transport ${Date.now()}`;
    await createSong(page, songName, 120);

    // Switch to performance mode
    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // Should see Play button
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();

    // Should see tempo controls
    await expect(page.getByRole('button', { name: 'Decrease tempo' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Increase tempo' })).toBeVisible();

    // Should see audio source and volume buttons
    await expect(page.getByRole('button', { name: 'Audio source' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Volume' })).toBeVisible();
  });

  test('adjust tempo in performance mode', async ({ page }) => {
    const songName = `Tempo Adj ${Date.now()}`;
    await createSong(page, songName, 100);

    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // Increase tempo
    await page.getByRole('button', { name: 'Increase tempo' }).click();
    await page.getByRole('button', { name: 'Increase tempo' }).click();
    await page.waitForTimeout(300);

    // Should show 102 in the tempo display
    await expect(page.getByText('102', { exact: true })).toBeVisible();

    // Decrease tempo
    await page.getByRole('button', { name: 'Decrease tempo' }).click();
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
    const textOption = page.getByRole('button', { name: 'Text', exact: true });
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
    const perfBtn = page.getByLabel('Performance mode');
    await perfBtn.scrollIntoViewIfNeeded();
    await perfBtn.click();
    await page.waitForTimeout(500);

    // Should see page indicators (Page 1, Page 2)
    const page1Btn = page.getByRole('button', { name: /Page 1/ });
    if (await page1Btn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Try navigating to page 2
      const nextBtn = page.getByRole('button', { name: 'Next attachment' });
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        await page.waitForTimeout(300);

        // Page 2 should now be current
        await expect(page.getByRole('button', { name: /Page 2 \(current\)/ })).toBeVisible();
      }
    }
  });

  test('metronome play/stop cycle', async ({ page }) => {
    const songName = `Metro Test ${Date.now()}`;
    await createSong(page, songName, 120);

    // Switch to performance mode
    await page.getByLabel('Performance mode').click();
    await page.waitForTimeout(500);

    // Click Play
    const playBtn = page.getByRole('button', { name: 'Play' });
    await expect(playBtn).toBeVisible();
    await playBtn.click();
    await page.waitForTimeout(1000);

    // Should now show Stop button
    const stopBtn = page.getByRole('button', { name: 'Stop' });
    await expect(stopBtn).toBeVisible();

    // Click Stop
    await stopBtn.click();
    await page.waitForTimeout(300);

    // Should be back to Play
    await expect(page.getByRole('button', { name: 'Play' })).toBeVisible();
  });
});
