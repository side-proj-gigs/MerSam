import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import path from 'node:path';

/** Renders SVG files to PNG so they can be inspected like any other image. */
const dir = process.argv[2];
const files = process.argv.slice(3);

const browser = await chromium.launch();
const page = await browser.newPage();

for (const file of files) {
  const svg = readFileSync(path.join(dir, file), 'utf8');
  const width = Number(/width="(\d+)"/.exec(svg)?.[1] ?? 600);
  const height = Number(/height="(\d+)"/.exec(svg)?.[1] ?? 600);
  const scale = Math.min(1, 820 / Math.max(width, height));

  await page.setViewportSize({
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  });
  await page.setContent(
    `<body style="margin:0"><div style="width:${width}px;height:${height}px;transform:scale(${scale});transform-origin:0 0">${svg}</div></body>`,
  );
  await page.waitForTimeout(150);
  const out = path.join(dir, file.replace('.svg', '.png'));
  await page.screenshot({ path: out });
  console.log('rendered', file, `${width}x${height}`);
}

await browser.close();
