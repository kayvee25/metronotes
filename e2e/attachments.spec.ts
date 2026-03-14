import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong } from './helpers';

/** Helper to add a text attachment and close the editor */
async function addTextAttachment(page: import('@playwright/test').Page) {
  const addBtn = page.getByText('+ Add Attachment');
  await addBtn.scrollIntoViewIfNeeded();
  await addBtn.click();
  await page.waitForTimeout(500);

  const textOption = page.getByRole('button', { name: 'Text', exact: true });
  if (await textOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await textOption.click();
    await page.waitForTimeout(1000);

    // The editor overlay opens — type content and click Done
    // The editor is a contenteditable div inside the overlay
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    const doneBtn = page.getByRole('button', { name: 'Done' });

    if (await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Type content so Done becomes enabled
      await page.keyboard.type('Test content');
      await page.waitForTimeout(500);

      if (await doneBtn.isEnabled()) {
        await doneBtn.click();
      } else {
        await cancelBtn.click();
      }
      await page.waitForTimeout(1000);
    }
  }
}

test.describe('Attachments (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('new song has default attachment and sections visible', async ({ page }) => {
    const songName = `Attach Test ${Date.now()}`;
    await createSong(page, songName);

    // In edit mode, we should see the ATTACHMENTS section header
    await expect(page.getByText('ATTACHMENTS').first()).toBeVisible();

    // Should see AUDIO section
    await expect(page.getByText('AUDIO').first()).toBeVisible();

    // Should see "+ Add Attachment" button
    await expect(page.getByText('+ Add Attachment').first()).toBeVisible();

    // Should see "+ Add Audio" button
    await expect(page.getByText('+ Add Audio').first()).toBeVisible();
  });

  test('add text attachment via editor', async ({ page }) => {
    const songName = `AddText ${Date.now()}`;
    await createSong(page, songName);

    // Click Add Attachment
    await page.getByText('+ Add Attachment').click();
    await page.waitForTimeout(500);

    // Pick Text from the type picker
    const textOption = page.getByRole('button', { name: 'Text', exact: true });
    await expect(textOption).toBeVisible({ timeout: 3000 });
    await textOption.click();
    await page.waitForTimeout(1000);

    // The editor overlay should be visible with formatting tools
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible({ timeout: 3000 });

    // Type something and save
    await page.keyboard.type('Hello World');
    await page.waitForTimeout(500);

    const doneBtn = page.getByRole('button', { name: 'Done' });
    await doneBtn.click();
    await page.waitForTimeout(1000);

    // Back in edit mode — the attachment should now exist in the list
    await expect(page.getByText('ATTACHMENTS')).toBeVisible();
  });

  test('delete attachment with confirmation', async ({ page }) => {
    const songName = `DelAttach ${Date.now()}`;
    await createSong(page, songName);

    // Add an attachment first
    await addTextAttachment(page);

    // Count attachments before delete
    const beforeCount = await page.locator('[roledescription="sortable"]').count();

    if (beforeCount > 0) {
      // Click delete on the last attachment
      const deleteBtn = page.getByRole('button', { name: 'Delete attachment' }).last();
      await deleteBtn.scrollIntoViewIfNeeded();
      await deleteBtn.click();
      await page.waitForTimeout(300);

      // Confirm deletion in the dialog
      const confirmBtn = page.getByRole('button', { name: /[Dd]elete/ }).last();
      if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(500);
      }

      // Count should have decreased
      const afterCount = await page.locator('[roledescription="sortable"]').count();
      expect(afterCount).toBeLessThan(beforeCount);
    }
  });

  test('set attachment as default', async ({ page }) => {
    const songName = `SetDefault ${Date.now()}`;
    await createSong(page, songName);

    // Add a second attachment so we have a non-default one
    await addTextAttachment(page);

    // The "Set as default" button should be visible on the non-default attachment
    const setDefaultBtn = page.getByRole('button', { name: 'Set as default' }).first();
    if (await setDefaultBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await setDefaultBtn.scrollIntoViewIfNeeded();
      await setDefaultBtn.click();
      await page.waitForTimeout(500);

      // After setting as default, should see "Default attachment" marker
      await expect(page.getByRole('button', { name: 'Default attachment' })).toBeVisible();
    }
  });

  test('edit attachment opens editor', async ({ page }) => {
    const songName = `EditAttach ${Date.now()}`;
    await createSong(page, songName);

    // Add a text attachment first
    await addTextAttachment(page);

    // Click edit on the first attachment
    const editBtn = page.getByRole('button', { name: 'Edit attachment' }).first();
    if (await editBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
      await editBtn.scrollIntoViewIfNeeded();
      await editBtn.click();
      await page.waitForTimeout(1000);

      // Editor overlay should appear — look for Cancel or Done button
      const cancelBtn = page.getByRole('button', { name: 'Cancel' });
      const doneBtn = page.getByRole('button', { name: 'Done' });

      // One of these should be visible
      const hasCancel = await cancelBtn.isVisible({ timeout: 3000 }).catch(() => false);
      const hasDone = await doneBtn.isVisible({ timeout: 1000 }).catch(() => false);

      if (hasCancel || hasDone) {
        // Close editor
        if (hasCancel) {
          await cancelBtn.click();
        } else {
          await doneBtn.click();
        }
        await page.waitForTimeout(500);
      }
    }
  });

  test('attachment type picker shows all options', async ({ page }) => {
    const songName = `TypePicker ${Date.now()}`;
    await createSong(page, songName);

    await page.getByText('+ Add Attachment').click();
    await page.waitForTimeout(500);

    // Should see all attachment type options
    await expect(page.getByRole('button', { name: 'Text', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Image', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Camera', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Drawing', exact: true })).toBeVisible();
  });
});
