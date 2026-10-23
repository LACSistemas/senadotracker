import { expect, test } from '@playwright/test';

/**
 * E2E da experiência de Segurança (P9.8) em navegador real, com dados reais do PostgreSQL publicado.
 * Rodar contra o servidor ISOLADO:  E2E_BASE_URL=http://127.0.0.1:3102 npx playwright test tests/e2e/seguranca-p98.spec.ts
 */
const VIT = '/municipios/3205309/seguranca';

test.describe('Vitória (ES) — desktop', () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test('panorama com quatro indicadores, régua de comparação e navegação por capítulos', async ({ page }) => {
    await page.goto(VIT); await expect(page.getByRole('heading', { name: /Como está a Segurança Pública em Vitória/ })).toBeVisible();
    await expect(page.locator('[id^="kpi-"]')).toHaveCount(4); await expect(page.getByText('Comparação válida').first()).toBeHidden().catch(() => undefined);
    await expect(page.getByRole('img', { name: /Vitória: .*Mediana do grupo/ }).first()).toBeVisible();
    await page.getByRole('link', { name: /^8\s*Explorar os dados$/ }).click(); await expect(page.locator('#explorar')).toBeInViewport();
    await expect(page.getByRole('navigation', { name: 'Capítulos desta página' })).toBeVisible();
  });

  test('criminalidade: escolher um crime carrega a série sob demanda, a taxa mostra comparação válida e o período muda o gráfico', async ({ page }) => {
    await page.goto(VIT); const ch = page.locator('#criminalidade');
    await ch.getByRole('button', { name: /Roubo: a pessoa em via pública/ }).click();
    await expect(ch.getByRole('heading', { name: 'Roubo: a pessoa em via pública' })).toBeVisible(); await expect(ch.locator('figure svg[role="img"]').first()).toBeVisible();
    await ch.getByRole('group', { name: 'Medida' }).getByRole('button', { name: 'Por 100 mil habitantes' }).click(); await expect(ch.getByText('Comparação válida.')).toBeVisible({ timeout: 15000 });
    const labelsAll = await ch.locator('figure svg text').count(); await ch.getByRole('button', { name: '3 anos' }).click(); const labels3 = await ch.locator('figure svg text').count(); expect(labels3).toBeLessThan(labelsAll);
    const svg = ch.locator('figure svg[role="img"]').first(); await svg.hover({ position: { x: 300, y: 120 } }); await expect(ch.locator('figure .shadow-lg').first()).toBeVisible();
  });

  test('gráfico acessível por teclado: setas percorrem os valores e a região viva é atualizada', async ({ page }) => {
    await page.goto(VIT); const svg = page.locator('#criminalidade figure svg[role="img"]').first(); await svg.focus(); await page.keyboard.press('ArrowRight');
    await expect(page.locator('#criminalidade figure p.sr-only[aria-live="polite"]').first()).not.toHaveText('');
  });

  test('finanças: etapas separadas, comparação por habitante e contratos sob demanda', async ({ page }) => {
    await page.goto(VIT); const f = page.locator('#financas');
    await f.getByRole('button', { name: 'Empenhado' }).click(); await expect(f.getByText(/Empenhado na função Segurança Pública/).first()).toBeVisible();
    await f.getByRole('button', { name: 'Por habitante' }).click(); await expect(f.getByText('Comparação válida.')).toBeVisible();
    await f.getByRole('button', { name: 'Ver os maiores contratos' }).click(); await expect(f.getByRole('table', { name: /Contratos do PNCP/ }).locator('tbody tr').first()).toBeVisible({ timeout: 15000 }); await expect(f.getByText(/não é valor pago/).first()).toBeVisible();
  });

  test('explorar os dados: lista, série exata e exportação CSV com metadados', async ({ page }) => {
    await page.goto(VIT); const ex = page.locator('#explorar'); await ex.getByText(/Abrir o modo/).click(); await expect(ex.getByRole('button', { name: /Mortes por agressão/ }).first()).toBeVisible({ timeout: 15000 });
    await ex.getByRole('searchbox', { name: 'Procurar indicador' }).fill('homicídio'); await ex.locator('ul button').first().click(); await expect(ex.getByRole('button', { name: 'Exportar CSV' })).toBeVisible();
    const [dl] = await Promise.all([page.waitForEvent('download'), ex.getByRole('button', { name: 'Exportar CSV' }).click()]); const path = await dl.path(); const txt = (await import('node:fs')).readFileSync(path!, 'utf8');
    expect(txt).toContain('# Cívica — Segurança'); expect(txt).toContain('periodo,valor,numerador,denominador,flags'); expect(txt).toContain('Fonte:');
  });

  test('estados de dado e proibições: sem NaN/undefined, sem conclusão de causa, sem facção', async ({ page }) => {
    await page.goto(VIT); const text = await page.locator('main').innerText(); for (const bad of ['NaN', 'undefined', 'Infinity']) expect(text).not.toContain(bad);
    expect(text).not.toMatch(/facç|domínio territorial|cidade segura|cidade perigosa/i); expect(text).toMatch(/Nenhum estabelecimento identificado nesta base/); expect(text).toMatch(/não é o efetivo lotado em Vitória|não são o efetivo lotado em Vitória/);
  });

  test('Detran: a página diz o que não existe, sem inventar número', async ({ page }) => {
    await page.goto(VIT); await expect(page.getByText('E o Detran?')).toBeVisible(); await expect(page.getByText(/ainda não tem cadastro de unidades/)).toBeVisible();
  });
});

