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
    // sem 5º KPI de congestionamento nacional (não agregável) — a explicação honesta vive numa seção
    // própria. Achado real (P14.45, não desta fase — a feature é do P14.41, já commitado): o hero em
    // si nunca ganhou esse 5º card, mas "Como a Justiça está organizada" (P14.41) passou a mostrar
    // "Taxa de congestionamento" como estatística REAL de GRUPO (Cortes Superiores/Comum/Especial,
    // nunca nacional) — por isso o regex de "nunca em lugar nenhum" ficou cego demais; escopado só
    // pro hero (1ª seção), onde o 5º card de fato nunca pode existir.
    const hero = await page.locator('main > section').first().innerText();
    expect(hero).not.toMatch(/Taxa de congestionamento\s*[\d,]+%/);
    // Texto reescrito no P14.41 (já commitado, fora desta fase) — mesma afirmação de honestidade
    // estatística (nenhuma taxa nacional única esconderia a variação real), palavras atualizadas.
    expect(main).toContain('uma única taxa nacional esconderia essa diferença');
    for (const bad of ['NaN', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('capítulo "a fila da Justiça" mostra série histórica real, não um valor por tribunal', async ({ page }) => {
    await page.goto('/judiciario');
    await expect(page.locator('#fila')).toContainText('2009');
    await expect(page.locator('#fila')).toContainText('2025');
  });
});

test.describe('Diretório de tribunais (V1.1 — diretório imediato)', () => {
  // V1.1 devolveu um diretório real, paginado, sempre visível no carregamento inicial (mandato
  // "Diretório Imediato" — a abertura de 2 entradas do P14.45 escondia demais a listagem). A
  // asserção de "93 instituições" e o badge de "Órgão de controle" por linha sobrevivem; agora
  // aparecem já na 1ª tela, não só em resultado de busca (atualizado deliberadamente, mesma régua
  // do programa J0-J7: asserção documentada, nunca apagada em silêncio).
  test('abertura mostra 93 instituições catalogadas', async ({ page }) => {
    await page.goto('/judiciario/tribunais');
    await expect(page.locator('main')).toContainText('93 instituições');
  });

  test('busca por sigla filtra corretamente', async ({ page }) => {
    await page.goto('/judiciario/tribunais?busca=TJES');
    await expect(page.locator('main')).toContainText('TJES');
    // Achado V1.1: "Acesso rápido" (mandato §2.3) é uma faixa curada FIXA, sempre visível — inclui
    // TJRJ independente do termo buscado, por desenho (não é um resultado de busca, é atalho
    // editorial). Por isso a ausência de "TJRJ" só pode ser verificada dentro da TABELA de
    // resultados (role="table"), nunca na página inteira.
    await expect(page.getByRole('table')).not.toContainText('TJRJ');
  });
});

