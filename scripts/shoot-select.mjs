import { chromium } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Opens the "Add a service" dialog and captures each dropdown in both themes,
 * so the popup can be inspected the way a person actually sees it.
 */
const base = process.argv[2];
const out = process.argv[3];
const state = process.argv[4];

fs.mkdirSync(out, { recursive: true });

const browser = await chromium.launch();

async function shoot(theme) {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    storageState: state,
    reducedMotion: 'reduce',
    colorScheme: theme,
  });

  const page = await context.newPage();
  await context.addInitScript((mode) => {
    try {
      sessionStorage.setItem('mersam-splash-seen', '1');
      localStorage.setItem('mersam-theme', mode);
    } catch {
      /* storage blocked */
    }
  }, theme);

  await page.goto(base + '/admin/services', { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /Add service/i }).click();
  await page.waitForTimeout(500);

  // The short list: category.
  await page.getByRole('combobox', { name: /Category/i }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, `select-category-${theme}.png`) });

  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);

  // The long list: icon, which is where the filter appears.
  await page.getByRole('combobox', { name: /Icon/i }).click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(out, `select-icon-${theme}.png`) });

  console.log('captured', theme);
  await context.close();
}

await shoot('dark');
await shoot('light');
await browser.close();
