import { expect, test } from '@playwright/test';

test.describe('busca global e crachá', () => {
  test('"/" abre a busca, digitar "Beto" e Enter chega ao perfil (teclado)', async ({ page }) => {
    await page.goto('/investigar');
    await page.keyboard.press('/');
    const box = page.getByRole('combobox', { name: /Buscar parlamentar/ });
    await expect(box).toBeFocused();
    await box.fill('Beto');
    await expect(page.getByRole('option').first()).toBeVisible();
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/legislativo\/(deputados|senadores)\/\d+/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  });

  test('Esc fecha a busca e termo sem resultado explica', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: /Digite um nome/ }).click();
    await page.getByRole('combobox').fill('zzzzqq');
    await expect(page.getByText(/Nada encontrado/)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('combobox')).toBeHidden();
  });

  test('perfil: crachá com tiles em linguagem simples e "—" para o que não foi publicado', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379');
    const tiles = page.locator('ul.grid-cols-2');
    await expect(tiles.getByText('Quanto custa por mês').first()).toBeVisible();
    await expect(tiles.getByText('Participação nas votações').first()).toBeVisible();
    // A pílula só existe quando falta dado; se existir, leva à explicação (nunca some sem motivo).
    const pill = page.getByRole('link', { name: /Faltam \d+ dados? neste crachá/ });
    if (await pill.count()) { await pill.click(); await expect(page.locator('#faltam-dados')).toBeVisible(); }
    await page.getByRole('button', { name: /O que significa “Subsídio|O que significa “Custo médio/ }).first().click();
    await expect(page.getByRole('note').first()).toBeVisible();
  });

  test('menu: rótulos batem com o destino', async ({ page }) => {
    await page.goto('/');
    const nav = page.getByRole('navigation', { name: 'Navegação principal' });
    await expect(nav.getByRole('link', { name: 'Partidos' })).toHaveAttribute('href', '/legislativo/partidos');
    await nav.getByRole('link', { name: 'Investigar' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Investigar');
  });

  test('gastos: tocar num mês mostra categorias e maiores notas; mês sem registro não é clicável', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379/gastos-equipe');
    const sec = page.locator('section[aria-labelledby=cota-mes]');
    await sec.scrollIntoViewIfNeeded();
    await expect(sec.getByText(/Com o que gastou em \d{4}/)).toBeVisible();
    const month = sec.getByRole('button', { name: /de \d{4}: R\$/ }).first();
    await month.click();
    await expect(month).toHaveAttribute('aria-pressed', 'true');
    await expect(sec.getByText(/Maiores notas da competência/)).toBeVisible();
    await expect(sec.getByRole('button', { name: /sem registro publicado/ }).first()).toBeDisabled();
  });

  test('perfil de senador: nenhum tile mostra NaN/undefined (dado ausente vira "—")', async ({ page }) => {
    await page.goto('/legislativo/senadores/4639');
    await expect(page.locator('ul.grid-cols-2').getByText('Quanto custa por mês').first()).toBeVisible();
    const body = await page.locator('main').innerText();
    expect(body).not.toMatch(/NaN|undefined/);
  });

  test('visão geral: temas tocáveis levam às proposições e há tabela Ano a ano', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379');
    await expect(page.getByRole('table', { name: 'Ano a ano' })).toBeVisible();
    const tema = page.getByRole('link', { name: /propostas?$/ }).first();
    await tema.click();
    await expect(page).toHaveURL(/proposicoes\/explorar\?.*tema=/);
  });

  test('histórico: aparece só onde há dados (atuação), com abas só das séries carregadas', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379/atuacao-parlamentar');
    await expect(page.getByRole('heading', { name: /Como isso mudou/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /Presença/ })).toBeVisible();
    await page.goto('/legislativo/deputados/204379/carreira-politica');
    await expect(page.getByRole('heading', { name: /Como isso mudou/ })).toBeHidden();
  });

  test('abas do perfil trocam sem recarregar, mantêm URL própria e o Voltar funciona', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379');
    await page.evaluate(() => { (window as any).__semReload = true; });
    const nav = page.getByRole('navigation', { name: 'Seções do perfil' });
    await nav.getByRole('link', { name: 'Gastos e equipe' }).click();
    await expect(page).toHaveURL(/\/gastos-equipe$/);
    await expect(page.getByRole('heading', { name: /Quanto custa este mandato/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeHidden();
    await expect(nav.getByRole('link', { name: 'Gastos e equipe' })).toHaveAttribute('aria-current', 'page');
    await page.goBack();
    await expect(page).toHaveURL(/\/legislativo\/deputados\/204379$/);
    await expect(page.getByRole('heading', { name: 'Visão geral' })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__semReload)).toBe(true);
  });

  test('tile do crachá abre a aba certa sem recarregar; a rota direta abre a mesma aba', async ({ page }) => {
    await page.goto('/legislativo/deputados/204379');
    await page.evaluate(() => { (window as any).__semReload = true; });
    await page.getByRole('link', { name: /Ver detalhes/ }).nth(2).click();
    await expect(page).toHaveURL(/atuacao-parlamentar#participacao$/);
    await expect(page.getByRole('heading', { name: /Ele participa/ })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__semReload)).toBe(true);
    await page.goto('/legislativo/deputados/204379/carreira-politica');
    await expect(page.getByRole('heading', { name: 'Carreira política' }).first()).toBeVisible();
    await expect(page.getByRole('heading', { name: /Eleições e patrimônio/ })).toBeVisible();
  });
});
