import { expect, test } from '@playwright/test';
import { ADMIN_EMAIL as EMAIL, ADMIN_PASSWORD as PASSWORD, ADMIN_STATE } from './auth-state';

test.describe('admin access', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('an anonymous visitor is sent to the sign in page', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/);
    await expect(page.getByRole('heading', { name: /Staff sign in/i })).toBeVisible();
  });

  test('a protected API call is rejected without a session', async ({ request }) => {
    const response = await request.get('/api/admin/invoices');
    expect(response.status()).toBe(401);
    expect((await response.json()).error.code).toBe('UNAUTHORIZED');
  });

  test('the wrong password is refused', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password').fill('definitely-not-the-password');
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    await expect(page.getByText(/was not recognised/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('a deep link is remembered across sign in', async ({ page }) => {
    await page.goto('/admin/invoices');
    await expect(page).toHaveURL(/next=%2Fadmin%2Finvoices/);

    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/ }).click();

    await expect(page).toHaveURL(/\/admin\/invoices/, { timeout: 25_000 });
  });
});

test.describe('admin workspace', () => {
  test.use({ storageState: ADMIN_STATE });

  test.beforeEach(async ({ page }) => {
    await page.goto('/admin');
  });

  test('the dashboard shows the real figures', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /Good day/i })).toBeVisible();
    await expect(page.getByText('Invoiced this month')).toBeVisible();
    await expect(page.getByText('Outstanding')).toBeVisible();
    await expect(page.getByRole('heading', { name: /Invoiced against collected/i })).toBeVisible();

    // The chart offers a table view, which is how the colour contrast warning
    // is discharged for anyone who cannot separate the two series.
    await page.getByRole('button', { name: /Show the numbers/i }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('every section in the sidebar loads', async ({ page }) => {
    for (const [name, heading] of [
      ['Enquiries', /Enquiries/i],
      ['Clients', /Clients/i],
      ['Jobs', /Jobs/i],
      ['Invoices', /Invoices/i],
      ['Proposals', /Proposals/i],
      ['Work reports', /Work reports/i],
      ['Services', /Services/i],
      ['Content', /Website content/i],
      ['Media', /Media/i],
      ['Settings', /Settings/i],
      ['Team', /Team/i],
    ] as const) {
      await page.getByRole('navigation', { name: 'Admin' }).getByRole('link', { name }).first().click();
      await expect(page.getByRole('heading', { level: 1 })).toContainText(heading, {
        timeout: 20_000,
      });
    }
  });

  test('the seeded invoice reproduces the paper document', async ({ page }) => {
    await page.goto('/admin/invoices');

    // Searched for rather than assumed to be on the first page: later runs
    // raise newer invoices, which sort above it.
    await page.getByLabel(/Search by number/i).fill('161026');
    await expect(page.getByText('MR. EBO')).toBeVisible({ timeout: 20_000 });
    await page.getByText('161026').first().click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText('161026');
    await expect(page.getByText('GH₵19,830.00').first()).toBeVisible();
    await expect(page.getByText('EB/161026')).toBeVisible();
    await expect(page.getByText('Workmanship')).toBeVisible();
  });

  test('an invoice can be raised, issued, paid and downloaded', async ({ page }) => {
    await page.goto('/admin/invoices/new');

    await page.getByLabel('Customer name').fill('Playwright Test Customer');
    await page.getByLabel('Phone').fill('0551830199');

    await page.getByLabel('Description for line 1').fill('4" Pressure Pipe');
    await page.getByLabel('Quantity for line 1').fill('10');
    await page.getByLabel('Unit price for line 1').fill('400');

    await page.getByRole('button', { name: /Add line/i }).click();
    await page.getByLabel('Description for line 2').fill('Workmanship');
    await page.getByLabel('Quantity for line 2').fill('1');
    await page.getByLabel('Unit price for line 2').fill('1500');

    // 10 x 400 + 1500 = 5,500.00, computed by the same domain code as the server.
    // The figure appears as both the sub-total and the grand total.
    await expect(page.getByText('GH₵5,500.00').first()).toBeVisible();

    await page.getByRole('button', { name: /Create invoice/i }).click();
    await page.waitForURL(/\/admin\/invoices\/[0-9a-f-]{36}$/, { timeout: 25_000 });

    await expect(page.getByText('Playwright Test Customer').first()).toBeVisible();
    await expect(page.getByText('GH₵5,500.00').first()).toBeVisible();

    // Issue it, which moves it out of draft.
    await page.getByRole('button', { name: /^Issue$/ }).click();
    await expect(page.getByRole('button', { name: /Record payment/i })).toBeVisible({
      timeout: 20_000,
    });

    // A payment larger than the balance must be refused.
    await page.getByRole('button', { name: /Record payment/i }).click();
    await page.getByLabel(/Amount \(GHS\)/).fill('9999');
    await expect(page.getByText(/more than the outstanding/i)).toBeVisible();

    // Part payment, leaving a balance.
    await page.getByLabel(/Amount \(GHS\)/).fill('2000');
    await page.getByRole('button', { name: /^Record payment$/ }).last().click();

    await expect(page.getByText('GH₵3,500.00').first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText('partially paid')).toBeVisible();

    // Both documents generate for real.
    const url = page.url();
    const id = url.split('/').pop();

    const pdf = await page.request.get(`/api/documents/invoices/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect(pdf.headers()['content-type']).toContain('application/pdf');
    const pdfBody = await pdf.body();
    expect(pdfBody.byteLength).toBeGreaterThan(10_000);
    expect(pdfBody.subarray(0, 5).toString()).toBe('%PDF-');

    const docx = await page.request.get(`/api/documents/invoices/${id}/docx`);
    expect(docx.status()).toBe(200);
    expect(docx.headers()['content-type']).toContain('wordprocessingml');
    const docxBody = await docx.body();
    // Every .docx is a zip, so it starts with the PK signature.
    expect(docxBody.subarray(0, 2).toString()).toBe('PK');
  });

  test('a repeated invoice request creates only one invoice', async ({ page }) => {
    const key = `invoice-e2e-${Date.now()}`;
    const body = {
      customerName: 'Idempotent Customer',
      lines: [{ unitOfMeasure: 'Pcs', description: 'Survey', quantity: 1, unitPriceMinor: '3500' }],
    };

    const first = await page.request.post('/api/admin/invoices', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect(first.status()).toBe(201);
    const number = (await first.json()).data.invoiceNumber;

    const replay = await page.request.post('/api/admin/invoices', {
      data: body,
      headers: { 'Idempotency-Key': key },
    });
    expect(replay.status()).toBe(200);
    expect(replay.headers()['idempotency-replayed']).toBe('true');
    // The same number, so no second invoice burned a slot in the sequence.
    expect((await replay.json()).data.invoiceNumber).toBe(number);
  });

  test('the seeded work report matches the signed template', async ({ page }) => {
    await page.goto('/admin/reports');
    await page.getByText('MS/2026/001').first().click();

    await expect(page.getByRole('heading', { level: 1 })).toContainText(
      'Work Completion and Payment Report',
    );
    await expect(page.getByRole('heading', { name: '1. Introduction' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '3. Cost and Payment Breakdown' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '6. Appreciation' })).toBeVisible();
    await expect(page.getByText('fully paid').first()).toBeVisible();
    await expect(page.getByText('2,800.00').first()).toBeVisible();

    const id = page.url().split('/').pop();
    const pdf = await page.request.get(`/api/documents/reports/${id}/pdf`);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

    const docx = await page.request.get(`/api/documents/reports/${id}/docx`);
    expect(docx.status()).toBe(200);
    expect((await docx.body()).subarray(0, 2).toString()).toBe('PK');
  });

  test('a report can be built from an invoice carrying its figures', async ({ page }) => {
    const invoice = await page.request.post('/api/admin/invoices', {
      data: {
        customerName: 'Report Source Customer',
        lines: [
          { unitOfMeasure: 'Pcs', description: 'Pipe laying', quantity: 2, unitPriceMinor: '750' },
        ],
      },
    });
    const invoiceId = (await invoice.json()).data.id;

    const report = await page.request.post('/api/admin/work-reports/from-invoice', {
      data: { invoiceId },
    });
    expect(report.status()).toBe(201);

    const body = (await report.json()).data;
    expect(body.reportNumber).toMatch(/^MS\/\d{4}\/\d{3}$/);
    expect(body.totalCostMinor).toBe(150000);
    expect(body.clientName).toBe('Report Source Customer');
    // Nothing paid on the source invoice, so the report says so.
    expect(body.paymentState).toBe('unpaid');
  });

  test('searching a list is debounced and filters the rows', async ({ page }) => {
    await page.goto('/admin/invoices');
    await page.getByLabel(/Search by number/i).fill('161026');
    await expect(page.getByText('MR. EBO')).toBeVisible({ timeout: 20_000 });

    await page.getByLabel(/Search by number/i).fill('nothing-matches-this');
    await expect(page.getByText(/No invoices yet|Nothing here yet/i)).toBeVisible({
      timeout: 20_000,
    });
  });

});

/**
 * Signing out invalidates the shared session, so this runs in a browser
 * context of its own with a fresh login.
 */
test.describe('signing out', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('ends the session and re-protects the admin', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByLabel('Email address').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: /^Sign in$/ }).click();
    await page.waitForURL(/\/admin(?!\/login)/, { timeout: 30_000 });

    await page.getByRole('button', { name: /MerSam Administrator/i }).first().click();
    await page.getByRole('button', { name: /Sign out/i }).click();
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 20_000 });

    await page.goto('/admin/invoices');
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});
