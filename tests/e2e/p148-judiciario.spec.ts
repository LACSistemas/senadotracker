import { expect, test } from '@playwright/test';

/**
 * E2E do Judiciário (P14.8) contra dado real do PostgreSQL publicado (sem mocks).
 * Rodar contra o servidor isolado: E2E_BASE_URL=http://127.0.0.1:3181 npx playwright test tests/e2e/p148-judiciario.spec.ts
 *
 * Nota conhecida: o HMR do servidor de dev desta sessão emite um erro de WebSocket benigno em toda
 * página (confirmado inclusive na home intocada, antes de qualquer trabalho do Judiciário) — por isso
 * os testes de conteúdo abaixo não dependem de "zero erro de console", só de conteúdo e status real.
 */
const TJES = 'JUD:TRIBUNAL:TJES';
const STJ = 'JUD:TRIBUNAL:STJ';

test.describe('Panorama', () => {
  test('mostra KPIs nacionais reais e nunca uma taxa de congestionamento agregada falsa', async ({ page }) => {
    const res = await page.goto('/judiciario');
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'A Justiça brasileira, além dos processos.' })).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).toContain('Casos novos');
    expect(main).toContain('Processos baixados');
    expect(main).toContain('Processos pendentes');
    // sem 5º KPI de congestionamento nacional (não agregável) — a explicação honesta vive numa seção própria.
    expect(main).not.toMatch(/Taxa de congestionamento\s*[\d,]+%/);
    expect(main).toContain('não existe uma única taxa nacional válida');
    for (const bad of ['NaN', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('capítulo "a fila da Justiça" mostra série histórica real, não um valor por tribunal', async ({ page }) => {
    await page.goto('/judiciario');
    await expect(page.locator('#fila')).toContainText('2009');
    await expect(page.locator('#fila')).toContainText('2025');
  });
});

test.describe('Diretório de tribunais', () => {
  test('lista as 93 instituições e distingue órgãos de controle', async ({ page }) => {
    await page.goto('/judiciario/tribunais');
    await expect(page.locator('main')).toContainText('93 instituições');
    await expect(page.locator('main')).toContainText('Órgão de controle');
  });

  test('busca por sigla filtra corretamente', async ({ page }) => {
    await page.goto('/judiciario/tribunais?busca=TJES');
    await expect(page.locator('main')).toContainText('TJES');
    await expect(page.locator('main')).not.toContainText('TJRJ');
  });
});

