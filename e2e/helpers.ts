import { Page, expect } from '@playwright/test';

export async function loginAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  // Wait for the library tab to be visible (app loaded)
  await page.getByText('Library').waitFor();
}

export async function loginWithTestAccount(page: Page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.test');
  }

  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with Email' }).click();
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  // Wait for authenticated state — library tab visible
  await page.getByText('Library').waitFor({ timeout: 15000 });
}

export async function createSong(page: Page, name: string, bpm?: number) {
  // Click the add song FAB
  await page.getByRole('button', { name: 'Add song' }).click();

  // Fill in the quick add modal
  await page.getByPlaceholder('Song name').fill(name);
  if (bpm) {
    const bpmInput = page.getByPlaceholder('120');
    if (await bpmInput.isVisible()) {
      await bpmInput.fill(String(bpm));
    }
  }
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for the song view to open (edit mode)
  await page.waitForTimeout(500);
}

export async function navigateToLibrary(page: Page) {
  await page.getByText('Library').click();
  await page.waitForTimeout(300);
}

export async function navigateToSettings(page: Page) {
  await page.getByText('Settings').click();
  await page.waitForTimeout(300);
}

export async function cleanupTestUserData(_page: Page) {
  // Test isolation relies on unique song names with timestamps.
  // A more robust approach would use Firestore REST API to delete test data.
}

export async function waitForToast(page: Page, text: string) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}

export async function deleteSongByName(page: Page, songName: string) {
  // Long press on the song to trigger context menu (mobile)
  // On desktop, right-click or use the context menu
  const songItem = page.getByText(songName).first();

  // Use long press for mobile-like interaction
  await songItem.click({ button: 'right' });
  await page.waitForTimeout(200);

  // If right-click didn't show menu, try long press
  const deleteOption = page.getByText('Delete');
  if (await deleteOption.isVisible()) {
    await deleteOption.click();
    // Confirm delete dialog
    const confirmButton = page.getByRole('button', { name: /Delete song/ });
    if (await confirmButton.isVisible()) {
      await confirmButton.click();
    }
  }
}
