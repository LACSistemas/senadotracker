import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
const output = 'artifacts/comissoes-v3';
await mkdir(output, { recursive: true });
const base = process.env.COMMISSION_TEST_URL || 'http://127.0.0.1:3000';
const states = [['todas', ''], ['camara', '?house=camara'], ['senado', '?house=senado'], ['cma', '?q=CMA'], ['constituicao', '?q=Constitui%C3%A7%C3%A3o']];
const timings = [];
for (const [label, path] of [['cold', ''], ['warm', ''], ...states.slice(1)]) {
  const start = performance.now();
  const response = await fetch(`${base}/comissoes${path}`);
  const html = await response.text();
  if (!response.ok || !html.includes('Onde o trabalho legislativo ganha forma')) throw new Error(`Invalid page ${label}`);
  timings.push({ label, ms: Math.round(performance.now() - start), status: response.status });
}
const browser = await chromium.launch({ headless: true });
const checks = [];
try {
  for (const [size, width, height] of [['wide', 1920, 1080], ['desktop', 1440, 1000], ['mobile', 390, 844]]) {
    const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
    for (const [state, path] of states) {
      await page.goto(`${base}/comissoes${path}`, { waitUntil: 'networkidle' });
      await page.screenshot({ path: `${output}/${size}-${state}.png`, fullPage: true });
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      if (overflow) throw new Error(`Horizontal overflow: ${size}/${state}`);
      const text = await page.locator('main').innerText();
      if (text.includes('?ltima') || text.includes('mat?rias')) throw new Error('Encoding regression');
      checks.push({ size, state, overflow, activity: await page.locator('#activity-title').innerText() });
    }
    await page.close();
  }
} finally { await browser.close(); }
await writeFile(`${output}/browser-validation.json`, JSON.stringify({ base, timings, checks }, null, 2));
console.log(JSON.stringify({ timings, screenshots: checks.length }, null, 2));
