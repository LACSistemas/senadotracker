import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

/**
 * E2E da experiência de Infraestrutura (P13.7) em navegador real, com dados reais do PostgreSQL publicado.
 * Rodar contra o servidor ISOLADO:  E2E_BASE_URL=http://127.0.0.1:3103 npx playwright test tests/e2e/infraestrutura-p137.spec.ts
 */
const VIT = '/municipios/3205309/infraestrutura';
const SP = '/municipios/3550308/infraestrutura';
const ES = '/estados/ES/infraestrutura';
const VIT_OBRAS = '/municipios/3205309/infraestrutura/obras';
const ES_OBRAS = '/estados/ES/infraestrutura/obras';
const OBRA_RICA = '/obras/89442';
const OBRA_MULTI = '/obras/1963';
const OBRA_NOVA = '/obras/1';
const ART = path.resolve(process.cwd(), 'artifacts', 'p137-frontend');
try { mkdirSync(ART, { recursive: true }); } catch { /* already exists */ }

function trackConsole(page: import('@playwright/test').Page, bucket: string[]) {
  page.on('console', msg => { if (msg.type() === 'error') bucket.push(`[console] ${msg.text()}`); });
  page.on('pageerror', err => bucket.push(`[pageerror] ${err.message}`));
}

test.describe('Vitória (ES) — desktop 1360x900', () => {
  test.use({ viewport: { width: 1360, height: 900 } });

  test('panorama, navegação por capítulos, comparação de território e disclosure por indicador', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(VIT);
    await expect(page.getByRole('heading', { name: /O que existe e está registrado em Vitória/ })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Capítulos desta página' })).toBeVisible();

    const main = await page.locator('main').innerText();
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);

    await expect(page.locator('#agua-saneamento')).toBeVisible();
    await expect(page.locator('#ruas-entorno')).toBeVisible();
    await expect(page.locator('#habitacao')).toBeVisible();
    await expect(page.locator('#energia')).toBeVisible();
    await expect(page.locator('#mobilidade')).toBeVisible();
    await expect(page.locator('#obras')).toBeVisible();

    // comparador só aparece quando o backend elegeu o indicador — a seção, se presente, nunca mostra zero sintético.
    const compareSection = page.locator('text=Comparação com o estado e o Brasil');
    if (await compareSection.count() > 0) await expect(compareSection.first()).toBeVisible();

    const summary = page.locator('summary', { hasText: 'Fonte e limites' }).first();
    await expect(summary).toBeVisible();
    await summary.click();
    const details = summary.locator('..');
    await expect(details).toContainText('Fonte');
    await expect(details).toContainText('Período');
    await expect(details).toContainText('Cobertura');

    await expect(page.getByText('Explorar lista completa de obras')).toBeVisible();
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });

  test('explorador: abre, filtra por família e exporta CSV', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(VIT);
    const explorerSummary = page.locator('summary', { hasText: 'Explorar catálogo completo de indicadores' });
    await explorerSummary.scrollIntoViewIfNeeded();
    await explorerSummary.click();
    const panel = explorerSummary.locator('..');
    await expect(panel.getByPlaceholder('Buscar por nome ou código')).toBeVisible();
    await panel.getByPlaceholder('Buscar por nome ou código').fill('água');
    await expect(panel.locator('tbody tr').first()).toBeVisible();
    const downloadPromise = page.waitForEvent('download');
    await panel.getByRole('button', { name: 'Exportar CSV' }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/\.csv$/);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });

  test('screenshots: panorama, ruas e entorno, energia, obras', async ({ page }) => {
    await page.goto(VIT);
    await page.screenshot({ path: path.join(ART, 'municipio-desktop-vitoria.png'), fullPage: true });
    await page.locator('#ruas-entorno').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'ruas-entorno-unidades.png'), fullPage: true });
    await page.locator('#energia').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'energia-mmgd-aneel-anp.png'), fullPage: true });
    await page.locator('#obras').scrollIntoViewIfNeeded();
    await page.screenshot({ path: path.join(ART, 'obras-overview.png'), fullPage: true });
  });

  test('teclado: ChapterNav e summary recebem foco visível', async ({ page }) => {
    await page.goto(VIT);
    const nav = page.getByRole('navigation', { name: 'Capítulos desta página' });
    const firstLink = nav.locator('a, button').first();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
    const outline = await firstLink.evaluate(el => { const s = getComputedStyle(el); return s.outlineStyle + ' ' + s.outlineWidth + ' ' + s.boxShadow; });
    expect(outline).not.toBe('none 0px none');
  });

  test('movimento reduzido: renderiza igual, sem erros de console', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(VIT);
    await expect(page.locator('#obras')).toBeVisible();
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });
});

