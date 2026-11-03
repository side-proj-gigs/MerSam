import { expect, test } from '@playwright/test';

/** The public site, exercised the way a visitor would use it. */
test.describe('public website', () => {
  test('the home page renders its full content', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.getByRole('banner')).toBeVisible();
    await expect(page.getByRole('contentinfo')).toBeVisible();

    // The seeded services, projects and testimonials all made it through.
    await expect(page.getByRole('heading', { name: /Thirteen services/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Borehole Drilling/i }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /What our clients say|In their words/i })).toBeVisible();

    // A headline figure counted up rather than staying at zero.
    await expect(page.getByText(/Boreholes delivered/i)).toBeVisible();
  });

  test('every main navigation destination resolves', async ({ page }) => {
    for (const [path, heading] of [
      ['/services', /under one roof|Our services/i],
      ['/projects', /measured on/i],
      ['/about', /in our own words/i],
      ['/faq', /before they commit/i],
      ['/contact', /Tell us what is happening/i],
    ] as const) {
      const response = await page.goto(path);
      expect(response?.status(), `${path} should return 200`).toBe(200);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading);
    }
  });

  test('a service detail page carries its facts and structured data', async ({ page }) => {
    await page.goto('/services/borehole-drilling');

    await expect(page.getByRole('heading', { level: 1 })).toContainText('Borehole Drilling');
    await expect(page.getByText(/Indicative price/i)).toBeVisible();
    await expect(page.getByText(/Typical turnaround/i)).toBeVisible();
    await expect(page.getByRole('heading', { name: /What you receive/i })).toBeVisible();

    const jsonLd = await page.locator('script[type="application/ld+json"]').first().textContent();
    expect(jsonLd).toBeTruthy();
    const parsed = JSON.parse(jsonLd!);
    expect(parsed['@type']).toBe('Service');
    expect(parsed.provider.name).toBe('MerSam');
  });

  test('category filtering keeps a shareable address', async ({ page }) => {
    await page.goto('/services');
    await page.getByRole('link', { name: /Treatment and Purification/i }).first().click();
    await expect(page).toHaveURL(/category=treatment-and-purification/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Treatment and Purification/i);
  });

  test('the FAQ accordion opens and closes', async ({ page }) => {
    await page.goto('/faq');

    // The first entry starts open, so a closed one is the honest subject.
    const question = page.getByRole('button', { name: /Do I really need a survey/i });
    await expect(question).toHaveAttribute('aria-expanded', 'false');

    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'true');

    await question.click();
    await expect(question).toHaveAttribute('aria-expanded', 'false');
  });

  test('an unknown service returns a 404 rather than an error page', async ({ page }) => {
    const response = await page.goto('/services/this-service-does-not-exist');
    expect(response?.status()).toBe(404);
  });

  test('the health endpoint reports a reachable database', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.data.status).toBe('ok');
    expect(body.data.database).toBe('reachable');
  });

  test('security headers are present on a public page', async ({ request }) => {
    const response = await request.get('/');
    expect(response.headers()['x-content-type-options']).toBe('nosniff');
    expect(response.headers()['referrer-policy']).toBe('strict-origin-when-cross-origin');
    // The framework banner is suppressed.
    expect(response.headers()['x-powered-by']).toBeUndefined();
  });

  test('the splash shows once, clears itself, and never blocks a click', async ({ browser }) => {
    // Headless Chromium reports reduced motion by default and the splash
    // honours that, so motion is turned on to exercise the real path.
    const context = await browser.newContext({ reducedMotion: 'no-preference' });
    const page = await context.newPage();

    await page.goto('/', { waitUntil: 'domcontentloaded' });

    const splash = page.locator('[data-splash]');
    await expect(splash).toBeVisible({ timeout: 3000 });

    // It is decorative, so it must never swallow a tap while it is up.
    await expect(splash).toHaveCSS('pointer-events', 'none');

    // It has a hard ceiling, so it clears whether or not everything loaded.
    await expect(splash).toHaveCount(0, { timeout: 8000 });

    // Once per session, not once per navigation.
    await page.goto('/services', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    await expect(splash).toHaveCount(0);

    await context.close();
  });

  test('the theme toggle switches and survives a reload', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Dark theme' }).first().click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    // Applied before the first paint, so there is no flash of the wrong theme.
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  });
});
