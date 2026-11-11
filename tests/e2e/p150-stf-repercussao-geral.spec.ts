import { expect, test } from '@playwright/test';

/**
 * E2E da Repercussão Geral do STF (P14.9) contra dado real coletado nesta fase (sem mocks).
 * Rodar contra o servidor isolado: E2E_BASE_URL=http://127.0.0.1:3181 npx playwright test tests/e2e/p150-stf-repercussao-geral.spec.ts
 */
test.describe('Explorador de temas do STF', () => {
  test('lista temas reais com paginação', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/temas');
    expect(res?.status()).toBe(200);
    const main = await page.locator('main').innerText();
    expect(main).toContain('1.498 temas');
    expect(main).toContain('Repercussão Geral');
    for (const bad of ['NaN', 'undefined', 'Infinity', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('filtro por situação funciona', async ({ page }) => {
    await page.goto('/judiciario/stf/temas?situacao=Cancelado');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Cancelado');
  });
});

test.describe('Detalhe de tema do STF', () => {
  test('tema real mostra questão, tese e histórico, sem resumo inventado', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/temas/1055');
    expect(res?.status()).toBe(200);
    const main = await page.locator('main').innerText();
    expect(main).toContain('A questão');
    expect(main).toContain('A tese');
    expect(main).toContain('Responsabilidade');
    expect(main).toContain('MIN. MARCO AURÉLIO');
  });

  test('tema inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/stf/temas/999999');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Perfil do STF integra jurisprudência', () => {
  test('perfil do STF mostra capítulo de jurisprudência com temas reais', async ({ page }) => {
    await page.goto('/judiciario/tribunais/JUD:TRIBUNAL:STF');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Jurisprudência');
    expect(main).toContain('Repercussão Geral');
    expect(main).toContain('Ver todos os temas');
  });

  test('perfil do TJES não mostra jurisprudência do STF nem do STJ', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent('JUD:TRIBUNAL:TJES')}`);
    const main = await page.locator('main').innerText();
    expect(main).not.toContain('Jurisprudência');
  });
});

test.describe('Despesa com magistrados (indicador novo)', () => {
  test('panorama mostra despesa nacional com magistrados real', async ({ page }) => {
    await page.goto('/judiciario');
    // Intl.NumberFormat de moeda usa espaço NÃO separável ( ) entre "R$" e o número — normalizado aqui.
    const main = (await page.locator('main').innerText()).replace(/ /g, ' ');
    expect(main).toContain('Despesa com magistrados');
    expect(main).toContain('R$ 34,5 bi');
  });

  test('perfil de tribunal mostra despesa com magistrados própria, não a nacional', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent('JUD:TRIBUNAL:TJES')}`);
    const main = (await page.locator('main').innerText()).replace(/ /g, ' ');
    expect(main).toContain('Despesa com magistrados');
    expect(main).toContain('R$ 463.922.469');
  });
});

test.describe('Navegação e regressão', () => {
  test('390px: sem overflow horizontal no explorador e no detalhe do STF', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ['/judiciario/stf/temas', '/judiciario/stf/temas/1055']) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0);
    }
  });

  test('panorama, diretório e temas gerais continuam respondendo 200', async ({ page }) => {
    for (const url of ['/judiciario', '/judiciario/tribunais', '/judiciario/temas', '/judiciario/comparar']) {
      const res = await page.goto(url);
      expect(res?.status(), url).toBe(200);
    }
  });
});
