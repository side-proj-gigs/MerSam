import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:3000';
const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

const problems = [];
page.on('console', (m) => {
  if (m.type() === 'error' || m.type() === 'warning') problems.push(`[${m.type()}] ${m.text().slice(0, 180)}`);
});
page.on('pageerror', (e) => problems.push(`[pageerror] ${e.message.slice(0, 180)}`));

for (const path of ['/', '/card/mersam-administrator', '/services/borehole-drilling', '/contact']) {
  problems.length = 0;
  const response = await page.goto(base + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1200);
  const title = await page.title();
  console.log(`\n${path}  status=${response?.status()}  title="${title.slice(0, 50)}"`);
  const noisy = problems.filter((p) => !/favicon|Download the React DevTools|preload/i.test(p));
  if (noisy.length === 0) console.log('  no console errors or warnings');
  else noisy.forEach((p) => console.log('  ' + p));
}

await browser.close();