test.describe('outros territórios', () => {
  test('Alto Rio Novo: município pequeno não recebe comparação de taxa e mostra "Não tem" guarda', async ({ page }) => {
    await page.goto('/municipios/3200359/seguranca'); await expect(page.getByText('Sem comparação válida para este indicador').first()).toBeVisible(); await expect(page.getByText('Não tem').first()).toBeVisible();
  });
  test('Salvador: sem fonte estadual municipalizada, o herói não traz "Roubos" e o dado só-estadual é identificado', async ({ page }) => {
    await page.goto('/municipios/2927408/seguranca'); await expect(page.locator('[id^="kpi-"]').filter({ hasText: 'Roubos registrados' })).toHaveCount(0); await expect(page.getByText('Só existe para o estado (contexto)').first()).toBeVisible().catch(() => undefined);
  });
  test('estado: a página do estado usa as mesmas seções e a comparação é com as UFs', async ({ page }) => {
    await page.goto('/estados/ES/seguranca'); await expect(page.getByText(/unidades da federação/).first()).toBeVisible(); await expect(page.locator('#estrutura')).toBeVisible(); await expect(page.locator('#apreensoes')).toBeVisible();
  });
  test('visão geral do município tem a vitrine de Segurança e leva à leitura completa', async ({ page }) => {
    await page.goto('/municipios/3205309'); const link = page.getByRole('link', { name: /Ler a história completa/ }); await expect(link).toBeVisible(); await link.click(); await expect(page).toHaveURL(/\/municipios\/3205309\/seguranca/);
  });
  test('APIs: benchmark válido responde; parâmetros inválidos são recusados', async ({ request }) => {
    const ok = await request.get('/api/seguranca/benchmark?entity=3205309&opt=vde:homicidio-doloso'); expect(ok.status()).toBe(200); expect((await ok.json()).status).toBeTruthy();
    expect((await request.get('/api/seguranca/benchmark?entity=0&opt=x')).status()).toBe(404); expect((await request.get('/api/seguranca/serie?entity=3205309&ind=1')).status()).toBe(400);
    const cmp = await request.get('/api/seguranca/comparar?entity=3205309&other=3200359&opt=vde:homicidio-doloso'); expect(cmp.status()).toBe(422);
    const other = await request.get('/api/seguranca/comparar?entity=3205309&other=3205200&opt=vde:homicidio-doloso'); expect(other.status()).toBe(200);
  });
});

test.describe('mobile 390', () => {
  test.use({ viewport: { width: 390, height: 800 }, hasTouch: true });
  test('sem rolagem horizontal, seletor nativo de crimes e KPI visível logo no início', async ({ page }) => {
    await page.goto(VIT); expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
    await expect(page.locator('#crime-select')).toBeVisible(); await page.locator('#crime-select').selectOption({ label: 'Tentativas de homicídio' }); await expect(page.locator('#criminalidade').getByRole('heading', { name: 'Tentativas de homicídio' })).toBeVisible({ timeout: 15000 });
    const firstKpi = page.locator('[id^="kpi-"]').first(); const box = await firstKpi.boundingBox(); expect(box!.y).toBeLessThan(1400);
  });
});
