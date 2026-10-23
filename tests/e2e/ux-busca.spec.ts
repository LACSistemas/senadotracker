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
});
