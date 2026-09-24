import { expect, test } from '@playwright/test';
test('busca preserva filtros, abre perfil e expõe a fonte oficial', async ({ page }) => {
  await page.goto('/legislativo?casa=senado&uf=AC&partido=REPUBLICANOS&busca=Alan');
  await expect(page.getByRole('heading', { name: 'Congresso em números' })).toBeVisible();
  // Casa é seletor de pills (`<a>`), não `<select>`: o pill ativo carrega o destaque visual.
  await expect(page.getByRole('link', { name: 'Senado', exact: true })).toHaveClass(/bg-primary/);
  await expect(page.getByRole('combobox', { name: 'Estado' })).toHaveValue('AC');
  await expect(page.getByRole('combobox', { name: 'Partido' })).toHaveValue('REPUBLICANOS');
  await expect(page.getByRole('searchbox', { name: 'Buscar' })).toHaveValue('Alan');
  await page.getByRole('link', { name: /Alan Rick/ }).click();
  await expect(page).toHaveURL(/\/legislativo\/senadores\/5672$/);
  await expect(page.getByRole('heading', { name: 'Alan Rick', level: 1 })).toBeVisible();
  await expect(page.getByText(/SHA-256/)).toBeVisible();
  // A lede é a manchete gerada do dado e precisa existir nas quatro rotas de seção.
  await expect(page.getByText(/maior que .* dos senadores|nenhum dos .* senadores registra/).first()).toBeVisible();
  // "Quanto custa este mandato?" é seção própria, na rota de gastos — não na visão geral.
  await page.goto('/legislativo/senadores/5672/gastos-equipe');
  await expect(page.getByRole('heading', { name: 'Quanto custa este mandato?' })).toBeVisible();
  await expect(page.getByText(/encargos patronais não publicados permanecem fora/)).toBeVisible();
});
test('home apresenta somente a entrada legislativa e abre o panorama', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Entenda quem representa você. Pelos dados.' })).toBeVisible();
  await expect(page.getByText('Poder Judiciário')).toHaveCount(0);
  await expect(page.getByText('Judiciário — em breve')).toBeVisible();
  await expect(page.getByText(/custo mensal mediano por deputado/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Extremos observados no período' })).toBeVisible();
  await Promise.all([
    page.waitForURL('/legislativo'),
    page.getByRole('link', { name: /Explorar Legislativo/ }).click(),
  ]);
  await expect(page.getByRole('heading', { name: /Entenda quem te representa/ })).toBeVisible();
});
test('teclado alcança o conteúdo e viewport mobile não tem rolagem horizontal', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Pular para o conteúdo' })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('#conteudo')).toBeFocused();
  const widths = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, content: document.documentElement.scrollWidth }));
  expect(widths.content).toBeLessThanOrEqual(widths.viewport);
  await expect(page.getByText('Menu', { exact: true })).toBeVisible();
});
test('perfil inexistente usa 404 e metodologia é acessível pela navegação', async ({ page }) => {
  const response = await page.goto('/parlamentares/senado/999999');
  expect(response?.status()).toBe(404);
  await page.goto('/');
  await page.getByRole('link', { name: 'Metodologia', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Precisão é mostrar o que sabemos/ })).toBeVisible();
});
test('comparação mantém Casa, ano e métrica explícitos', async ({ page }) => {
  await page.goto('/comparar?casa=senado&ano=2026&pessoas=5672,5525&metrica=expenses');
  await expect(page.getByRole('heading', { name: 'Compare representantes, partidos e estados' })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Casa' })).toHaveValue('senado');
  await expect(page.getByRole('combobox', { name: 'Ano' })).toHaveValue('2026');
  await expect(page.getByText('Nenhuma nota geral é calculada.')).toBeVisible();
  // Small multiples: painéis independentes ficam todos visíveis na mesma página, sem troca por `?metrica=`.
  await expect(page.getByRole('heading', { name: 'Gabinete' })).toBeVisible();
  await expect(page.getByText('Presença em sessões elegíveis')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Quem vota com quem?' })).toBeVisible();
});
test('catálogo expõe componentes, estados e alternativa móvel', async ({ page }) => {
  await page.goto('/design-system');
  await expect(page.getByRole('heading', { name: 'Sistema visual legislativo' })).toBeVisible();
  await expect(page.getByText('Indisponível', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('figure', { name: /Série com lacuna/ })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('list', { name: 'Parlamentares de exemplo' })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  expect(overflow).toBeFalsy();
});
test('listagens por Casa compartilham estrutura e distinguem cobertura de gabinete', async ({ page }) => {
  await page.goto('/legislativo/senadores?ordem=expense_desc');
  await expect(page.getByRole('heading', { name: 'Senado Federal', level: 1 })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Navegação do Legislativo' }).getByRole('link', { name: 'Senadores' })).toHaveAttribute('aria-current', 'page');
  await page.goto('/legislativo/deputados');
  await expect(page.getByRole('heading', { name: 'Deputados federais', level: 1 })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Metodologia' })).toHaveAttribute('href', '/metodologia');
});
test('perfil unificado preserva rota antiga, seções e canonical por Casa', async ({ page }) => {
  await page.goto('/parlamentares/senado/5672');
  await expect(page).toHaveURL('/legislativo/senadores/5672');
  await page.goto('/legislativo/senadores/5672/atuacao-parlamentar');
  await expect(page.getByRole('heading', { name: 'Ele participa?' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Logo do partido/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como votou?' })).toBeVisible();
  // Canonical é por seção, não colapsa para a visão geral: cada rota do perfil aponta para si mesma.
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', '/legislativo/senadores/5672/atuacao-parlamentar');
  // "Eleições e patrimônio" e as abas históricas são seção própria, na rota de carreira — não na de atuação.
  await page.goto('/legislativo/senadores/5672/carreira-politica');
  await expect(page.getByRole('heading', { name: 'Eleições e patrimônio' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Como isso mudou ao longo do tempo?' })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', '/legislativo/senadores/5672/carreira-politica');
  await page.goto('/legislativo/deputados/204549');
  await expect(page.getByRole('heading', { name: 'AJ Albuquerque', level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/legislativo\/deputados\/204549$/);
});
test('partidos distinguem Casas, filiação temporal e votos registrados', async ({ page }) => {
  await page.goto('/legislativo/partidos?casa=senado');
  await expect(page.getByRole('heading', { name: 'Partidos no Congresso', level: 1 })).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Casa' })).toHaveValue('senado');
  await expect(page.getByRole('heading', { name: 'Atuação legislativa dos partidos' })).toBeVisible();
  await expect(page.getByRole('img', { name: /Logo do partido/ }).first()).toBeVisible();
});
test('representação exige UF, separa Casas e compara universos compatíveis', async ({ page }) => {
  await page.goto('/quem-me-representa');
  await expect(page.getByRole('heading', { name: 'Quem me representa?', level: 1 })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Escolha seu estado no mapa' })).toBeVisible();
  await expect(page.getByText(/busca por cidade não é inferida/)).toBeVisible();
  await page.goto('/quem-me-representa?uf=AC&comparar=SP');
  await expect(page.getByRole('heading', { name: 'Acre no Congresso' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Senadores de Acre' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Deputados federais de Acre' })).toBeVisible();
  await expect(page.getByRole('table', { name: 'Comparação entre estados' })).toBeVisible();
  await expect(page.getByText(/sem observações compatíveis são omitidas/)).toBeVisible();
});
test('rotas legislativas preservam layout em 390 px e desktop largo', async ({ page }) => {
  test.setTimeout(120_000);
  const routes=['/legislativo','/legislativo/senadores','/legislativo/deputados','/legislativo/partidos?casa=senado','/quem-me-representa?uf=AC','/comparar?casa=senado&ano=2026&pessoas=5672,5525&metrica=expenses','/legislativo/senadores/5672'];
  for(const width of [390,1920])for(const route of routes){
    await page.setViewportSize({width,height:900});
    await page.goto(route,{waitUntil:'domcontentloaded'});
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,content:document.documentElement.scrollWidth}));
    expect(dimensions.content,`${route} em ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.goto('/legislativo/senadores');
  const hero=page.locator('main section').first().locator('img').first();
  await expect(hero).toHaveAttribute('data-nimg','fill');
  const box=await hero.boundingBox();
  expect(box?.width).toBeGreaterThan(0);
  expect(box?.height).toBeGreaterThan(0);
});