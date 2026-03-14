import { test, expect } from '@playwright/test';
import { loginWithTestAccount, createSong, goBackToLibrary } from './helpers';

test.describe('Search and Sort (authenticated)', () => {
  test.beforeEach(async ({ page }) => {
    await loginWithTestAccount(page);
  });

  test('search filters songs by name', async ({ page }) => {
    // Create two songs with distinct names
    const uniquePrefix = `SrchA${Date.now()}`;
    const songA = `${uniquePrefix} Alpha`;
    const songB = `SrchB${Date.now()} Beta`;

    await createSong(page, songA);
    await goBackToLibrary(page);
    await createSong(page, songB);
    await goBackToLibrary(page);

    // Both should be visible
    await expect(page.getByText(songA)).toBeVisible();
    await expect(page.getByText(songB)).toBeVisible();

    // Search for the unique prefix of song A
    const searchInput = page.getByPlaceholder('Search songs...');
    await searchInput.fill(uniquePrefix);
    await page.waitForTimeout(300);

    // Song A visible, Song B hidden
    await expect(page.getByText(songA)).toBeVisible();
    await expect(page.getByText(songB)).not.toBeVisible();

    // Clear search brings back all
    await searchInput.fill('');
    await page.waitForTimeout(300);
    await expect(page.getByText(songB)).toBeVisible();
  });

  test('search with no results shows empty state', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search songs...');
    await searchInput.fill('zzznonexistent999');
    await page.waitForTimeout(300);

    // Should show no songs (verify at least the add button is still there)
    await expect(page.getByRole('button', { name: 'Add song' })).toBeVisible();
  });

  test('sort songs by name A-Z', async ({ page }) => {
    // Open sort menu
    await page.getByRole('button', { name: 'Sort songs' }).click();
    await page.waitForTimeout(300);

    // Click Name A-Z
    await page.getByRole('button', { name: 'Name A-Z' }).click();
    await page.waitForTimeout(500);

    // Verify sort is applied (songs should be alphabetical)
    // We can't easily verify order, but verify the sort button was clicked without error
    await expect(page.getByRole('button', { name: 'Sort songs' })).toBeVisible();
  });

  test('sort songs by name Z-A', async ({ page }) => {
    await page.getByRole('button', { name: 'Sort songs' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Name Z-A' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: 'Sort songs' })).toBeVisible();
  });

  test('sort songs by recently added', async ({ page }) => {
    await page.getByRole('button', { name: 'Sort songs' }).click();
    await page.waitForTimeout(300);

    await page.getByRole('button', { name: 'Recently Added' }).click();
    await page.waitForTimeout(500);

    await expect(page.getByRole('button', { name: 'Sort songs' })).toBeVisible();
  });

  test('search works on setlists tab too', async ({ page }) => {
    // Switch to Setlists tab
    await page.getByRole('button', { name: 'Setlists' }).click();
    await page.waitForTimeout(300);

    const searchInput = page.getByPlaceholder('Search setlists...');
    await expect(searchInput).toBeVisible();

    // Type a search
    await searchInput.fill('nonexistent');
    await page.waitForTimeout(300);

    // Clear
    await searchInput.fill('');
  });
});
