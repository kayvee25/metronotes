import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

test.describe('Attachments (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('attachment section visible in song edit mode', async ({ page }) => {
    const songName = `Attach Test ${Date.now()}`;
    await createSong(page, songName);

    // In edit mode, we should see the ATTACHMENTS section header
    await expect(page.getByText('ATTACHMENTS').first()).toBeVisible();
  });

  test('audio section visible in song edit mode', async ({ page }) => {
    const songName = `Audio Test ${Date.now()}`;
    await createSong(page, songName);

    // Verify AUDIO section exists
    await expect(page.getByText('AUDIO').first()).toBeVisible();
  });

  test('add attachment button visible', async ({ page }) => {
    const songName = `Add Attach ${Date.now()}`;
    await createSong(page, songName);

    // The "+ Add Attachment" dashed area should be visible
    await expect(page.getByText('Add Attachment').first()).toBeVisible();
  });
});