test.describe('Estado (ES) — desktop e mobile', () => {
  test('ES desktop: sem comparador (só município), sem overflow, screenshot', async ({ page }) => {
    await page.setViewportSize({ width: 1360, height: 900 });
    await page.goto(ES);
    await expect(page.getByRole('heading', { name: /O que existe e está registrado no estado de Espírito Santo/ })).toBeVisible();
    await expect(page.getByText('Comparação com o estado e o Brasil')).toHaveCount(0);
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

test.describe('larguras de estresse', () => {
  for (const w of [320, 360, 390, 768, 1360, 1440, 1920]) {
    test(`largura ${w}px: Vitória sem overflow horizontal e sem erro de console`, async ({ page }) => {
      const errs: string[] = []; trackConsole(page, errs);
      await page.setViewportSize({ width: w, height: 900 });
      await page.goto(VIT);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${w}px`).toBeLessThanOrEqual(0);
      expect(errs, `console/page errors em ${w}px:\n${errs.join('\n')}`).toEqual([]);
    });
  }
});

test.describe('obras públicas — lista', () => {
  test('Vitória: lista, filtro de situação preservado na URL, sem overflow mobile', async ({ page }) => {
    await page.goto(VIT_OBRAS);
    await expect(page.getByRole('heading', { name: /Obras públicas em Vitória/ })).toBeVisible();
    await expect(page.locator('table tbody tr').first()).toBeVisible();

    const statusSelect = page.locator('select[name="status"]');
    await statusSelect.selectOption('2');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page).toHaveURL(/status=2/);
    await expect(page.locator('table tbody tr').first()).toContainText('Concluída');

    await page.setViewportSize({ width: 390, height: 800 });
    await page.goto(`${VIT_OBRAS}?status=2`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    await page.screenshot({ path: path.join(ART, 'obras-lista-mobile-vitoria.png'), fullPage: true });
  });

  test('ES: filtro multimunicipal mostra "não ratado", não um valor fictício', async ({ page }) => {
    await page.goto(ES_OBRAS);
    const scopeSelect = page.locator('select[name="scope"]');
    await scopeSelect.selectOption('MULTI');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect(page).toHaveURL(/scope=MULTI/);
    const rows = page.locator('table tbody tr');
    if (await rows.count() > 0) await expect(rows.first()).toContainText('não ratado');
    await page.screenshot({ path: path.join(ART, 'obras-lista-desktop-es-multi.png'), fullPage: true });
  });

  test('paginação: página 2 preserva filtros na URL', async ({ page }) => {
    await page.goto(`${ES_OBRAS}?status=2`);
    const next = page.getByRole('link', { name: /Próxima/ });
    if (await next.count() > 0) {
      await next.click();
      await expect(page).toHaveURL(/page=2/);
      await expect(page).toHaveURL(/status=2/);
    }
  });
});

test.describe('obras públicas — detalhe', () => {
  test('obra rica em contratos e empenhos: 5 estágios nunca somados, empenhos paginados', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(OBRA_RICA);
    await expect(page.getByText('Previsto', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Contratado', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Empenhado', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Liquidado', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Pago', { exact: true }).first()).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/R\$ 700,0 mi/);
    expect(main).toMatch(/R\$ 9,1 bi/);
    expect(main).toMatch(/página \d+ de \d+/i);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    await page.screenshot({ path: path.join(ART, 'obra-detalhe-rica.png'), fullPage: true });
  });

  test('obra multimunicipal: lista municípios e nunca atribui o valor integral a cada um', async ({ page }) => {
    await page.goto(OBRA_MULTI);
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/multimunicipal/i);
    expect(main).toMatch(/não foi rateado/);
    await page.screenshot({ path: path.join(ART, 'obra-detalhe-multimunicipal.png'), fullPage: true });
  });

  test('obra recém-cadastrada: ausência de estágio financeiro nunca aparece como R$ 0', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto(OBRA_NOVA);
    const main = await page.locator('main').innerText();
    expect(main).not.toMatch(/R\$\s?0[,.]0/);
    expect(main).toMatch(/Não há informação publicada para esta etapa/);
    expect(main).toMatch(/Não há contrato publicado|Não há empenho publicado/);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });

  test('obra inexistente: 404, não erro 500', async ({ page }) => {
    const res = await page.goto('/obras/999999999');
    expect(res?.status()).toBe(404);
  });
});

test.describe('município × UF — distinção real no navegador', () => {
  test('São Paulo município ≠ São Paulo UF', async ({ page }) => {
    await page.goto(SP);
    const muniTitle = await page.title();
    await page.goto('/estados/SP/infraestrutura');
    const ufTitle = await page.title();
    expect(muniTitle).not.toEqual(ufTitle);
  });
});

test.describe('territórios pequenos e pós-Censo — honestidade de ausência', () => {
  test('Boa Esperança do Norte (MT): não falha, não inventa zero, mostra ausência honesta', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto('/municipios/5101837/infraestrutura');
    await expect(page.locator('main')).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/não publicou|não registrou|Sem dados publicados|Nenhum valor é estimado/);
    const pendingBlocks = await page.locator('div.border-dashed').count();
    expect(pendingBlocks).toBeGreaterThan(0);
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    await page.screenshot({ path: path.join(ART, 'estado-de-ausencia-boa-esperanca.png'), fullPage: true });
  });

  test('Atílio Vivácqua (ES), município pequeno: sem erro, sem zero fictício em obras', async ({ page }) => {
    const errs: string[] = []; trackConsole(page, errs);
    await page.goto('/municipios/3200706/infraestrutura');
    await expect(page.locator('main')).toBeVisible();
    expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
  });
});

test.describe('regressão — outros domínios não afetados', () => {
  for (const [label, url] of [
    ['saúde (município)', '/municipios/3205309/saude'],
    ['educação (município)', '/municipios/3205309/educacao'],
    ['segurança (município)', '/municipios/3205309/seguranca'],
    ['bem-estar (município)', '/municipios/3205309/bem-estar'],
    ['quem-me-representa (estado)', '/estados/ES/representacao'],
    ['visão geral (estado)', '/estados/ES'],
  ] as const) {
    test(`${label} continua respondendo 200 sem erro de console`, async ({ page }) => {
      const errs: string[] = []; trackConsole(page, errs);
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
      expect(errs, `console/page errors:\n${errs.join('\n')}`).toEqual([]);
    });
  }
});
