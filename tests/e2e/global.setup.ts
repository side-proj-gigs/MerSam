import { expect, test as setup } from '@playwright/test';
import { ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE } from './auth-state';

/**
 * Signs in once and saves the session for every admin test to reuse.
 *
 * This is not only faster: the application deliberately rate limits repeated
 * sign in attempts on one account, so a suite that logged in per test would
 * start failing partway through on its own brute-force defence.
 */
setup('authenticate as the owner', async ({ page }) => {
  await page.goto('/admin/login');

  await page.getByLabel('Email address').fill(ADMIN_EMAIL);
  await page.getByLabel('Password').fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: /^Sign in$/ }).click();

  await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });
  await expect(page.getByRole('heading', { name: /Good day/i })).toBeVisible();

  await page.context().storageState({ path: ADMIN_STATE });
});
