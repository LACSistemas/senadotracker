import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';
/** Capturas de tela da experiência de Segurança (desktop e mobile) contra o servidor isolado. Uso: node scripts/security/shots.mjs <base> <saida> <caminho:rotulo>... [--w=1440] [--h=900] [--full] */
const [base, out, ...rest] = process.argv.slice(2); const flags = rest.filter(a => a.startsWith('--')); const items = rest.filter(a => !a.startsWith('--'));
const w = Number((flags.find(f => f.startsWith('--w=')) ?? '--w=1440').slice(4)); const h = Number((flags.find(f => f.startsWith('--h=')) ?? '--h=900').slice(4)); const full = flags.includes('--full');
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }); const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: w < 700 ? 2 : 1, locale: 'pt-BR' });
for (const it of items) { const [path, label] = it.split(':'); const page = await ctx.newPage(); const t = Date.now();
  await page.goto(base + path, { waitUntil: 'networkidle', timeout: 90000 }); await page.waitForTimeout(600);
  const file = `${out}/${label}_${w}.png`; if (flags.includes('--sections')) { for (const id of ['panorama', 'criminalidade', 'estrutura', 'transito', 'prisional', 'financas', 'apreensoes', 'explorar']) { const h0 = await page.$('#' + id); const el = h0 ? (await h0.evaluateHandle(e => e.closest('section') ?? e)).asElement() : null; if (el) { await el.scrollIntoViewIfNeeded(); await page.waitForTimeout(250); await el.screenshot({ path: `${out}/${label}_${id}_${w}.png` }); } } } await page.screenshot({ path: file, fullPage: full }); const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  console.log(JSON.stringify({ label, file, ms: Date.now() - t, horizontalOverflow: overflow, height: await page.evaluate(() => document.documentElement.scrollHeight) })); await page.close(); }
await browser.close();
