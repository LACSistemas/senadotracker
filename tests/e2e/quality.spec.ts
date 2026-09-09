import { expect, test } from '@playwright/test';

declare global {
  interface Window { __quality: { lcp: number; cls: number } }
}

const principalRoutes = [
  '/',
  '/legislativo',
  '/legislativo/senadores',
  '/legislativo/deputados',
  '/legislativo/partidos?casa=senado',
  '/quem-me-representa?uf=AC',
  '/comparar?casa=senado&ano=2026&pessoas=5672,5525&metrica=expenses',
  '/legislativo/senadores/5672',
];

test('abas históricas seguem o padrão ARIA e funcionam com teclado', async ({ page }) => {
  await page.goto('/legislativo/senadores/5672');
  const tabs = page.getByRole('tablist', { name: 'Métrica histórica' }).getByRole('tab');
  const first = tabs.first();
  await first.focus();
  await page.keyboard.press('ArrowRight');
  const selected = tabs.filter({ has: page.locator('[aria-selected="true"]') });
  await expect(tabs.nth(1)).toBeFocused();
  await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', await tabs.nth(1).getAttribute('id') ?? '');
  expect(await selected.count()).toBeLessThanOrEqual(1);
  await page.keyboard.press('End');
  await expect(tabs.last()).toBeFocused();
  await page.keyboard.press('Home');
  await expect(first).toBeFocused();
});

test('rotas principais expõem landmarks, título e nomes acessíveis', async ({ page }) => {
  for (const route of principalRoutes) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('html')).toHaveAttribute('lang', 'pt-BR');
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('navigation', { name: 'Navegação principal' })).toBeVisible();
    expect(await page.locator('img:not([alt])').count(), `${route}: imagem sem alt`).toBe(0);
    const unnamedControls = await page.locator('input, select').evaluateAll((controls) => controls.filter((control) => {
      const element = control as HTMLInputElement | HTMLSelectElement;
      return !element.getAttribute('aria-label') && !element.getAttribute('aria-labelledby') && element.labels?.length === 0;
    }).length);
    expect(unnamedControls, `${route}: controle sem nome`).toBe(0);
  }
});

test('reflow equivalente a zoom de 200% continua utilizável', async ({ page }) => {
  test.setTimeout(120_000);
  for (const route of principalRoutes) {
    await page.setViewportSize({ width: 640, height: 900 });
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    const dimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
    expect(dimensions.content, `${route}: reflow em 200%`).toBeLessThanOrEqual(dimensions.viewport);
  }
});

test('rotas centrais mantêm LCP, CLS e carga transferida dentro do orçamento local', async ({ page }) => {
  test.setTimeout(120_000);
  const routes = ['/', '/legislativo', '/legislativo/senadores', '/legislativo/senadores/5672'];
  const measurements: Array<{ route: string; lcp: number; cls: number; bytes: number }> = [];
  for (const route of routes) {
    await page.addInitScript(() => {
      window.__quality = { lcp: 0, cls: 0 };
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const latest = entries.at(-1);
        if (latest) window.__quality.lcp = latest.startTime;
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as Array<PerformanceEntry & { value: number; hadRecentInput: boolean }>) if (!entry.hadRecentInput) window.__quality.cls += entry.value;
      }).observe({ type: 'layout-shift', buffered: true });
    });
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const quality = window.__quality;
      const bytes = performance.getEntriesByType('resource').reduce((sum, item) => sum + ((item as PerformanceResourceTiming).transferSize || 0), 0);
      return { ...quality, bytes };
    });
    expect(metrics.lcp, `${route}: LCP`).toBeLessThanOrEqual(4_000);
    expect(metrics.cls, `${route}: CLS`).toBeLessThanOrEqual(0.1);
    expect(metrics.bytes, `${route}: bytes transferidos`).toBeLessThanOrEqual(2_500_000);
    measurements.push({ route, ...metrics });
  }
  console.log(`Métricas locais: ${JSON.stringify(measurements)}`);
});

test('gera capturas de revisão desktop e mobile', async ({ page }) => {
  test.setTimeout(180_000);
  const routes: Array<[string, string]> = [
    ['home', '/'], ['legislativo', '/legislativo'], ['senadores', '/legislativo/senadores'],
    ['perfil', '/legislativo/senadores/5672'], ['partidos', '/legislativo/partidos?casa=senado'],
    ['estado', '/quem-me-representa?uf=AC'], ['comparacao', '/comparar?casa=senado&ano=2026&pessoas=5672,5525&metrica=expenses'],
  ];
  for (const [name, route] of routes) for (const viewport of [{ label: 'desktop', width: 1440, height: 1000 }, { label: 'mobile', width: 390, height: 844 }]) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(route, { waitUntil: 'networkidle' });
    await page.screenshot({ path: `docs/review/screenshots/${name}-${viewport.label}.png`, fullPage: true });
  }
});
