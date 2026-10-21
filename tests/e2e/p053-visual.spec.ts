import { expect, test } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';

const cases = [
  ['senadores', '/legislativo/senadores'],
  ['deputados', '/legislativo/deputados'],
  ['rankings', '/legislativo/rankings'],
  ['comparar', '/comparar?casa=senado&ano=2026&pessoas=5672,5525&metrica=expenses'],
] as const;

test('P0.5.3 rotas financeiras e legislativas renderizam sem overflow em desktop e mobile', async ({ page }) => {
  test.setTimeout(240_000);
  await mkdir('artifacts/P053_visual', { recursive: true });
  const manifest: Array<Record<string, unknown>> = [];
  for (const [name, route] of cases) {
    for (const viewport of [{ label: 'desktop', width: 1360, height: 900 }, { label: 'mobile', width: 390, height: 844 }]) {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const errors: string[] = [];
      const onError = (error: Error) => errors.push(error.message);
      page.on('pageerror', onError);
      const response = await page.goto(route, { waitUntil: 'networkidle', timeout: 120_000 });
      const checks = await page.evaluate(() => {
        const viewportWidth = document.documentElement.clientWidth;
        const contentWidth = document.documentElement.scrollWidth;
        const bodyText = document.body.innerText;
        return {
          viewportWidth,
          contentWidth,
          horizontalOverflow: contentWidth > viewportWidth,
          mojibake: /\ufffd/.test(bodyText),
        };
      });
      const file = `artifacts/P053_visual/${name}-${viewport.label}.png`;
      await page.screenshot({ path: file, fullPage: true });
      page.off('pageerror', onError);
      const item = { name, route, viewport, file, status: response?.status() ?? null, pageErrors: errors, ...checks };
      manifest.push(item);
      expect(item.status, `${route} status`).toBe(200);
      expect(errors, `${route} page errors`).toEqual([]);
      expect(checks.horizontalOverflow, `${route} horizontal overflow`).toBe(false);
      expect(checks.mojibake, `${route} mojibake`).toBe(false);
    }
  }
  await writeFile('artifacts/P053_visual/manifest.json', JSON.stringify({ generatedAt: new Date().toISOString(), cases: manifest }, null, 2));
});

