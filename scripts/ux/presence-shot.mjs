import { chromium } from 'playwright';
const [base, id, year, out, w = '1100'] = process.argv.slice(2);
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: Number(w), height: 900 } });
await p.goto(`${base}/legislativo/deputados/${id}/atuacao-parlamentar`, { waitUntil: 'networkidle', timeout: 180000 });
const sec = p.locator('section[aria-labelledby=presenca-calendario]'); await sec.scrollIntoViewIfNeeded();
if (year) await sec.getByRole('button', { name: new RegExp('^' + year) }).click();
await sec.locator('button[data-iso]').nth(5).hover(); await p.waitForTimeout(300);
await sec.screenshot({ path: out }); await b.close();
