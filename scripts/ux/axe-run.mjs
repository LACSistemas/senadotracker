// Uso: AXE_PATH=<.../axe-core/axe.min.js> node scripts/ux/axe-run.mjs <base> <saida.json> <caminho,caminho,...>
// axe-core NÃO é dependência do repositório: instale fora (ex.: D:\Civica\tools\a11y) e aponte AXE_PATH.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
const [base, out, paths] = process.argv.slice(2);
const axeSource = readFileSync(process.env.AXE_PATH, 'utf8');
const b = await chromium.launch(); const results = [];
for (const path of paths.split(',')) for (const [w, h] of [[1280, 900], [390, 844]]) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, locale: 'pt-BR' }); const p = await ctx.newPage();
  await p.goto(base + path, { waitUntil: 'networkidle', timeout: 180000 });
  await p.evaluate(axeSource);
  const r = await p.evaluate(async () => await window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
  const v = r.violations.map((x) => ({ id: x.id, impact: x.impact, help: x.help, nodes: x.nodes.length, sample: x.nodes.slice(0, 3).map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n')[1]) }));
  results.push({ path, width: w, violations: v, passes: r.passes.length, incomplete: r.incomplete.length });
  console.log(path, w, v.length ? v.map((x) => `${x.id}(${x.impact},${x.nodes})`).join(' ') : 'sem violações', `| passes ${r.passes.length} | revisar ${r.incomplete.length}`);
  await ctx.close();
}
writeFileSync(out, JSON.stringify(results, null, 1)); await b.close();
