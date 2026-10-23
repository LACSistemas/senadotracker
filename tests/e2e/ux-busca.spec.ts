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
    await expect(page.getByText('Quanto custa por mês').first()).toBeVisible();
    await expect(page.getByText('Participação nas votações').first()).toBeVisible();
    await expect(page.getByRole('link', { name: /Faltam \d+ dados? neste crachá/ })).toBeVisible();
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
});
