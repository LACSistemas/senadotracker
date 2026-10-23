// Uso: node scripts/ux/dump-text.mjs <base> <saida.json>  — texto visível de cada aba, para comparar antes/depois.
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';
const [base, out] = process.argv.slice(2);
const PEOPLE = ['/legislativo/deputados/204379', '/legislativo/senadores/4639', '/legislativo/deputados/220714'];
const TABS = ['', '/gastos-equipe', '/atuacao-parlamentar', '/carreira-politica'];
const b = await chromium.launch(); const p = await b.newPage(); const res = {};
for (const person of PEOPLE) for (const t of TABS) {
  const t0 = Date.now();
  await p.goto(base + person + t, { waitUntil: 'networkidle', timeout: 180000 });
  res[person + t] = { ms: Date.now() - t0, text: (await p.locator('main').innerText()).replace(/\s+/g, ' ') };
}
writeFileSync(out, JSON.stringify(res, null, 1)); await b.close();
console.log(Object.entries(res).map(([k, v]) => `${k} ${v.ms}ms ${v.text.length}c`).join('\n'));
