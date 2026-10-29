import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * E2E da experiência de Bem-estar (P12.8) em navegador real, com dados reais do PostgreSQL publicado.
 * Rodar contra o servidor ISOLADO:  E2E_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/e2e/wellbeing-p128.spec.ts
 */
const VIT = '/municipios/3205309/bem-estar';
const ES = '/estados/ES/bem-estar';
const ART = path.resolve(process.cwd(), 'artifacts', 'p128-frontend');
try { mkdirSync(ART, { recursive: true }); } catch { /* already exists */ }

function trackConsole(page: import('@playwright/test').Page, bucket: string[]) {
  page.on('console', msg => { if (msg.type() === 'error') bucket.push(`[console] ${msg.text()}`); });
  page.on('pageerror', err => bucket.push(`[pageerror] ${err.message}`));
}

test.describe('Vitória (ES) — desktop 1360x900', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('retrato, navegação por capítulos, comparação de território e disclosure por indicador', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(VIT);
    await expect(page.getByRole('heading', { name: /Como se vive em Vitória/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Capítulos desta página' })).toBeVisible();

    const main = await page.locator('main').innerText();
    for (const bad of ['NaN', 'undefined', 'Infinity']) expect(main).not.toContain(bad);
    // Gini é estadual/nacional por regra da missão: nunca aparece na página de município (verificado separadamente na página do ES).
    expect(main).not.toMatch(/Gini da renda per capita (foi|é) 0,/);
    expect(main).toMatch(/[+−-]\s?[\d.]+/);

    await expect(page.locator('#condicoes')).toBeVisible();
    await expect(page.locator('#trabalho')).toBeVisible();
    await expect(page.locator('#rede-social')).toBeVisible();
    await expect(page.locator('#digital')).toBeVisible();
    await expect(page.locator('#acao-publica')).toBeVisible();
    await expect(page.locator('#evolucao')).toBeVisible();

    await expect(page.locator('#condicoes').getByText(/Espírito Santo|Brasil/).first()).toBeVisible();

    const chart = page.locator('#trabalho figure svg[role="img"]').first();
    await expect(chart).toBeVisible();

    const badge = page.locator('#digital li', { hasText: 'atendimento digital' }).first();
    if (await badge.count() > 0) { const txt = await badge.innerText(); expect(txt).toMatch(/Sim|Não|Sem resposta válida/); }

    await expect(page.locator('#rede-social')).toContainText(/CRAS/);

    const summary = page.locator('summary', { hasText: 'Fonte e limites' }).first();
    await expect(summary).toBeVisible();
    await summary.click();
    const details = summary.locator('..');
    await expect(details).toContainText('Fonte');
    await expect(details).toContainText('Período');
    await expect(details).toContainText('Universo');
    await expect(details).toContainText('Cobertura');

    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });

  test('screenshots: município desktop, série de trabalho, rede socioassistencial e comparação', async ({ page }) => {
    await page.goto(VIT);
    await page.screenshot({ path: path.join(ART, 'municipio-desktop-vitoria.png'), fullPage: true });
    await page.locator('#trabalho').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'trabalho-serie-temporal.png'), fullPage: true });
    await page.locator('#rede-social').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'rede-socioassistencial-suas.png'), fullPage: true });
    await page.locator('#condicoes').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'comparacao-territorio.png'), fullPage: true });
    const summary = page.locator('summary', { hasText: 'Fonte e limites' }).first();
    await summary.scrollIntoViewIfNeeded(); await summary.click();
    await page.screenshot({ path: path.join(ART, 'metodologia-disclosure-aberta.png'), fullPage: true });
  });

  test('teclado: ChapterNav e summary de disclosure recebem foco visível', async ({ page }) => {
    await page.goto(VIT);
    const nav = page.getByRole('navigation', { name: 'Capítulos desta página' });
    const firstLink = nav.locator('a, button').first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
    const navOutline = await firstLink.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.boxShadow; });
    expect(navOutline).not.toBe('none 0px none');

    const summary = page.locator('summary', { hasText: 'Fonte e limites' }).first();
    await summary.focus();
    await expect(summary).toBeFocused();
    const summaryOutline = await summary.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.boxShadow; });
    expect(summaryOutline).not.toBe('none 0px none');
  });

  test('movimento reduzido: a página renderiza igual, sem erros de console', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(VIT);
    await expect(page.locator('#trabalho')).toBeVisible();
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });
});

test.describe('Estado (ES) — desktop e mobile', () => {
  test('ES desktop: screenshot e sem overflow', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.goto(ES);
    await expect(page.getByRole('heading', { name: /Como se vive no estado de Espírito Santo/ })).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/0,505/); expect(main).toMatch(/0,542/);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(ART, 'estado-desktop-es.png'), fullPage: true });
  });

  test('ES mobile 390: sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(ES);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(ART, 'estado-mobile-es.png'), fullPage: true });
  });
});

test.describe('mobile 390 — Vitória', () => {
  test.use({ viewport: { width: 390, height: 800 } });
  test('sem rolagem horizontal; retrato e navegação visíveis', async ({ page }) => {
    await page.goto(VIT);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await expect(page.locator('#retrato')).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Capítulos desta página' })).toBeVisible();
    await page.screenshot({ path: path.join(ART, 'municipio-mobile-vitoria.png'), fullPage: true });
  });
});

test.describe('larguras de estresse e grandes', () => {
  for (const w of [320, 768, 1920]) {
    test(`largura ${w}px: Vitória sem overflow horizontal e sem erro de console`, async ({ page }) => {
      const errs: string[] = []; trackConsole(page, errs);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(VIT);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${w}px`).toBeLessThanOrEqual(0);
      expect(errs, `console/page errors em ${w}px:\n${errs.join('\n')}`).toEqual([]);
    });
  }
  test('320px: ES (estado) também sem overflow horizontal', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await page.goto(ES);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('município × UF — distinção real no navegador', () => {
  test('São Paulo município ≠ São Paulo UF', async ({ page }) => {
    await page.goto('/municipios/3550308/bem-estar');
    const muniTitle = await page.title(); const muniH1 = await page.locator('h2').first().innerText();
    await page.goto('/estados/SP/bem-estar');
    const ufTitle = await page.title(); const ufH1 = await page.locator('h2').first().innerText();
    expect(muniTitle).not.toEqual(ufTitle);
    expect(muniH1).not.toEqual(ufH1);
  });

  test('Brasília município ≠ Distrito Federal UF', async ({ page }) => {
    await page.goto('/municipios/5300108/bem-estar');
    const muniTitle = await page.title();
    await page.goto('/estados/DF/bem-estar');
    const ufTitle = await page.title();
    expect(muniTitle).not.toEqual(ufTitle);
  });
});

test.describe('territórios pequenos — honestidade de ausência', () => {
  test('Boa Esperança do Norte (MT): não falha, não inventa zero, mostra ausência honesta', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto('/municipios/5101837/bem-estar');
    await expect(page.locator('main')).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/não publicou|não registrou|Sem dados publicados|Nenhum valor é estimado/);
    const pendingBlocks = await page.locator('div.border-dashed').count();
    expect(pendingBlocks).toBeGreaterThan(0);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    await page.screenshot({ path: path.join(ART, 'estado-de-ausencia-boa-esperanca.png'), fullPage: true });
  });

  test('Alto Rio Novo (ES): mesmo tratamento de ausência honesta', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto('/municipios/3200359/bem-estar');
    await expect(page.locator('main')).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).not.toMatch(/\b0\b.{0,20}(vínculos|CRAS|CREAS)/i);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });
});
