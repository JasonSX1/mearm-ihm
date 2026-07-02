import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';

const target = process.env.ME_ARM_URL || 'http://localhost:5173';
const artifactDir = path.join(process.cwd(), 'tests', 'artifacts');

function inspectCanvasPixels(png, box) {
  const left = Math.max(0, Math.floor(box.x));
  const top = Math.max(0, Math.floor(box.y));
  const right = Math.min(png.width, Math.ceil(box.x + box.width));
  const bottom = Math.min(png.height, Math.ceil(box.y + box.height));
  const colors = new Set();
  let sampled = 0;
  let nonFlat = 0;

  for (let y = top; y < bottom; y += 6) {
    for (let x = left; x < right; x += 6) {
      const index = (png.width * y + x) << 2;
      const r = png.data[index];
      const g = png.data[index + 1];
      const b = png.data[index + 2];
      const a = png.data[index + 3];
      if (a < 200) continue;
      sampled++;
      colors.add(`${r >> 4}:${g >> 4}:${b >> 4}`);
      if (Math.max(r, g, b) - Math.min(r, g, b) > 8) nonFlat++;
    }
  }

  return {
    sampled,
    nonFlat,
    uniqueColors: colors.size
  };
}

await mkdir(artifactDir, { recursive: true });

const browser = await chromium.launch();
const viewports = [
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'mobile', width: 390, height: 844 }
];

try {
  for (const viewport of viewports) {
    const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
    const page = await context.newPage();

    await page.goto(target, { waitUntil: 'networkidle' });
    const canvas = page.locator('canvas').first();
    await canvas.waitFor({ state: 'visible', timeout: 15000 });
    await page.waitForTimeout(1200);

    const box = await canvas.boundingBox();
    if (!box || box.width < 260 || box.height < 260) {
      throw new Error(`Canvas pequeno ou ausente em ${viewport.name}`);
    }

    const screenshotPath = path.join(artifactDir, `${viewport.name}.png`);
    const buffer = await page.screenshot({ path: screenshotPath, fullPage: false });
    const png = PNG.sync.read(buffer);
    const stats = inspectCanvasPixels(png, box);

    if (stats.sampled < 2000 || stats.uniqueColors < 40 || stats.nonFlat < 900) {
      throw new Error(`Canvas parece vazio em ${viewport.name}: ${JSON.stringify(stats)}`);
    }

    console.log(`${viewport.name}: canvas ok`, stats);
    await context.close();
  }
} finally {
  await browser.close();
}
