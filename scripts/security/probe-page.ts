import { loadSecurityPage, scopeOf } from '../../apps/web/lib/security/load.ts';
/** Monta a página de Segurança de um território sem Next (mesmo caminho do servidor) e imprime tamanho, SQL e tempos. Uso: probe-page.ts <uf|municipio> <código> [--dump] */
const [kind, code, flag] = process.argv.slice(2) as ['uf' | 'municipio', string, string?];
const scope = await scopeOf(kind, code); if (!scope) { console.log('território não encontrado'); process.exit(1); }
for (const round of ['frio', 'quente']) {
  const t = performance.now(); const d = await loadSecurityPage(scope); const ms = performance.now() - t; const json = JSON.stringify(d);
  console.log(round, scope.name, `wall=${ms.toFixed(0)}ms sql=${d.meta.sqlStatements} dbWall=${d.meta.dbMs}ms build=${d.meta.buildMs}ms json=${(json.length / 1024).toFixed(0)}KB kpis=${d.hero.kpis.map(k => k.id).join(',')} options=${d.crime.options.length}`);
  if (round === 'quente') console.log('  tamanhos KB:', JSON.stringify(Object.fromEntries(Object.entries(d).map(([k, v]) => [k, Math.round(JSON.stringify(v).length / 1024)]))), ' crime.options:', JSON.stringify(d.crime.options.map(o => [o.id, Math.round(JSON.stringify(o).length / 1024)])));
  if (flag === '--dump' && round === 'quente') { console.log(JSON.stringify(d.hero.kpis.map(k => ({ id: k.id, v: k.value, unit: k.unit, basis: k.basis, delta: k.delta?.text, compare: k.compare?.text?.slice(0, 220), sec: k.secondary })), null, 1)); console.log(JSON.stringify({ crime: d.crime.narrative, structure: d.structure.narrative, traffic: d.traffic.narrative, prison: d.prison.narrative, finance: d.finance.narrative, police: d.police.narrative }, null, 1)); }
}
const last = await loadSecurityPage(scope); const j = JSON.stringify(last);
console.log('RESULT ' + JSON.stringify({ name: scope.name, kind: scope.kind, kpis: last.hero.kpis.map(k => ({ id: k.id, value: k.value, hasRuler: !!k.ruler, compareValid: k.compare?.valid ?? null })), rejected: last.hero.rejected.map(r => r.id), sql: last.meta.sqlStatements, dbMs: last.meta.dbMs, jsonKB: Math.round(j.length / 1024),
  chapters: { crime: last.crime.available, structure: last.structure.available, traffic: last.traffic.available, prison: last.prison.available, finance: last.finance.available, police: last.police.available }, crimeOptions: last.crime.options.length, lazyOptions: last.crime.options.filter(o => o.lazy).length, stateOnly: last.crime.stateOnly,
  observed: last.prison.observed, structureAnswer: last.structure.narrative.answer, policeFamilies: last.police.families.map(f => f.code) }));
process.exit(0);
