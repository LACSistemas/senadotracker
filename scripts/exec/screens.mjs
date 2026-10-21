import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

/** Capturas desktop/mobile das páginas territoriais. Uso: node scripts/exec/screens.mjs [http://127.0.0.1:3000] */
const base = process.argv[2] ?? 'http://127.0.0.1:3000';
const out = 'docs/executivo-collector-plan/execucao/saude-nacional-p1/screens'; mkdirSync(out, { recursive: true });
const pages = [['estados', '/estados'], ['sp', '/estados/SP'], ['sp-leitos', '/estados/SP?mapa=leitos'], ['mg-mortalidade', '/estados/MG?mapa=mortalidade'], ['ac-saude', '/estados/AC/saude'], ['df', '/estados/DF'], ['sao-paulo-saude', '/municipios/3550308/saude'], ['vitoria-saude', '/municipios/3205309/saude'], ['alto-rio-novo', '/municipios/3200359'], ['representacao-es', '/estados/ES/representacao']];
const b = await chromium.launch(); const res = [];
for (const [vp, w, h] of [['d', 1366, 900], ['m', 390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage();
  for (const [n, u] of pages) {
    const t0 = Date.now(); const r = await p.goto(base + u, { waitUntil: 'networkidle', timeout: 120000 });
    await p.screenshot({ path: `${out}/${n}-${vp}.png` });
    const overflowX = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    res.push({ vp, n, status: r?.status(), overflowX, ms: Date.now() - t0 });
  }
  await ctx.close();
}
await b.close(); console.log(JSON.stringify(res));
