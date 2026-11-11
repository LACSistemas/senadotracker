import { expect, test } from '@playwright/test';

/**
 * E2E da remuneração de Ministros/Assessores do STF (P14.10) contra dado real coletado nesta fase
 * (sem mocks). Rodar contra o servidor isolado:
 * E2E_BASE_URL=http://127.0.0.1:3181 npx playwright test tests/e2e/p151-stf-remuneracao.spec.ts
 */
test.describe('Explorador de remuneração do STF', () => {
  test('lista Ministros e Assessores reais, com soma e referência', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/remuneracao');
    expect(res?.status()).toBe(200);
    const main = (await page.locator('main').innerText()).replace(/ /g, ' ');
    expect(main).toContain('Ministros (ativos e aposentados)');
    expect(main).toContain('Assessores de Ministro');
    expect(main).toContain('Alexandre de Moraes');
    expect(main).toContain('EM ATIVIDADE');
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);
    const photoCount = await page.locator('main img[alt^="Foto oficial de"]').count();
    expect(photoCount).toBeGreaterThan(0);
  });

  test('filtro por cargo mostra só Ministros', async ({ page }) => {
    await page.goto('/judiciario/stf/remuneracao?cargo=ministro');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Alexandre de Moraes');
    // "Assessores de Ministro" ainda aparece como rótulo fixo do filtro e dos KPIs — a garantia real de
    // que o filtro funcionou é a ausência do NOME de um assessor real (P14.10) nas linhas de dado.
    expect(main).not.toContain('ALDO JOSÉ BARROS BARATA DE OLIVEIRA');
  });
});

test.describe('Detalhe de remuneração do STF', () => {
  test('ministro real mostra foto, nome de exibição e rubricas oficiais com valores, não um resumo inventado', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/remuneracao/58');
    expect(res?.status()).toBe(200);
    const main = (await page.locator('main').innerText()).replace(/ /g, ' ');
    expect(main).toContain('Alexandre de Moraes');
    expect(main).toContain('Vencimentos / Subsídios');
    expect(main).toContain('Imposto de Renda');
    expect(main).toContain('R$ 46.366,19');
    await expect(page.locator('main img[alt="Foto oficial de Alexandre de Moraes"]')).toBeVisible();
  });

  test('matrícula inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/remuneracao/99999999');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Integração no perfil do STF', () => {
  test('perfil do STF mostra capítulo de Ministros com fotos e remuneração reais', async ({ page }) => {
    await page.goto('/judiciario/tribunais/JUD:TRIBUNAL:STF');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Ministros em atividade');
    expect(main).toContain('Alexandre de Moraes');
    expect(main).toContain('Ver remuneração completa');
    const photoCount = await page.locator('main img[alt^="Foto oficial de"]').count();
    expect(photoCount).toBeGreaterThan(0);
  });

  test('perfil do TJES não mostra capítulo de Ministros (escopo só STF)', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent('JUD:TRIBUNAL:TJES')}`);
    const main = await page.locator('main').innerText();
    expect(main).not.toContain('Ministros em atividade');
    expect(main).not.toContain('Soma bruta mensal');
  });
});

test.describe('Navegação e regressão', () => {
  test('390px: sem overflow horizontal no explorador e no detalhe de remuneração', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ['/judiciario/stf/remuneracao', '/judiciario/stf/remuneracao/58']) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0);
    }
  });

  test('STF temas e panorama continuam respondendo 200', async ({ page }) => {
    for (const url of ['/judiciario', '/judiciario/stf/temas', '/judiciario/tribunais/JUD:TRIBUNAL:STF']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
    }
  });
});