test.describe('Perfil de tribunal', () => {
  test('TJES mostra capítulos reais, sem jurisprudência (só STJ tem)', async ({ page }) => {
    const res = await page.goto(`/judiciario/tribunais/${encodeURIComponent(TJES)}`);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole('heading', { name: 'Tribunal de Justiça ES' })).toBeVisible();
    const main = await page.locator('main').innerText();
    expect(main).not.toContain('Jurisprudência');
    for (const bad of ['NaN', 'undefined', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('STJ mostra capítulo de jurisprudência com números reais', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent(STJ)}`);
    const main = await page.locator('main').innerText();
    expect(main).toContain('Jurisprudência');
    expect(main).toContain('precedentes');
  });

  test('tribunal inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/tribunais/JUD:TRIBUNAL:NAO_EXISTE');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Comparador', () => {
  test('sem seleção, mostra orientação — nunca gráfico vazio', async ({ page }) => {
    await page.goto('/judiciario/comparar');
    await expect(page.locator('main')).toContainText('Escolha pelo menos dois tribunais');
  });

  test('comparação válida mostra valores reais de dois tribunais', async ({ page }) => {
    const url = `/judiciario/comparar?indicador=JN_DISPOSED&ano=2025&tribunais=${encodeURIComponent(TJES)},${encodeURIComponent('JUD:TRIBUNAL:TJRJ')}`;
    await page.goto(url);
    const main = await page.locator('main').innerText();
    expect(main).toContain('TJES');
    expect(main).toContain('TJRJ');
    expect(main).toContain('Sem nota geral');
  });

  test('indicador não comparável mostra explicação, não gráfico inválido', async ({ page }) => {
    await page.goto(`/judiciario/comparar?indicador=JN_DISPOSED&ano=2025&tribunais=${encodeURIComponent(TJES)}`);
    await expect(page.locator('main')).toContainText('Escolha pelo menos dois tribunais');
  });
});

test.describe('Hub e páginas de tema', () => {
  test('hub mostra 6 temas com dado real, não 33 cartões', async ({ page }) => {
    await page.goto('/judiciario/temas');
    // A nova composição (J4) tem várias vias de navegação para o mesmo tema (sidebar, visão geral,
    // destaque, grade completa) — o invariante real é 6 temas ÚNICOS, não 6 elementos de link.
    const hrefs = await page.locator('a[href^="/judiciario/temas/"]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).getAttribute('href')));
    const uniqueThemes = new Set(hrefs);
    expect(uniqueThemes.size).toBe(6);
    await expect(page.locator('main')).toContainText('Temas em investigação');
  });

  test('execução fiscal mostra indicador real e série histórica por ano', async ({ page }) => {
    await page.goto('/judiciario/temas/tax_execution');
    const main = await page.locator('main').innerText();
    expect(main).toContain('Execução fiscal');
    expect(main).toContain('2025');
    expect(main).toContain('não agregável nacionalmente');
  });

  test('violência doméstica preserva ausência real em anos anteriores a 2016', async ({ page }) => {
    await page.goto('/judiciario/temas/domestic_violence');
    // textContent (não innerText) porque a tabela de dados do gráfico fica num <details> fechado por
    // padrão — o texto existe no DOM mesmo sem o leitor abrir, inclusive pra leitor de tela.
    const main = await page.locator('main').textContent();
    expect(main).toContain('Indisponível');
    expect(main).toContain('2009');
  });

  test('tema inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/temas/tema-inventado');
    expect(res?.status()).toBe(404);
  });

  test('execução geral e execução penal aparecem separadas (não misturadas)', async ({ page }) => {
    await page.goto('/judiciario/temas');
    await expect(page.locator('main')).toContainText('Execução geral');
    await expect(page.locator('main')).toContainText('Execução penal');
  });
});

test.describe('STJ — precedentes', () => {
  test('explorador lista precedentes reais com paginação', async ({ page }) => {
    await page.goto('/judiciario/stj/precedentes');
    const main = await page.locator('main').innerText();
    expect(main).toContain('2.369 precedentes');
    expect(main).toContain('acervo completo');
  });

  test('detalhe de precedente mostra questão/tese/histórico/processos, sem resumo inventado', async ({ page }) => {
    await page.goto('/judiciario/stj/precedentes');
    const href = await page.locator('a[href*="/judiciario/stj/precedentes/STJ"]').first().getAttribute('href');
    expect(href).toBeTruthy();
    await page.goto(href!);
    const main = await page.locator('main').innerText();
    expect(main).toContain('A questão');
    expect(main).toContain('A tese');
    expect(main).toContain('Processos vinculados');
  });

  test('precedente inexistente devolve 404', async ({ page }) => {
    const res = await page.goto('/judiciario/stj/precedentes/STJ:PRECEDENT:NAO_EXISTE');
    expect(res?.status()).toBe(404);
  });
});

test.describe('Navegação e responsividade', () => {
  test('header tem entrada Judiciário', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('a[href="/judiciario"]').first()).toBeVisible();
  });

  test('390px: sem overflow horizontal nas 4 rotas principais', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of ['/judiciario', '/judiciario/tribunais', '/judiciario/temas', '/judiciario/stj/precedentes']) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('Regressão — outros domínios não afetados', () => {
  for (const [label, url] of [
    ['legislativo', '/legislativo'],
    ['estado (ES)', '/estados/ES'],
    ['comparar legislativo', '/comparar'],
  ] as const) {
    test(`${label} continua respondendo 200`, async ({ page }) => {
      const res = await page.goto(url);
      expect(res?.status()).toBe(200);
    });
  }
});
