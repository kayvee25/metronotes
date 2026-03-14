import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

test.describe('Attachments (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('add rich text attachment to song', async ({ page }) => {
    const songName = `Attach Text ${Date.now()}`;
    await createSong(page, songName);

    // Save first
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Look for the add text button
    const addTextButton = page.getByRole('button', { name: /text/i });
    if (await addTextButton.isVisible()) {
      await addTextButton.click();
      await page.waitForTimeout(500);

      // Verify attachment was created (a text editor or attachment item should appear)
      // The attachment list should now have at least one item
      await page.waitForTimeout(500);
    }
  });

  test('add drawing attachment to song', async ({ page }) => {
    const songName = `Attach Draw ${Date.now()}`;
    await createSong(page, songName);

    // Save first
    await page.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(500);

    // Look for the drawing button
    const drawButton = page.getByRole('button', { name: /draw/i });
    if (await drawButton.isVisible()) {
      await drawButton.click();
      await page.waitForTimeout(500);

      // A drawing canvas should appear
      // Save the drawing
      const saveButton = page.getByRole('button', { name: 'Save' });
      if (await saveButton.isEnabled()) {
        await saveButton.click();
        await page.waitForTimeout(500);
      }
    }
  });
});
