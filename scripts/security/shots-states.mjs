import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
/** Capturas dos estados de dado e das interações (supressão, composto, lacuna, taxa com faixa de comparação, mobile). Uso: node scripts/security/shots-states.mjs <base> <pasta> */
const [base, out] = process.argv.slice(2); mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' });
async function shot(name, path, w, steps) {
  const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 800 : 900 }, deviceScaleFactor: w < 700 ? 2 : 1, locale: 'pt-BR', hasTouch: w < 700 }); const page = await ctx.newPage();
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 }); await steps(page); await page.waitForTimeout(500);
  const el = await page.$('#criminalidade'); await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(300); await el.screenshot({ path: `${out}/${name}_${w}.png` }); console.log('ok', name); await ctx.close();
}
const pick = (label) => async (p) => { await p.locator('#criminalidade').getByRole('button', { name: new RegExp(label) }).first().click({ timeout: 8000 }).catch(() => console.log('opção não encontrada:', label)); await p.waitForTimeout(900); };
await shot('estado_suprimido_recife_estupro', '/municipios/2611606/seguranca', 1440, pick('^Vítimas de estupro(?! de)'));
await shot('estado_suprimido_saopaulo_estupro', '/municipios/3550308/seguranca', 1440, pick('^Estupros(?! de)'));
await shot('estado_composto_rio_cvli', '/municipios/3304557/seguranca', 1440, pick('Mortes violentas intencionais'));
await shot('estado_lacuna_altorionovo_roubo', '/municipios/3200359/seguranca', 1440, async (p) => { const b = p.locator('#criminalidade').getByRole('button', { name: /Roubo: a pessoa em via pública/ }).first(); if (await b.count()) { await b.click(); await p.waitForTimeout(900); } });
await shot('taxa_com_faixa_vitoria_roubo', '/municipios/3205309/seguranca', 1440, async (p) => { await pick('Roubo: a pessoa em via pública')(p); await p.locator('#criminalidade').getByRole('group', { name: 'Medida' }).getByRole('button', { name: 'Por 100 mil habitantes' }).click(); await p.waitForTimeout(2500); });
await shot('comparar_vitoria_serra', '/municipios/3205309/seguranca', 1440, async (p) => { await pick('Roubo: a pessoa em via pública')(p); await p.locator('#criminalidade').getByRole('group', { name: 'Medida' }).getByRole('button', { name: 'Por 100 mil habitantes' }).click(); await p.waitForTimeout(1500); await p.locator('#criminalidade details summary').filter({ hasText: 'Comparar a taxa' }).click(); await p.waitForTimeout(1200); await p.locator('#criminalidade details').getByRole('button', { name: 'Serra' }).click(); await p.waitForTimeout(2500); });
await shot('mobile_vitoria_criminalidade', '/municipios/3205309/seguranca', 390, async () => undefined);
await shot('mobile_vitoria_criminalidade_taxa', '/municipios/3205309/seguranca', 390, async (p) => { await p.locator('#crime-select').selectOption({ label: 'Homicídios dolosos' }); await p.locator('#criminalidade').getByRole('group', { name: 'Medida' }).getByRole('button', { name: 'Por 100 mil habitantes' }).click(); await p.waitForTimeout(2500); });
await browser.close();
