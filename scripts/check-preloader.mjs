import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://localhost:3000';
const browser = await chromium.launch();

async function run(label, prime) {
  // Headless Chromium reports reduced motion by default, which the splash
  // correctly honours. Real browsers usually do not, so force it off here.
  const context = await browser.newContext({ reducedMotion: 'no-preference' });
  const page = await context.newPage();

  if (prime) {
    await page.goto(base + '/');
    await page.waitForTimeout(3500);
  }

  const started = Date.now();
  await page.goto(base + '/', { waitUntil: 'domcontentloaded' });

  // Matched on its own attribute: the splash text also appears in the hero.
  const splash = page.locator('[data-splash]');

  let appeared = false;
  try {
    await splash.waitFor({ state: 'visible', timeout: 1500 });
    appeared = true;
  } catch {
    // Not shown, which is correct on a repeat visit.
  }

  let clearedAfter = null;
  if (appeared) {
    try {
      await splash.waitFor({ state: 'detached', timeout: 8000 });
      clearedAfter = Date.now() - started;
    } catch {
      clearedAfter = 'NEVER CLEARED';
    }
  }

  console.log(`${label.padEnd(22)} shown=${appeared}  cleared=${clearedAfter ?? 'n/a'}`);
  await context.close();
  return { appeared, clearedAfter };
}

const first = await run('first visit', false);
const repeat = await run('same session repeat', true);

await browser.close();

const ok =
  first.appeared &&
  typeof first.clearedAfter === 'number' &&
  first.clearedAfter < 6000 &&
  !repeat.appeared;

console.log(ok ? '\nPRELOADER OK' : '\nPRELOADER PROBLEM');
process.exit(ok ? 0 : 1);
