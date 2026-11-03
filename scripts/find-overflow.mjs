import { chromium, devices } from '@playwright/test';

/** Reports any element wider than the viewport, innermost first. */
const base = process.argv[2] ?? 'http://127.0.0.1:3100';
const paths = process.argv.slice(3);

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();

for (const path of paths) {
  await page.goto(base + path, { waitUntil: 'networkidle' });

  const report = await page.evaluate(() => {
    const limit = document.documentElement.clientWidth;
    const offenders = [];

    /** Content inside a clipping or scrolling ancestor cannot widen the page. */
    const isContained = (node) => {
      let parent = node.parentElement;
      while (parent && parent !== document.documentElement) {
        const style = getComputedStyle(parent);
        if (/auto|scroll|hidden|clip/.test(style.overflowX)) return true;
        if (style.position === 'fixed') return true;
        parent = parent.parentElement;
      }
      return false;
    };

    for (const element of document.querySelectorAll('*')) {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) continue;
      if (rect.right <= limit + 1 && rect.left >= -1) continue;
      if (isContained(element)) continue;

      offenders.push({
        tag: element.tagName.toLowerCase(),
        cls: (element.getAttribute('class') ?? '').slice(0, 110),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        width: Math.round(rect.width),
        depth: (() => { let d = 0, n = element; while ((n = n.parentElement)) d += 1; return d; })(),
      });
    }

    return {
      limit,
      scrollWidth: document.documentElement.scrollWidth,
      offenders: offenders.sort((a, b) => b.depth - a.depth).slice(0, 8),
    };
  });

  console.log(`\n=== ${path}  viewport ${report.limit}  scrollWidth ${report.scrollWidth}`);
  for (const o of report.offenders) {
    console.log(`  <${o.tag}> L${o.left} R${o.right} W${o.width}  ${o.cls}`);
  }
}

await browser.close();
