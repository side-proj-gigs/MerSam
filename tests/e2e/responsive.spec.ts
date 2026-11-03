import { expect, test, type Page } from '@playwright/test';

/**
 * Filling a field before React has hydrated loses the value when the
 * controlled component mounts, so every form test waits for the client to be
 * in charge before typing.
 */
async function waitForHydration(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // The character counter is rendered from client state, so once it reacts to
  // input the form is live.
  const counter = page.getByText(/^\d+ \/ 4000$/);
  await expect(counter).toBeVisible({ timeout: 20_000 });
}

/**
 * Runs on a phone viewport. The thing most worth guarding against is a page
 * that scrolls sideways, because that is invisible on a desktop and ruins the
 * experience on a handset.
 */
async function expectNoHorizontalScroll(page: import('@playwright/test').Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scroll: doc.scrollWidth, client: doc.clientWidth };
  });
  // One pixel of tolerance for sub-pixel rounding.
  expect(overflow.scroll, 'the page should not scroll sideways').toBeLessThanOrEqual(
    overflow.client + 1,
  );
}

test.describe('on a phone', () => {
  for (const path of ['/', '/services', '/services/borehole-drilling', '/projects', '/about', '/faq', '/contact']) {
    test(`${path} fits the viewport`, async ({ page }) => {
      await page.goto(path);
      await page.waitForLoadState('networkidle');
      await expectNoHorizontalScroll(page);
    });
  }

  test('the navigation drawer opens and closes', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: 'Open menu' }).click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'Services' })).toBeVisible();

    await page.getByRole('button', { name: 'Close menu' }).first().click();
    await expect(page.getByRole('navigation', { name: 'Mobile' })).toHaveCount(0);
  });

  test('the floating contact button reveals its options after scrolling', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => window.scrollTo(0, 900));

    const trigger = page.getByRole('button', { name: 'Contact us' });
    await expect(trigger).toBeVisible();
    await trigger.click();
    await expect(page.getByRole('link', { name: /WhatsApp us/i })).toBeVisible();
  });

  test('the enquiry form is usable on a small screen', async ({ page }) => {
    await page.goto('/contact');
    await waitForHydration(page);

    const name = page.getByLabel('Your name');
    await name.scrollIntoViewIfNeeded();
    await expect(name).toBeVisible();

    // Touch targets stay large enough to hit reliably.
    const box = await page.getByRole('button', { name: /Send enquiry/i }).boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);

    await expectNoHorizontalScroll(page);
  });

  test('a digital card fits the screen it is designed for', async ({ page }) => {
    await page.goto('/card/mersam-administrator');
    await page.waitForLoadState('networkidle');

    await expect(page.getByRole('link', { name: /Save to contacts/i })).toBeVisible();
    await expectNoHorizontalScroll(page);
  });
});
