import { Page, expect } from '@playwright/test';

export async function loginAsGuest(page: Page) {
  await page.goto('/');
  await page.getByTestId('btn-guest').click();
  // Wait for the library view to load (bottom nav visible)
  await page.getByTestId('nav-library').waitFor();
}

export async function loginWithTestAccount(page: Page) {
  const email = process.env.TEST_EMAIL;
  const password = process.env.TEST_PASSWORD;
  if (!email || !password) {
    throw new Error('TEST_EMAIL and TEST_PASSWORD must be set in .env.test');
  }

  await page.goto('/');
  await page.getByTestId('btn-email-signin').click();
  await page.getByPlaceholder('your@email.com').fill(email);
  await page.getByPlaceholder('Password').fill(password);
  await page.getByTestId('btn-signin-submit').click();

  // Wait for authenticated state — library view visible
  await page.getByTestId('nav-library').waitFor({ timeout: 30000 });
}

export async function createSong(page: Page, name: string, bpm?: number) {
  // Click the add song FAB
  await page.getByTestId('btn-add-song').click();
  await page.waitForTimeout(500);

  // Fill in the quick add modal
  await page.getByTestId('input-song-name').fill(name);
  if (bpm) {
    const bpmInput = page.getByTestId('input-bpm-modal');
    if (await bpmInput.isVisible()) {
      await bpmInput.fill(String(bpm));
    }
  }
  await page.getByTestId('btn-create-song').click();

  // Wait for the song edit view to open (back button visible)
  await page.getByTestId('btn-back').waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
}

/** Navigate back from song view to library */
export async function goBackToLibrary(page: Page) {
  // Click the back arrow in song view header
  await page.getByTestId('btn-back').click();
  await page.waitForTimeout(500);

  // Handle unsaved changes dialog if it appears
  const discardButton = page.getByTestId('btn-discard-changes');
  if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await discardButton.click();
    await page.waitForTimeout(300);
  }

  // Wait for bottom nav to be visible again
  await page.getByTestId('nav-library').waitFor({ timeout: 5000 });
}

export async function navigateToTab(page: Page, tab: 'library' | 'live' | 'settings') {
  await page.getByTestId(`nav-${tab}`).click();
  await page.waitForTimeout(300);
}

export async function navigateToSettings(page: Page) {
  await navigateToTab(page, 'settings');
}

export async function waitForToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}
