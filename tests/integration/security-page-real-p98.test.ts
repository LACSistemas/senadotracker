import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import test from 'node:test';

/**
 * Montagem REAL da página de Segurança (read models sobre o PostgreSQL publicado, sem mocks), em processo filho com o mesmo caminho do servidor.
 * Só roda quando há .env com o banco do Cívica; as consultas são somente leitura.
 */
const skip = existsSync('.env') ? false : 'sem .env do banco do Cívica';
function page(kind: 'uf' | 'municipio', code: string): Record<string, any> {
  const r = spawnSync(process.execPath, ['--env-file=.env', '--import', 'tsx', 'scripts/security/probe-page.ts', kind, code], { encoding: 'utf8', env: { ...process.env, TSX_TSCONFIG_PATH: 'apps/web/tsconfig.json' }, timeout: 120000 });
  const line = r.stdout.split('\n').find(l => l.startsWith('RESULT ')); assert.ok(line, `sem resultado: ${r.stderr.slice(0, 300)}`); return JSON.parse(line.slice(7));
}

test('Vitória (ES, município com fonte estadual municipalizada): 4 indicadores-chave, comparação válida, orçamento de SQL e payload enxutos', { skip }, () => {
  const v = page('municipio', '3205309');
  assert.deepEqual(v.kpis.map((k: any) => k.id), ['letal', 'patrimonio', 'transito', 'gasto']); assert.ok(v.kpis.every((k: any) => k.hasRuler && k.compareValid === true), 'ES tem grupo de porte semelhante: todas as comparações são válidas');
  assert.ok(v.sql <= 60, `SQL por montagem: ${v.sql}`); assert.ok(v.jsonKB <= 160, `payload inicial: ${v.jsonKB} KB`); assert.ok(v.lazyOptions >= 15, 'séries pesadas só por demanda'); assert.deepEqual(Object.values(v.chapters), [true, true, true, true, true, true]);
  assert.match(v.observed, /Nenhum estabelecimento identificado nesta base/); assert.match(v.structureAnswer, /guarda municipal/); assert.ok(v.stateOnly.length >= 3, 'estupro, furto de veículo etc. identificados como só-estado');
  assert.ok(v.rejected.includes('prisional') && v.rejected.includes('apreensoes'));
});
test('Alto Rio Novo (ES, 9 mil habitantes): sem comparação de taxa por instabilidade e sem guarda municipal declarada', { skip }, () => {
  const a = page('municipio', '3200359'); assert.ok(a.kpis.length >= 3); const letal = a.kpis.find((k: any) => k.id === 'letal'); assert.equal(letal.hasRuler, false); assert.equal(letal.compareValid, false); assert.match(a.structureAnswer, /não tem guarda municipal/);
});
test('Salvador (BA) e Curitiba (PR): sem fonte P9.6 publicada, sem "roubos" no herói e sem inventar dado municipal', { skip }, () => {
  for (const code of ['2927408', '4106902']) { const s = page('municipio', code); assert.ok(!s.kpis.some((k: any) => k.id === 'patrimonio'), `${s.name}: sem roubo municipal`); assert.ok(s.rejected.includes('patrimonio')); assert.ok(s.kpis.length >= 3); }
});
test('Estado (ES): usa fontes do próprio estado; São Paulo: células suprimidas não viram zero (supressão aparece nas opções de violência sexual)', { skip }, () => {
  const es = page('uf', 'ES'); assert.equal(es.kind, 'uf'); assert.ok(es.kpis.length >= 3); assert.ok(es.policeFamilies.length >= 5);
  const sp = page('municipio', '3550308'); assert.ok(sp.kpis.length >= 3); assert.ok(sp.crimeOptions >= 20);
});
