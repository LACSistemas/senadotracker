import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
/**
 * Validação em navegador real da experiência de Segurança contra o servidor isolado:
 * status, erros de console, textos proibidos (NaN/undefined/null), capítulos presentes, overflow horizontal em 5 larguras, alvos de toque, tempos e bytes de rede.
 * Uso: node scripts/security/validate-pages.mjs <base> <saida.json> [--shots=<pasta>]
 */
const [base, out, ...flags] = process.argv.slice(2); const shotsDir = flags.find(f => f.startsWith('--shots='))?.slice(8);
const TERR = [
  ['municipio', '3205309', 'Vitória/ES'], ['municipio', '3205002', 'Serra/ES'], ['municipio', '3200359', 'Alto Rio Novo/ES'], ['municipio', '3550308', 'São Paulo/SP'], ['municipio', '3304557', 'Rio de Janeiro/RJ'],
  ['municipio', '3106200', 'Belo Horizonte/MG'], ['municipio', '2611606', 'Recife/PE'], ['municipio', '4314902', 'Porto Alegre/RS'], ['municipio', '2927408', 'Salvador/BA'], ['municipio', '4106902', 'Curitiba/PR'],
  ['uf', 'ES', 'ES'], ['uf', 'SP', 'SP'], ['uf', 'RJ', 'RJ'], ['uf', 'MG', 'MG'], ['uf', 'PE', 'PE'], ['uf', 'CE', 'CE'], ['uf', 'BA', 'BA'],
];
const WIDTHS = [1440, 1280, 768, 390, 360]; const CHAPTERS = ['panorama', 'criminalidade', 'estrutura', 'transito', 'prisional', 'financas', 'apreensoes', 'explorar'];
if (shotsDir) mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome' }); const results = [];
for (const [kind, code, label] of TERR) {
  const path = kind === 'uf' ? `/estados/${code}/seguranca` : `/municipios/${code}/seguranca`; const rec = { label, path, widths: {}, errors: [], forbidden: [], chapters: {}, kpis: 0 };
  for (const w of WIDTHS) {
    const ctx = await browser.newContext({ viewport: { width: w, height: w < 700 ? 800 : 900 }, deviceScaleFactor: w < 700 ? 2 : 1, locale: 'pt-BR', hasTouch: w < 700 }); const page = await ctx.newPage(); let bytes = 0, reqs = 0, jsBytes = 0;
    page.on('response', async r => { try { const len = Number(r.headers()['content-length'] ?? 0); bytes += len; reqs++; if ((r.headers()['content-type'] ?? '').includes('javascript')) jsBytes += len; } catch { /* ignore */ } });
    page.on('console', m => { if (m.type() === 'error') rec.errors.push(`[${w}] ${m.text().slice(0, 160)}`); }); page.on('pageerror', e => rec.errors.push(`[${w}] pageerror ${String(e).slice(0, 160)}`));
    const t = Date.now(); const resp = await page.goto(base + path, { waitUntil: 'networkidle', timeout: 120000 }); const loadMs = Date.now() - t; await page.waitForTimeout(400);
    const info = await page.evaluate(ids => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, text: document.body.innerText, chapters: Object.fromEntries(ids.map(id => [id, !!document.getElementById(id)])), h: document.documentElement.scrollHeight, kpis: document.querySelectorAll('[id^="kpi-"]').length,
      smallTargets: [...document.querySelectorAll('button, a[href], select, input')].filter(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && (r.height < 24 || r.width < 24) && getComputedStyle(e).visibility !== 'hidden'; }).length }), CHAPTERS);
    rec.widths[w] = { status: resp?.status(), loadMs, overflowPx: info.overflow, height: info.h, networkKB: Math.round(bytes / 1024), jsKB: Math.round(jsBytes / 1024), requests: reqs, targetsBelow24px: info.smallTargets };
    if (w === 1440) { rec.chapters = info.chapters; rec.kpis = info.kpis; for (const bad of ['NaN', 'undefined', 'Infinity', '[object']) if (info.text.includes(bad)) rec.forbidden.push(bad); if (/\bnull\b/.test(info.text)) rec.forbidden.push('null'); }
    if (shotsDir && (w === 1440 || w === 390)) { await page.screenshot({ path: `${shotsDir}/${label.replace(/[^A-Za-z0-9]+/g, '_')}_${w}.png`, fullPage: false }); }
    await ctx.close();
  }
  results.push(rec); console.log(label, JSON.stringify({ status: rec.widths[1440].status, ms: rec.widths[1440].loadMs, kpis: rec.kpis, overflow: Object.fromEntries(Object.entries(rec.widths).map(([w, v]) => [w, v.overflowPx])), errors: rec.errors.length, forbidden: rec.forbidden }));
}
await browser.close(); writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), base, results }, null, 1));
