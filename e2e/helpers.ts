import { Page, expect } from '@playwright/test';

export async function loginAsGuest(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Continue as Guest' }).click();
  // Wait for the library view to load (bottom nav visible)
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

  // Wait for authenticated state — library view visible
  await page.getByText('Library').waitFor({ timeout: 30000 });
}

export async function createSong(page: Page, name: string, bpm?: number) {
  // Click the add song FAB
  await page.getByRole('button', { name: 'Add song' }).click();
  await page.waitForTimeout(500);

  // Fill in the quick add modal
  await page.getByPlaceholder('Song name').fill(name);
  if (bpm) {
    // The BPM input is type="text" with inputMode="numeric", default value "120"
    const bpmInput = page.locator('input[inputmode="numeric"]');
    if (await bpmInput.isVisible()) {
      await bpmInput.fill(String(bpm));
    }
  }
  await page.getByRole('button', { name: 'Create' }).click();

  // Wait for the song edit view to open (back arrow visible)
  await page.getByLabel('Back').first().waitFor({ timeout: 5000 });
  await page.waitForTimeout(500);
}

/** Navigate back from song view to library */
export async function goBackToLibrary(page: Page) {
  // Click the back arrow in song view header
  const backButton = page.getByLabel('Back').first();
  await backButton.click();
  await page.waitForTimeout(500);

  // Handle unsaved changes dialog if it appears
  const discardButton = page.getByRole('button', { name: 'Discard' });
  if (await discardButton.isVisible({ timeout: 1000 }).catch(() => false)) {
    await discardButton.click();
    await page.waitForTimeout(300);
  }

  // Wait for bottom nav to be visible again
  await page.getByText('Library').waitFor({ timeout: 5000 });
}

export async function navigateToTab(page: Page, tab: 'Library' | 'Live' | 'Settings') {
  await page.getByText(tab, { exact: true }).click();
  await page.waitForTimeout(300);
}

export async function navigateToSettings(page: Page) {
  await navigateToTab(page, 'Settings');
}

export async function waitForToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text)).toBeVisible({ timeout: 5000 });
}
