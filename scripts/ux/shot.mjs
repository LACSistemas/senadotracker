// Uso: node scripts/ux/shot.mjs <baseUrl> <caminho> <saida.png> [largura] [--full]
import { chromium } from 'playwright';
const [base, path, out, width = '1280'] = process.argv.slice(2);
const full = process.argv.includes('--full');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(width), height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
page.on('pageerror', (e) => errors.push(String(e).slice(0, 200)));
const res = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
await page.waitForTimeout(800);
await page.screenshot({ path: out, fullPage: full });
const first = await page.$$eval('a[href*="/legislativo/deputados/"],a[href*="/legislativo/senadores/"]', (as) => as.slice(0, 3).map((a) => a.getAttribute('href')));
console.log(JSON.stringify({ status: res?.status(), errors, first }));
await browser.close();
