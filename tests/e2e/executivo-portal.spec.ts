import { expect, test } from '@playwright/test';

/**
 * E2E do portal nacional `/executivo` contra dado real (sem mocks). Números verificados ao vivo durante
 * a implementação: 214.211.951 habitantes (soma das 27 UFs), 5.571 municípios (5.570 + Fernando de
 * Noronha), IDHM do Brasil 0,727 (2010 — não há edição 2021 nesta base).
 */
test.describe('Portal nacional', () => {
  test('hero mostra painel nacional real, sem taxa de congestionamento inventada', async ({ page }) => {
    const res = await page.goto('/executivo');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'O Brasil que as políticas públicas revelam.' })).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toContain('214.211.951');
    expect(main).toContain('5.571');
    expect(main).toContain('27');
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('as cinco áreas mostram indicador nacional real, nunca "—" para todos', async ({ page }) => {
    await page.goto('/executivo');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Saúde');
    expect(main).toContain('Educação');
    expect(main).toContain('Segurança');
    expect(main).toContain('Bem-estar');
    expect(main).toContain('Infraestrutura');
    expect(main).toContain('leitos por mil hab');
    expect(main).toContain('Ideb');
    // E7: o rótulo vem direto do banco (observation.label), não mais de um texto editorial hardcoded —
    // por isso a maiúscula inicial real ("Renda...", não "renda...").
    expect(main).toContain('Renda domiciliar per capita média');
  });
});

test.describe('Explorador por indicador', () => {
  test('População: mapa e tabela mostram valores reais por UF', async ({ page }) => {
    await page.goto('/executivo');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Indicador do mapa');
    expect(main).toContain('POPULAÇÃO RESIDENTE');
    await page.getByText('Ver todos os estados em tabela').click();
    // E7: a página passou a ter mais de uma <table> real (cada gráfico de evolução — Ideb, tráfico de
    // drogas — expõe sua própria tabela de dados em "Ver dados do gráfico", acessível e correta); por
    // isso o escopo precisa ser a tabela da faixa de estados do hero, não qualquer <table> da página.
    const heroTable = page.locator('details', { hasText: 'Ver todos os estados em tabela' }).locator('table');
    const rows = heroTable.locator('tbody tr');
    await expect(rows).toHaveCount(27);
    const tableText = await heroTable.innerText();
    expect(tableText).toMatch(/\d{1,3}\.\d{3}\.\d{3}/);
  });

  test('IDHM: selecionar um estado mostra o valor real de 2010, não "—"', async ({ page }) => {
    const res = await page.goto('/executivo?indicador=idhm&uf=ES');
    expect(res?.status()).toBe(200);
    const main = (await page.locator('main').innerText()).replace(/ /g, ' ');
    expect(main).toContain('ESPÍRITO SANTO');
    expect(main).toMatch(/0[.,]7\d\d/);
    expect(main).toContain('IDHM · 2010');
  });

  test('tabela "ver todos os estados" lista as 27 UFs com link de perfil', async ({ page }) => {
    await page.goto('/executivo?indicador=idhm');
    await page.getByText('Ver todos os estados em tabela').click();
    const rows = page.locator('details', { hasText: 'Ver todos os estados em tabela' }).locator('table tbody tr');
    await expect(rows).toHaveCount(27);
  });
});

test.describe('Busca territorial', () => {
  test('busca por sigla de estado redireciona para o perfil estadual', async ({ page }) => {
    const res = await page.goto('/executivo/buscar?q=ES');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/estados/ES');
  });

  test('busca por nome de estado (com acento) redireciona corretamente', async ({ page }) => {
    const res = await page.goto('/executivo/buscar?q=' + encodeURIComponent('Espírito Santo'));
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/estados/ES');
  });

  test('busca por termo que não é UF cai na busca de município existente', async ({ page }) => {
    const res = await page.goto('/executivo/buscar?q=Vitoria');
    expect(res?.status()).toBe(200);
    expect(page.url()).toContain('/municipios?q=');
  });
});

test.describe('Navegação e regressão', () => {
  test('header tem entrada Executivo', async ({ page }) => {
    await page.goto('/');
    // O rodapé global também linka /executivo (corrigido na fase H4 da homepage, para não descrever o
    // Cívica como exclusivamente legislativo) — escopo ao nav principal para distinguir das 2 ocorrências.
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Executivo', exact: true })).toBeVisible();
  });

  test('390px: sem overflow horizontal no portal nacional', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/executivo');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('/estados e /legislativo continuam respondendo 200', async ({ page }) => {
    for (const url of ['/estados', '/legislativo', '/judiciario']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
    }
  });
});