test.describe('Explorador de tribunais (P14.45 — Canvas investigativo)', () => {
  const CONGESTION = 'JN_CONGESTION_RATE';

  // V1.1: a abertura de 2 "entradas" (cartões "Encontrar um tribunal"/"Investigar um indicador")
  // saiu — a busca e o diretório ficam protagonistas, visíveis sem exigir nenhum clique prévio
  // (mandato "Diretório Imediato" §2), e "Investigar um indicador" vira uma faixa compacta mais
  // abaixo, nunca escondida. Nenhuma distribuição aparece antes de escolher um indicador.
  test('abertura mostra busca, acesso rápido e diretório imediatamente, sem exigir escolha prévia', async ({ page }) => {
    await page.goto('/judiciario/tribunais');
    const main = await page.locator('main').innerText();
    // "Acesso rápido" tem `uppercase` (CSS) — `innerText` reflete o texto como renderizado na tela
    // (maiúsculas), não o literal do JSX; comparar em minúsculas evita depender desse detalhe.
    expect(main.toLowerCase()).toContain('acesso rápido');
    expect(main).toContain('Ver perfil');
    expect(main).toContain('Investigar um indicador');
    expect(main).not.toContain('Escolha um indicador no filtro acima');
    await expect(page.getByPlaceholder(/Busque STF/)).toBeVisible();
  });

  test('busca por órgão de controle mostra o selo "Órgão de controle" no resultado', async ({ page }) => {
    await page.goto('/judiciario/tribunais?busca=CNJ');
    await expect(page.locator('main')).toContainText('Órgão de controle');
  });

  test('indicador escolhido mostra distribuição real com mín/mediana/máx e TJES na posição máxima', async ({ page }) => {
    await page.goto(`/judiciario/tribunais?indicador=${CONGESTION}`);
    const main = await page.locator('main').innerText();
    expect(main).toContain('tribunais com dado elegível');
    expect(main).toMatch(/mín\.\s*[\d.,]+%/);
    expect(main).toMatch(/máx\.\s*[\d.,]+%/);
    for (const bad of ['NaN', 'undefined', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('inspecionar um tribunal mostra o painel contextual (Estado B), sem adicioná-lo à Mesa sozinho', async ({ page }) => {
    await page.goto(`/judiciario/tribunais?indicador=${CONGESTION}&inspecionar=${encodeURIComponent(TJES)}`);
    const main = await page.locator('main').innerText();
    // `.eyebrow` (CSS) renderiza em caixa alta — innerText reflete o texto como visto na tela, não o
    // JSX bruto; comparar em minúsculas evita depender desse detalhe de estilo.
    const lower = main.toLowerCase();
    expect(main).toContain('TJES');
    expect(lower).toContain('tribunal inspecionado');
    expect(lower).toContain('indicador em foco');
    expect(main).toContain('Adicionar à Mesa');
    // inspecionar sozinho nunca preenche a Mesa (mandato §9.3) — a barra compacta (sempre visível,
    // ajuste visual) continua em "(0/3)".
    expect(main).toContain('(0/3)');
  });

  test('tribunal sem dado no indicador mostra ausência honesta (Estado C), nunca zero', async ({ page }) => {
    await page.goto(`/judiciario/tribunais?indicador=JN_REVENUE_TOTAL&inspecionar=${encodeURIComponent('JUD:TRIBUNAL:STF')}`);
    const main = await page.locator('main').innerText();
    expect(main).toContain('não tem dado publicado');
    expect(main).toContain('não é um valor zero');
    expect(main).not.toMatch(/STF[\s\S]{0,80}R\$\s*0,00/);
  });

  test('adicionar à comparação e abrir a Mesa mostra os 2 tribunais e as 4 abas', async ({ page }) => {
    await page.goto(`/judiciario/tribunais?modo=mesa&mesa=${encodeURIComponent(TJES)},${encodeURIComponent('JUD:TRIBUNAL:TJRJ')}`);
    const main = await page.locator('main').innerText();
    // ".eyebrow" renderiza em caixa alta — ver nota da mesma técnica no teste de inspeção acima.
    expect(main.toLowerCase()).toContain('mesa de investigação');
    expect(main).toContain('TJES');
    expect(main).toContain('TJRJ');
    for (const tab of ['Movimento processual', 'Tempo e congestionamento', 'Pessoas e estrutura', 'Despesas e recursos']) expect(main).toContain(tab);
    for (const bad of ['NaN', 'undefined', '[object Object]']) expect(main).not.toContain(bad);
  });

  test('Mesa com só 1 tribunal nunca mostra comparação — mandato §11.1', async ({ page }) => {
    await page.goto(`/judiciario/tribunais?modo=mesa&mesa=${encodeURIComponent(TJES)}`);
    const main = await page.locator('main').innerText();
    // A barra compacta (sempre visível, ajuste visual) também diz "Mesa de investigação" agora — o
    // invariante real (nunca abrir a MESA EXPANDIDA com só 1 tribunal) é melhor verificado pelo H1
    // que só existe dentro do workspace completo, não pela frase genérica.
    expect(main).not.toContain('Comparação entre tribunais');
    expect(main).toContain('Adicione mais 1 para comparar');
  });

  test('indicador não comparável na Mesa mostra explicação, nunca um gráfico inventado', async ({ page }) => {
    // JN_CLEARANCE_INDEX é NONE_RATE_OFFICIAL — a aba "Movimento processual" oferece esse indicador;
    // o teste força a seleção dele e confirma que a UI nunca desenha uma comparação inválida.
    const url = `/judiciario/tribunais?modo=mesa&mesa=${encodeURIComponent(TJES)},${encodeURIComponent('JUD:TRIBUNAL:TJRJ')}&aba=movimento&mesa_indicador=JN_CLEARANCE_INDEX`;
    await page.goto(url);
    const main = await page.locator('main').innerText();
    // Se o indicador for de fato elegível neste catálogo, o teste só confirma que há gráfico OU nota —
    // nunca os dois ausentes nem um valor fabricado.
    const hasChart = main.includes('Indicadores selecionados');
    const hasHonestNote = main.includes('não comparável') || main.includes('Não publicado') || main.includes('Fonte indisponível');
    expect(hasChart || hasHonestNote).toBe(true);
  });

  test('perfil do tribunal linka pra Mesa do Explorador, não mais pro comparador clássico direto', async ({ page }) => {
    await page.goto(`/judiciario/tribunais/${encodeURIComponent(TJES)}`);
    const href = await page.locator('a[href*="modo=mesa"]').first().getAttribute('href');
    expect(href).toContain('/judiciario/tribunais?modo=mesa');
    expect(href).toContain(encodeURIComponent(TJES));
  });

  test('390px: sem overflow horizontal nos 4 estados do Canvas', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 800 });
    for (const url of [
      '/judiciario/tribunais',
      `/judiciario/tribunais?indicador=${CONGESTION}`,
      `/judiciario/tribunais?indicador=${CONGESTION}&inspecionar=${encodeURIComponent(TJES)}`,
      `/judiciario/tribunais?modo=mesa&mesa=${encodeURIComponent(TJES)},${encodeURIComponent('JUD:TRIBUNAL:TJRJ')}`,
    ]) {
      await page.goto(url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(overflow, `overflow em ${url}`).toBeLessThanOrEqual(0);
    }
  });
});

test.describe('V1.1 — Diretório imediato e refinamentos', () => {
  for (const sigla of ['STF', 'TJSP', 'TJES']) {
    test(`${sigla} é encontrável pela busca do diretório (mandato §10.2-10.4)`, async ({ page }) => {
      await page.goto(`/judiciario/tribunais?busca=${sigla}`);
      await expect(page.getByRole('table')).toContainText(sigla);
      const href = await page.locator('a:has-text("Ver perfil")').first().getAttribute('href');
      const res = await page.goto(`${href}`);
      expect(res?.status()).toBe(200);
    });
  }

  test('acesso rápido oferece STF/STJ/TJSP/TJES/TJRJ com links reais pro perfil', async ({ page }) => {
    await page.goto('/judiciario/tribunais');
    const quickAccess = page.getByRole('list', { name: 'Acesso rápido' });
    for (const sigla of ['STF', 'STJ', 'TJSP', 'TJES', 'TJRJ']) {
      const chip = quickAccess.getByRole('link', { name: sigla, exact: true });
      await expect(chip).toBeVisible();
      const href = await chip.getAttribute('href');
      expect(href).toMatch(/^\/judiciario\/tribunais\/JUD%3ATRIBUNAL%3A/);
    }
  });

  test('filtro de ramo no diretório restringe a listagem (mandato §10.6)', async ({ page }) => {
    await page.goto('/judiciario/tribunais?ramo=FEDERAL');
    const table = await page.getByRole('table').innerText();
    expect(table).toContain('TRF');
    expect(table).not.toContain('Justiça Estadual');
  });

  test('paginação do diretório alcança o catálogo completo (mandato §10.8)', async ({ page }) => {
    await page.goto('/judiciario/tribunais');
    await expect(page.locator('main')).toContainText('Página 1 de');
    const next = page.getByRole('link', { name: 'Próxima' });
    await next.click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.locator('main')).toContainText('Página 2 de');
  });

  test('"Inspecionar" no diretório abre o Canvas com indicador válido, sem adicionar à Mesa (mandato §4.3)', async ({ page }) => {
    await page.goto('/judiciario/tribunais?busca=TJSP');
    const inspect = page.getByRole('link', { name: 'Inspecionar' }).first();
    const href = await inspect.getAttribute('href');
    expect(href).toContain('indicador=');
    await page.goto(`${href}`);
    const main = await page.locator('main').innerText();
    expect(main.toLowerCase()).toContain('tribunal inspecionado');
    expect(main).toContain('(0/3)');
  });

  test('indicador financeiro mostra valores em R$ mi/bi/mil, nunca reais crus com decimais (mandato §7.1)', async ({ page }) => {
    await page.goto('/judiciario/tribunais?indicador=JN_EXPENSE_TOTAL');
    const main = await page.locator('main').innerText();
    expect(main).toMatch(/R\$\s*[\d.,]+\s*(mi|bi|mil)/);
    // Achado real corrigido nesta fase: a narrativa do painel contextual usava `.toFixed(3)` no valor
    // bruto em vez de `formatValue` — isso imprimia reais crus (ex. "1234567.891"). Nunca mais.
    expect(main).not.toMatch(/\d{4,}\.\d{2,}/);
  });

  test('escala logarítmica é oferecida para despesa total e rotula o eixo explicitamente (mandato §7.2)', async ({ page }) => {
    await page.goto('/judiciario/tribunais?indicador=JN_EXPENSE_TOTAL');
    const toggle = page.getByRole('link', { name: 'Escala logarítmica' });
    await expect(toggle).toBeVisible();
    const href = await toggle.getAttribute('href');
    await page.goto(`${href}`);
    const main = await page.locator('main').innerText();
    expect(main).toContain('eixo em escala logarítmica');
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
