import { chromium, devices } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const base = process.argv[2];
const out = process.argv[3];
const state = process.argv[4];
fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

async function shoot(name, url, options = {}) {
  const context = await browser.newContext({
    ...(options.mobile ? devices['Pixel 7'] : { viewport: { width: 1440, height: 1000 } }),
    ...(options.auth && state ? { storageState: state } : {}),
  });
  const page = await context.newPage();
  // Skip the one-per-session splash so the page itself is captured.
  await context.addInitScript(() => {
    try { sessionStorage.setItem('mersam-splash-seen', '1'); } catch {}
  });
  await page.goto(base + url, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: Boolean(options.full) });
  console.log('shot', name);
  await context.close();
}

await shoot('home', '/');
await shoot('home-mobile', '/', { mobile: true });
await shoot('services', '/services');
await shoot('service-detail', '/services/borehole-drilling');
await shoot('contact', '/contact');
await shoot('card', '/card/mersam-administrator');
await shoot('card-mobile', '/card/mersam-administrator', { mobile: true });
await shoot('admin-dashboard', '/admin', { auth: true });
await shoot('admin-invoices', '/admin/invoices', { auth: true });
await shoot('admin-team', '/admin/team', { auth: true });

await browser.close();
