import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

/**
 * Decodes rendered codes with jsQR, the decoder most web scanners are built
 * on. Pixels come from a real canvas, so this exercises the same path a phone
 * camera would: rasterise, threshold, locate, decode.
 */
const require = createRequire(import.meta.url);
const jsqrPath = require.resolve('jsqr/dist/jsQR.js');
const jsqrSource = readFileSync(jsqrPath, 'utf8');

const dir = process.argv[2];
const files = process.argv.slice(3);

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
await page.addScriptTag({ content: jsqrSource });

let failures = 0;
for (const file of files) {
  const base64 = readFileSync(path.join(dir, file)).toString('base64');
  const result = await page.evaluate(async (data) => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob();
    const bitmap = await createImageBitmap(blob);

    // Very large images are downscaled the way a camera frame would be.
    const maxEdge = 1400;
    const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, width, height);
    const pixels = context.getImageData(0, 0, width, height);

    const code = window.jsQR(pixels.data, width, height, { inversionAttempts: 'dontInvert' });
    return { value: code?.data ?? '', size: `${bitmap.width}x${bitmap.height}` };
  }, base64);

  const ok = Boolean(result.value);
  if (!ok) failures += 1;
  console.log(
    `${ok ? 'SCANNED' : 'FAILED '} ${file.padEnd(28)} ${result.size.padEnd(11)} ${result.value.slice(0, 55)}`,
  );
}

await browser.close();
process.exit(failures > 0 ? 1 : 0);
