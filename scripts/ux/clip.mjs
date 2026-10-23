// Uso: node scripts/ux/clip.mjs <base> <caminho> <seletor-css> <saida.png> [largura]
import { chromium } from 'playwright';
const [base, path, sel, out, w = '1100'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(w), height: 900 } });
await p.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 });
const el = p.locator(sel).first(); console.log('encontrados:', await p.locator(sel).count());
await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: out }); await b.close();
