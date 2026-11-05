import { expect, test, type Page } from '@playwright/test';
import { ADMIN_STATE } from './auth-state';

/**
 * Proposals and outbound email.
 *
 * Email is deliberately allowed to be unconfigured: the office may well run
 * this with no provider at all and post printed letters instead. So these
 * tests assert the one behaviour that has to hold either way, which is that
 * the dashboard says plainly what will happen and the documents are always
 * downloadable.
 */

async function emailIsReady(page: Page): Promise<boolean> {
  const response = await page.request.get('/api/admin/email/status');
  expect(response.status()).toBe(200);
  const { data } = await response.json();
  return Boolean(data.enabled && data.configured);
}

test.describe('proposals', () => {
  test.use({ storageState: ADMIN_STATE });

  test('the seeded proposal keeps optional extras out of its total', async ({ page }) => {
    await page.goto('/admin/proposals');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/Proposals/i);

    await page.getByRole('cell', { name: /PRO\/2026\/001/ }).click();
    await page.waitForURL(/\/admin\/proposals\/[0-9a-f-]{36}$/, { timeout: 25_000 });

    // Seeded at GHS 76,700.00 with two extras priced outside that figure.
    await expect(page.getByText('GH₵76,700.00').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Optional extras/i })).toBeVisible();
    await expect(page.getByText(/of optional extras/i)).toBeVisible();
  });

  test('a proposal can be written, priced, downloaded and decided', async ({ page }) => {
    await page.goto('/admin/proposals/new');

    await page.getByLabel('Contact name').fill('Playwright Prospect');
    await page.getByLabel('Company').fill('Accra Bottling Works');
    await page.getByLabel('Email', { exact: true }).fill('prospect@example.com');
    await page.getByLabel('Phone').fill('0551830199');
    await page.getByLabel('Proposal title').fill('Reverse osmosis plant for the bottling line');

    await page.getByLabel('Title for line 1').fill('RO skid, 5,000 litres per hour');
    await page.getByLabel('Quantity for line 1').fill('1');
    await page.getByLabel('Unit price for line 1').fill('42000');

    await page.getByRole('button', { name: /Add line/i }).click();
    await page.getByLabel('Title for line 2').fill('Annual service contract');
    await page.getByLabel('Quantity for line 2').fill('1');
    await page.getByLabel('Unit price for line 2').fill('6000');
    await page.getByLabel(/Line 2 is an optional extra/i).check();

    // 42,000 stands alone: the optional 6,000 is quoted but not added in.
    await expect(page.getByText('GH₵42,000.00').first()).toBeVisible();
    await expect(page.getByText(/Plus GH₵6,000.00 of optional extras/i)).toBeVisible();

    await page.getByRole('button', { name: /^Create proposal$/ }).click();
    await page.waitForURL(/\/admin\/proposals\/[0-9a-f-]{36}$/, { timeout: 25_000 });

    const id = page.url().split('/').pop()!;

    await expect(page.getByText('Accra Bottling Works').first()).toBeVisible();
    await expect(page.getByText('GH₵42,000.00').first()).toBeVisible();
    // The standard wording is written when the fields are left blank.
    await expect(page.getByText(/Thank you for the opportunity to quote/i)).toBeVisible();

    // Both documents generate for real, from the same stored record.
    const pdf = await page.request.get(`/api/documents/proposals/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    const pdfBody = await pdf.body();
    expect(pdfBody.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdfBody.byteLength).toBeGreaterThan(10_000);

    const docx = await page.request.get(`/api/documents/proposals/${id}/docx`);
    expect(docx.status()).toBe(200);
    expect(docx.headers()['content-type']).toContain('wordprocessingml');
    expect((await docx.body()).subarray(0, 2).toString()).toBe('PK');

    // Marking it sent moves it out of draft and closes off deletion.
    await page.getByRole('button', { name: /Mark as sent/i }).click();
    await expect(page.getByText('sent', { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /^Delete$/ })).toHaveCount(0);

    // Recording the client's answer locks the record.
    await page.getByRole('button', { name: /^Accepted$/ }).click();
    await page.getByRole('button', { name: /Record acceptance/i }).click();
    await expect(page.getByText('accepted', { exact: true }).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole('link', { name: /^Edit$/ })).toHaveCount(0);

    // And the editor refuses to open it, rather than offering a form that cannot save.
    await page.goto(`/admin/proposals/${id}/edit`);
    await expect(page).toHaveURL(new RegExp(`/admin/proposals/${id}$`), { timeout: 20_000 });
  });

  test('the send dialog states up front whether email can go out', async ({ page }) => {
    await page.goto('/admin/proposals');
    await page.getByRole('cell', { name: /PRO\/2026\/001/ }).click();
    await page.waitForURL(/\/admin\/proposals\/[0-9a-f-]{36}$/, { timeout: 25_000 });

    await page.getByRole('button', { name: /Email to client/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();

    if (await emailIsReady(page)) {
      await expect(page.getByRole('button', { name: /Send now/i })).toBeEnabled();
    } else {
      await expect(page.getByText(/Email cannot send yet/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Send now/i })).toBeDisabled();
      // The way out is stated rather than left to be guessed at.
      await expect(page.getByText(/download the proposal and send it yourself/i)).toBeVisible();
    }
  });

  test('an enquiry can be turned into a priced draft once, not twice', async ({ page }) => {
    const key = `from-lead-e2e-${Date.now()}`;

    const lead = await page.request.post('/api/enquiries', {
      data: {
        fullName: 'Proposal Source Enquiry',
        phone: '0551830177',
        email: 'source@example.com',
        location: 'Teshie',
        urgency: 'flexible',
        message: `We need a borehole and an overhead tank for a small school. Reference ${key}.`,
        consent: true,
      },
    });
    expect([200, 201]).toContain(lead.status());
    // The public endpoint hands back only the reference, never an internal id,
    // so the admin list is what turns one into the other.
    const reference = (await lead.json()).data.reference;

    const found = await page.request.get(
      `/api/admin/leads?search=${encodeURIComponent(reference)}`,
    );
    expect(found.status()).toBe(200);
    const leadId = (await found.json()).data.items[0].id;
    expect(leadId).toBeTruthy();

    const body = { leadId };
    const first = await page.request.post('/api/admin/proposals/from-lead', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(first.status());
    const created = (await first.json()).data;

    const second = await page.request.post('/api/admin/proposals/from-lead', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect([200, 201]).toContain(second.status());
    expect((await second.json()).data.id).toBe(created.id);

    // The enquiry's own words are carried into the scope introduction, so the
    // draft is worth something before anyone types a single line.
    await page.goto(`/admin/proposals/${created.id}`);
    await expect(page.getByText(/borehole and an overhead tank/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('draft', { exact: true }).first()).toBeVisible();
  });
});

test.describe('outbound email', () => {
  test.use({ storageState: ADMIN_STATE });

  test('the status endpoint never leaks the provider key', async ({ page }) => {
    const response = await page.request.get('/api/admin/email/status');
    expect(response.status()).toBe(200);

    const raw = await response.text();
    expect(raw).not.toMatch(/re_[A-Za-z0-9]/);

    const { data } = await response.json();
    expect(data).toMatchObject({
      enabled: expect.any(Boolean),
      configured: expect.any(Boolean),
    });
    expect(data).not.toHaveProperty('apiKey');
  });

  test('email settings are editable and explain the state of the provider', async ({ page }) => {
    await page.goto('/admin/settings');
    await page.getByRole('tab', { name: /^Email$/ }).click();

    await expect(page.getByRole('heading', { name: /^Provider$/ })).toBeVisible();
    await expect(page.getByLabel('From name')).toBeVisible();
    await expect(page.getByLabel('Send to')).toBeVisible();

    // An unsendable address cannot be submitted as a test.
    await page.getByLabel('Send to').fill('not-an-address');
    await expect(page.getByRole('button', { name: /Send test/i })).toBeDisabled();
    await page.getByLabel('Send to').fill('someone@example.com');
    await expect(page.getByRole('button', { name: /Send test/i })).toBeEnabled();
  });

  test('sending a document without a session is refused', async ({ page, browser }) => {
    const anonymous = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const response = await anonymous.request.post('/api/admin/email/test', {
      data: { to: 'someone@example.com' },
    });
    expect(response.status()).toBe(401);
    await anonymous.close();
  });

  test('an invoice and a work report both offer an email route', async ({ page }) => {
    await page.goto('/admin/invoices');
    await page.getByRole('row').nth(1).click();
    await page.waitForURL(/\/admin\/invoices\/[0-9a-f-]{36}$/, { timeout: 25_000 });
    await expect(page.getByRole('button', { name: /^Email$/ })).toBeVisible();

    await page.goto('/admin/reports');
    await page.getByRole('row').nth(1).click();
    await page.waitForURL(/\/admin\/reports\/[0-9a-f-]{36}$/, { timeout: 25_000 });
    await page.getByRole('button', { name: /^Email$/ }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByText(/attached automatically/i)).toBeVisible();
  });
});
