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

function uniquePhone(): string {
  // Each run needs its own number so the duplicate guard does not swallow it.
  const tail = String(Math.floor(Math.random() * 9_000_000) + 1_000_000);
  return `055${tail}`;
}

test.describe('quote enquiry', () => {
  test('a visitor can send an enquiry and gets a reference back', async ({ page }) => {
    await page.goto('/contact');
    await waitForHydration(page);

    const message =
      `The pressure upstairs dropped last week and there is a damp patch on the ceiling. Test ${Date.now()}`;

    await page.getByLabel('Your name').fill('Playwright Visitor');
    await page.getByLabel('Phone number').fill(uniquePhone());
    await page.getByLabel('Where is the work?').fill('East Legon, Accra');
    await page.getByLabel('Tell us about the job').fill(message);

    // Confirm the controlled inputs actually hold what was typed.
    await expect(page.getByLabel('Your name')).toHaveValue('Playwright Visitor');
    await expect(page.getByLabel('Tell us about the job')).toHaveValue(message);

    await page.getByRole('button', { name: /Send enquiry/i }).click();

    await expect(page.getByRole('heading', { name: /Thank you, we have it/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/^ENQ-\d{4}-\d{4}$/)).toBeVisible();
  });

  test('the form refuses to submit when the details are not usable', async ({ page }) => {
    await page.goto('/contact');
    await waitForHydration(page);

    await page.getByLabel('Your name').fill('A');
    await page.getByLabel('Phone number').fill('123');
    await page.getByLabel('Tell us about the job').fill('too short');
    await page.getByRole('button', { name: /Send enquiry/i }).click();

    await expect(page.getByText(/Please tell us your name/i)).toBeVisible();
    await expect(page.getByText(/Enter a phone number we can reach you on/i)).toBeVisible();
    // Nothing was sent, so the success panel never appears.
    await expect(page.getByRole('heading', { name: /Thank you/i })).toHaveCount(0);
  });

  test('the API collapses a repeated submission onto one enquiry', async ({ request }) => {
    const phone = uniquePhone();
    const body = {
      fullName: 'Idempotency Check',
      phone,
      location: 'Tema',
      message: `Checking that a retried submission does not create a twin. ${Date.now()}`,
      urgency: 'flexible',
    };
    const key = `enquiry-test-${Date.now()}`;

    const first = await request.post('/api/enquiries', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect(first.status()).toBe(201);
    const firstBody = await first.json();
    const reference = firstBody.data.reference;
    expect(reference).toMatch(/^ENQ-\d{4}-\d{4}$/);

    // Same key, so the stored response is replayed rather than re-run.
    const replay = await request.post('/api/enquiries', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect(replay.status()).toBe(200);
    expect(replay.headers()['idempotency-replayed']).toBe('true');
    expect((await replay.json()).data.reference).toBe(reference);

    // No key at all, but identical content inside the window: deduplicated.
    const duplicate = await request.post('/api/enquiries', { data: body });
    expect((await duplicate.json()).data.reference).toBe(reference);
  });

  test('the honeypot field is rejected', async ({ request }) => {
    const response = await request.post('/api/enquiries', {
      data: {
        fullName: 'Spam Bot',
        phone: uniquePhone(),
        message: 'Buy cheap things from this unrelated website right now please.',
        website: 'http://spam.example.com',
      },
    });

    expect(response.status()).toBe(422);
  });

  test('a malformed payload is reported field by field', async ({ request }) => {
    const response = await request.post('/api/enquiries', {
      data: { fullName: '', phone: '', message: '' },
    });

    expect(response.status()).toBe(422);
    const body = await response.json();
    expect(body.ok).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(Object.keys(body.error.details).length).toBeGreaterThan(0);
  });
});
