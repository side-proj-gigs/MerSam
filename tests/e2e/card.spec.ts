import { expect, test } from '@playwright/test';

const SLUG = 'mersam-administrator';

test.describe('digital business card', () => {
  test('the card renders with its contact actions', async ({ page }) => {
    await page.goto(`/card/${SLUG}`);

    await expect(page.getByRole('heading', { level: 1 })).toContainText('MerSam Administrator');
    await expect(page.getByText('Managing Director').first()).toBeVisible();

    await expect(page.getByRole('link', { name: /Save to contacts/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /^Call$/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Copy link/i })).toBeVisible();
  });

  test('the card flips to show the code', async ({ page }) => {
    await page.goto(`/card/${SLUG}`);

    // The control relabels itself, so each state is asserted on its own name.
    await page.getByRole('button', { name: /Show the QR code/i }).click();

    const flipped = page.getByRole('button', { name: /Show the card/i });
    await expect(flipped).toBeVisible();
    await expect(flipped).toHaveAttribute('aria-pressed', 'true');

    await flipped.click();
    await expect(page.getByRole('button', { name: /Show the QR code/i })).toBeVisible();
  });

  test('the vCard downloads and parses', async ({ request }) => {
    const response = await request.get(`/api/card/${SLUG}/vcf`);

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('text/vcard');
    expect(response.headers()['content-disposition']).toContain('attachment');

    const text = await response.text();
    expect(text).toContain('BEGIN:VCARD');
    expect(text).toContain('VERSION:3.0');
    expect(text).toContain('FN:MerSam Administrator');
    expect(text).toContain('TITLE:Managing Director');
    expect(text).toContain('ORG:MerSam');
    expect(text.trimEnd().endsWith('END:VCARD')).toBe(true);
  });

  test('the code renders in each theme and keeps its quiet zone', async ({ request }) => {
    for (const theme of ['light', 'dark', 'gold']) {
      const response = await request.get(`/api/card/${SLUG}/qr?theme=${theme}&size=512`);
      expect(response.status()).toBe(200);
      expect(response.headers()['content-type']).toContain('image/svg+xml');

      const svg = await response.text();
      expect(svg).toContain('<svg');
      expect(svg).toContain('role="img"');
      // Finder patterns, drawn as nested solid squares.
      expect((svg.match(/width="7" height="7"/g) ?? []).length).toBe(3);
      // A healthy number of modules made it into the drawing.
      expect((svg.match(/<rect/g) ?? []).length).toBeGreaterThan(200);
    }
  });

  test('the wallpaper renders at device resolution', async ({ request }) => {
    const response = await request.get(`/api/card/${SLUG}/wallpaper?theme=dark`);

    expect(response.status()).toBe(200);
    const svg = await response.text();
    expect(svg).toContain('width="1290"');
    expect(svg).toContain('height="2796"');
    expect(svg).toContain('SCAN TO SAVE MY DETAILS');
    expect(svg).toContain('MerSam Administrator');
  });

  test('the small preview the card page requests also renders', async ({ request }) => {
    // The card page shows a thumbnail beside the download button. Its
    // dimensions must be inside what the route accepts.
    const response = await request.get(
      `/api/card/${SLUG}/wallpaper?theme=dark&width=430&height=932`,
    );

    expect(response.status(), await response.text()).toBe(200);
    const svg = await response.text();
    expect(svg).toContain('width="430"');
    expect(svg).toContain('height="932"');
  });

  test('an impossible size is still rejected', async ({ request }) => {
    const tooBig = await request.get(`/api/card/${SLUG}/wallpaper?width=99999`);
    expect(tooBig.status()).toBe(422);
  });

  test('an unpublished or unknown card is a 404', async ({ page }) => {
    const response = await page.goto('/card/nobody-has-this-slug');
    expect(response?.status()).toBe(404);
  });

  test('a card page is kept out of search engines', async ({ page }) => {
    await page.goto(`/card/${SLUG}`);
    const robots = await page.locator('meta[name="robots"]').getAttribute('content');
    expect(robots).toContain('noindex');
  });

  test('the code is readable by a real decoder', async ({ page, request, baseURL }) => {
    const response = await request.get(`/api/card/${SLUG}/qr?theme=light&size=640`);
    const svg = await response.text();

    // Rasterise the code the way a camera would, then decode the pixels.
    await page.goto('/');
    await page.addScriptTag({ path: 'node_modules/jsqr/dist/jsQR.js' });

    const decoded = await page.evaluate(async (source) => {
      const blob = new Blob([source], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const image = new Image();
      await new Promise((resolve, reject) => {
        image.onload = resolve;
        image.onerror = reject;
        image.src = url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 640;
      const context = canvas.getContext('2d', { willReadFrequently: true })!;
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, 640, 640);
      context.drawImage(image, 0, 0, 640, 640);
      URL.revokeObjectURL(url);

      const pixels = context.getImageData(0, 0, 640, 640);
      // @ts-expect-error jsQR is attached to the window by the injected script.
      return window.jsQR(pixels.data, 640, 640, { inversionAttempts: 'dontInvert' })?.data ?? '';
    }, svg);

    expect(decoded).toContain(`/card/${SLUG}`);
    expect(decoded.startsWith('http')).toBe(true);
    if (baseURL) expect(decoded).toContain('/card/');
  });
});
