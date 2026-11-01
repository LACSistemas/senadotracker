import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * E2E da experiência territorial do P14 (hero, mapa, teasers de domínio, composição legislativa,
 * governo/PIB/IDHM) em navegador real, com dados reais do PostgreSQL publicado.
 * Rodar contra o servidor ISOLADO: E2E_BASE_URL=http://127.0.0.1:3144 npx playwright test tests/e2e/p14-territorio-executivo.spec.ts
 */
const ES = '/estados/ES';
const VIT = '/municipios/3205309';
const SP_MUN = '/municipios/3550308';
const ART = path.resolve(process.cwd(), 'artifacts', 'p14-frontend');
try { mkdirSync(ART, { recursive: true }); } catch { /* already exists */ }

function trackConsole(page: import('@playwright/test').Page, bucket: string[]) {
  page.on('console', msg => { if (msg.type() === 'error') bucket.push(`[console] ${msg.text()}`); });
  page.on('pageerror', err => bucket.push(`[pageerror] ${err.message}`));
}

test.describe('Estado (ES) — governo, PIB, IDHM e representação', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('hero, governador, PIB per capita, IDHM e composição legislativa aparecem com dado real', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(ES);

    await expect(page.getByRole('heading', { name: 'Espírito Santo', exact: false }).first()).toBeVisible();
    await expect(page.locator('section:has(#exec-resumo)')).toContainText('RENATO CASAGRANDE');
    await expect(page.locator('section:has(#exec-resumo)')).toContainText('PSB');
    await expect(page.locator('section:has(#exec-resumo)')).toContainText('PIB per capita');
    await expect(page.locator('section:has(#exec-resumo) img')).toHaveAttribute('src', /\/api\/portrait\?url=/);
    await expect(page.locator('section:has(#idhm-resumo)')).toContainText('IDHM de Espírito Santo');
    await expect(page.locator('section:has(#leg-resumo)')).toContainText('parlamentares em exercício');

    const main = await page.locator('main').innerText();
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);

    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    await page.screenshot({ path: path.join(ART, 'estado-es-overview.png'), fullPage: true });
  });

  test('ES mobile 390: sem overflow horizontal com os novos cartões', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(ES);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(ART, 'estado-es-mobile.png'), fullPage: true });
  });
});

test.describe('Município (Vitória) — governo do estado + PIB per capita próprio', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('mostra o governador do estado e o PIB per capita do PRÓPRIO município, não o da UF', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(VIT);

    await expect(page.locator('section:has(#exec-resumo)')).toContainText('LORENZO PAZOLINI');
    await expect(page.locator('section:has(#exec-resumo)')).toContainText('Governador de Espírito Santo: RENATO CASAGRANDE');
    const execText = await page.locator('section:has(#exec-resumo)').innerText();
    expect(execText).toMatch(/R\$\s?85/); // PIB per capita de Vitória (≈85 mil), não o da UF (≈45 mil)
    await expect(page.locator('section:has(#idhm-resumo)')).toContainText('IDHM de Vitória');

    const main = await page.locator('main').innerText();
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    await page.screenshot({ path: path.join(ART, 'municipio-vitoria-overview.png'), fullPage: true });
  });
});

test.describe('município × UF — PIB per capita real e distinto', () => {
  test('São Paulo município tem PIB per capita diferente do de São Paulo UF', async ({ page }) => {
    await page.goto(SP_MUN);
    const muniText = await page.locator('section:has(#exec-resumo)').innerText();
    await page.goto('/estados/SP');
    const ufText = await page.locator('section:has(#exec-resumo)').innerText();
    expect(muniText).not.toEqual(ufText);
  });
});

test.describe('regressão — outros domínios não afetados', () => {
  for (const [label, url] of [
    ['saúde (município)', '/municipios/3205309/saude'],
    ['educação (município)', '/municipios/3205309/educacao'],
    ['segurança (município)', '/municipios/3205309/seguranca'],
    ['bem-estar (município)', '/municipios/3205309/bem-estar'],
    ['infraestrutura (município)', '/municipios/3205309/infraestrutura'],
    ['representação (estado)', '/estados/ES/representacao'],
  ] as const) {
    test(`${label} continua respondendo 200 sem erro de console`, async ({ page }) => {
      const errs: string[] = []; trackConsole(page, errs);
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    });
  }
});
