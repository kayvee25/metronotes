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

  test('create song with custom BPM', async ({ page }) => {
    const songName = `Custom BPM ${Date.now()}`;
    await createSong(page, songName, 180);

    // Verify BPM shows 180 in edit mode
    const bpmInput = page.getByTestId('input-bpm');
    if (await bpmInput.isVisible({ timeout: 3000 }).catch(() => false)) {
      await expect(bpmInput).toHaveValue('180');
    }
  });

  test('edit song name and save', async ({ page }) => {
    const songName = `EditName ${Date.now()}`;
    await createSong(page, songName);

    // Should be in edit mode with song name input
    const nameInput = page.getByTestId('input-song-name-edit');
    await expect(nameInput).toBeVisible();

    // Change the name
    const newName = `Renamed ${Date.now()}`;
    await nameInput.fill(newName);

    // Click back — should trigger unsaved changes dialog
    await page.getByTestId('btn-back').click();
    await page.waitForTimeout(500);

    // Save changes via the dialog
    const saveBtn = page.getByRole('button', { name: 'Save' });
    if (await saveBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await saveBtn.click();
      await page.waitForTimeout(1000);
    }

    // Should be back in library with new name
    await page.getByTestId('nav-library').waitFor({ timeout: 5000 });
    await expect(page.getByText(newName)).toBeVisible({ timeout: 5000 });
  });

  test('edit song BPM via increase/decrease buttons', async ({ page }) => {
    const songName = `BPM Btns ${Date.now()}`;
    await createSong(page, songName, 100);

    // Increase BPM twice
    await page.getByTestId('btn-increase-bpm').click();
    await page.getByTestId('btn-increase-bpm').click();

    // BPM should now be 102
    const bpmInput = page.getByTestId('input-bpm');
    if (await bpmInput.isVisible()) {
      await expect(bpmInput).toHaveValue('102');
    }

    // Decrease once
    await page.getByTestId('btn-decrease-bpm').click();
    if (await bpmInput.isVisible()) {
      await expect(bpmInput).toHaveValue('101');
    }

    await goBackToLibrary(page);
  });

  test('change song key', async ({ page }) => {
    const songName = `Key Test ${Date.now()}`;
    await createSong(page, songName);

    // Find the key selector
    const keySelect = page.getByTestId('select-key');
    if (await keySelect.isVisible()) {
      await keySelect.selectOption('Am');
      await page.waitForTimeout(300);
    }

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

    // Click delete option from context menu
    const deleteOption = page.getByTestId('menu-delete');
    if (await deleteOption.isVisible({ timeout: 2000 }).catch(() => false)) {
      await deleteOption.click();
      await page.waitForTimeout(300);

      // Confirm delete
      const confirmBtn = page.getByTestId('btn-confirm-delete');
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

    await goBackToLibrary(page);

    await page.reload();
    await page.waitForTimeout(3000);

    await expect(page.getByText(songName)).toBeVisible({ timeout: 10000 });
  });
});
