import { expect, test } from '@playwright/test';

/**
 * E2E da jurisprudência geral do STF (P14.11: acórdãos + decisões monocráticas, 1892-2026) contra dado
 * real coletado nesta fase (sem mocks) — 372.726 acórdãos e 759.761 decisões monocráticas.
 */
test.describe('Explorador de jurisprudência do STF', () => {
  test('mostra totais reais e o ranking de casos por relator', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/jurisprudencia');
    expect(res?.status()).toBe(200);
    const main = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(main).toContain('372.726');
    expect(main).toContain('759.761');
    expect(main).toContain('1892');
    expect(main).toContain('Casos por relator');
    expect(main).toContain('MARCO AURÉLIO');
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('troca de base mostra decisões monocráticas', async ({ page }) => {
    await page.goto('/judiciario/stf/jurisprudencia?base=decisao');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Decisões monocráticas');
  });

  test('filtro por relator restringe a listagem e mostra como limpar', async ({ page }) => {
    await page.goto('/judiciario/stf/jurisprudencia?relator=MARCO+AUR%C3%89LIO');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Filtrando por relator');
    expect(main).toContain('MARCO AURÉLIO');
    expect(main).toContain('limpar');
  });

  test('busca textual real retorna resultados sem erro', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/jurisprudencia?q=ADI');
    expect(res?.status()).toBe(200);
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/ADI \d/);
  });
});

test.describe('Detalhe de acórdão/decisão do STF', () => {
  test('acórdão real mostra ementa e links para a fonte oficial', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/jurisprudencia/acordao/sjur574922');
    expect(res?.status()).toBe(200);
    const main = (await page.locator('main').innerText()).replace(/\s+/g, ' ');
    expect(main).toContain('ADO 13');
    expect(main).toContain('MARCO AURÉLIO');
    expect(main).toContain('Ementa');
    expect(main).toContain('Inteiro teor (STF)');
  });

  test('documento inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/jurisprudencia/acordao/nope-does-not-exist');
    expect(res?.status()).toBe(404);
  });

  test('base inválida na URL devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/jurisprudencia/invalidbase/sjur574922');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Integração no perfil do STF', () => {
  test('perfil do STF mostra o bloco de jurisprudência geral com números reais', async ({ page }) => {
    await page.goto('/judiciario/tribunais/JUD:TRIBUNAL:STF');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Acórdãos e decisões monocráticas');
    expect(main).toContain('372.726');
    expect(main).toContain('Buscar acórdãos e decisões');
  });

  test('perfil do TJES não mostra o bloco de jurisprudência geral (escopo só STF)', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent('JUD:TRIBUNAL:TJES')}`);
    const main = await page.locator('main').innerText();
    expect(main).not.toContain('Acórdãos e decisões monocráticas');
  });
});

test.describe('Navegação e regressão', () => {
  test('390px: sem overflow horizontal no explorador e no detalhe', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ['/judiciario/stf/jurisprudencia', '/judiciario/stf/jurisprudencia/acordao/sjur574922']) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0);
    }
  });

  test('STF temas, remuneração e panorama continuam respondendo 200', async ({ page }) => {
    for (const url of ['/judiciario', '/judiciario/stf/temas', '/judiciario/stf/remuneracao', '/judiciario/tribunais/JUD:TRIBUNAL:STF']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
    }
  });
});
