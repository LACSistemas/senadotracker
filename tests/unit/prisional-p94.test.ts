import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLAG, PRI_ADDITIVE_IDS, PRI_DEFS, PRI_IDS, PRI_MEASURES, aggRows, buildEntityDir, buildPriNational, buildPriSlice, checkCycle, emptyAgg, resolveIdentities, semesterOfRef, unitAgg, unitCapacity, addAgg,
  type PriCycleJson, type PriRow,
} from '../../packages/db/src/exec/index.ts';

const H = new Map(PRI_MEASURES.map(m => [m.code, m.header]));
const capCols = PRI_MEASURES.filter(m => m.block === '1.3 capacidade').map(m => m.header), popCols = PRI_MEASURES.filter(m => m.block === '4.1 população').map(m => m.header);
let n = 0;
function row(o: Partial<PriRow> & { capM?: number | null; capF?: number | null; popT?: number | null; ref?: string; ciclo?: string }): PriRow {
  const cap: Record<string, number | null> = Object.fromEntries(capCols.map(c => [c, null])); const pop: Record<string, number | null> = Object.fromEntries(popCols.map(c => [c, null]));
  cap[H.get('cap.total.M')!] = o.capM === undefined ? 100 : o.capM; cap[H.get('cap.total.F')!] = o.capF === undefined ? null : o.capF; pop[H.get('pop.total')!] = o.popT === undefined ? 150 : o.popT;
  return { row: ++n, ciclo: o.ciclo ?? '19', ano: '2025', ref: o.ref ?? '2025/2', tipo: 'Cela física', preench: 'Validado', nome: 'PENITENCIÁRIA X', situacao: 'Ativo', outras: '', cep: '29000000', ambito: 'Estadual', uf: 'ES', municipio: 'Vitória', ibge: '3205309', sexo: 'Masculino', tipo_orig: 'x', gestao: 'Pública', ...o, cap, pop } as PriRow;
}
const cyc = (rows: PriRow[]): PriCycleJson => ({ version: 'sisdepen-v1', head_cols: 1, cap_cols: capCols, pop_cols: popCols, rows });
const chk = (rows: PriRow[], ref = '2025/2') => checkCycle(cyc(rows.map(r => ({ ...r, ref, ciclo: String(semesterOfRef(ref).cycle) }))), ref);

test('semestres: 19 ciclos de 2016/2 a 2025/2, janelas e competência; referência inválida barra', () => {
  assert.deepEqual([semesterOfRef('2016/2').cycle, semesterOfRef('2025/2').cycle, semesterOfRef('2025/1').cycle], [1, 19, 18]);
  const s = semesterOfRef('2025/1'); assert.deepEqual([s.competence, s.start, s.end], [202506, '2025-01-01', '2025-07-01']); assert.deepEqual([semesterOfRef('2024/2').competence, semesterOfRef('2024/2').end], [202412, '2025-01-01']);
  assert.throws(() => semesterOfRef('2016/1'), /anterior ao 1º/); assert.throws(() => semesterOfRef('2025-2'), /inválida/);
});
test('contrato: 27 medidas de capacidade + 44 de população, ids únicos; indicadores com fórmula; ocupação e excedentes não aditivos', () => {
  assert.equal(capCols.length, 27); assert.equal(popCols.length, 44); assert.equal(new Set(PRI_MEASURES.map(m => m.id)).size, 71);
  assert.equal(new Set(PRI_IDS).size, PRI_DEFS.length); assert.ok(PRI_DEFS.every(d => d.note.length > 60));
  for (const d of PRI_DEFS.filter(x => x.kind === 'occ' || x.kind === 'exc_net')) assert.ok(!PRI_ADDITIVE_IDS.includes(d.id), d.code);
  assert.ok(PRI_DEFS.filter(d => d.scope === 'D').every(d => /NÃO entra na taxa de ocupação/.test(d.note)));
  assert.ok(PRI_DEFS.find(d => d.code === 'IND-PRI-E-OCC')!.note.includes('nunca média das taxas'));
});
test('checkCycle: layout alterado, referências misturadas, ciclo ≠ referência e linhas não validadas/inativas ficam fora (sem presumir encerramento)', () => {
  const ok = chk([row({}), row({ preench: 'Em preenchimento', nome: 'B' }), row({ situacao: 'Inativo', nome: 'C' }), row({ tipo: 'Outro', nome: 'D' }), row({ ambito: 'Municipal', nome: 'E' })]);
  assert.equal(ok.rows.length, 1); assert.deepEqual(ok.excluded, { notValidated: 1, notActive: 1, badTipo: 1, badAmbito: 1 });
  assert.throws(() => checkCycle({ ...cyc([row({})]), cap_cols: capCols.slice(1) }), /layout do SISDEPEN mudou/);
  assert.throws(() => checkCycle({ ...cyc([row({})]), pop_cols: [...popCols, 'nova coluna'] }), /layout do SISDEPEN mudou/);
  assert.throws(() => checkCycle(cyc([row({ ref: '2025/1', ciclo: '18' }), row({ ref: '2025/2', ciclo: '19' })])), /mais de uma referência/);
  assert.throws(() => checkCycle(cyc([row({ ref: '2025/2', ciclo: '18' })])), /não corresponde/); assert.throws(() => checkCycle(cyc([row({})]), '2025/1'), /≠ esperada/); assert.throws(() => checkCycle(cyc([])), /sem linhas/);
});
test('capacidade utilizável: célula vazia só é "não aplicável" em unidade de um único sexo; incompleta ≠ zero', () => {
  assert.equal(unitCapacity('Masculino', 100, null), 100); assert.equal(unitCapacity('Feminino', null, 40), 40); assert.equal(unitCapacity('Misto', 100, 20), 120);
  assert.equal(unitCapacity('Misto', 100, null), null, 'misto com feminino vazio: incompleta'); assert.equal(unitCapacity('Masculino', null, null), null); assert.equal(unitCapacity('Masculino', 0, null), 0, 'zero declarado');
  assert.equal(unitCapacity('Feminino', 100, null), null, 'unidade feminina sem capacidade feminina');
});
test('agregados: ocupação = Σ pop ÷ Σ cap (não média das taxas); excedente líquido ≠ bruto; sem capacidade fica fora; domiciliar e federal separados', () => {
  const a = unitAgg(chk([row({ capM: 100, popT: 300 })]).rows[0]!), b = unitAgg(chk([row({ capM: 900, popT: 450, nome: 'B' })]).rows[0]!), z = unitAgg(chk([row({ capM: 0, popT: 70, nome: 'Z' })]).rows[0]!);
  const t = [a, b, z].reduce(addAgg, emptyAgg());
  assert.deepEqual([t.unitsE, t.capE, t.popE, t.eligible, t.noCap], [3, 1000, 820, 2, 1]);
  const rows = aggRows(1, t, semesterOfRef('2025/2')); const get = (id: number) => rows.find(r => r.indicator_id === id)!;
  assert.equal(get(6004).value, 750 / 1000 * 100, 'Σ pop elegível ÷ Σ cap elegível (média simples das taxas daria 175)'); assert.equal(get(6004).numerator, 750); assert.equal(get(6004).denominator, 1000);
  assert.equal(get(6005).value, -250, 'líquido: 750 − 1000'); assert.equal(get(6006).value, 200, 'bruto: só a unidade acima da capacidade'); assert.equal(get(6007).value, 1); assert.equal(get(6008).value, 2);
  assert.ok((get(6004).flags! & FLAG.partialCoverage) !== 0, 'unidade sem capacidade: cobertura parcial'); assert.equal(get(6003).value, 820, 'população total inclui a unidade sem capacidade');
  const dom = unitAgg(chk([row({ tipo: 'Domiciliar com monitoramento eletrônico', popT: 5000, nome: 'D' })]).rows[0]!), dm2 = unitAgg(chk([row({ tipo: 'Domiciliar sem monitoramento eletrônico', popT: 7, nome: 'D2' })]).rows[0]!);
  assert.deepEqual([dom.unitsE, dom.domPopCom, dm2.domPopSem, dom.popE], [0, 5000, 7, 0], 'domiciliar não entra em celas físicas');
  const fed = unitAgg(chk([row({ ambito: 'Federal', capM: 200, popT: 100, nome: 'F' })]).rows[0]!); assert.deepEqual([fed.unitsE, fed.unitsF, fed.popF_, fed.capF_], [0, 1, 100, 200]);
  const none = aggRows(1, unitAgg(chk([row({ capM: 0, popT: 50 })]).rows[0]!), semesterOfRef('2025/2')); assert.equal(none.find(r => r.indicator_id === 6004)!.value, null); assert.ok((none.find(r => r.indicator_id === 6004)!.flags! & FLAG.noDenominator) !== 0, 'capacidade zero: sem divisão');
  assert.ok(aggRows(1, emptyAgg(), semesterOfRef('2025/2')).length === 0, 'território sem estabelecimento: sem linha');
});
test('identidade histórica: exato, renomeação por CEP, mudança de município, homônimos separados, ausência ≠ encerramento, primeiro ciclo tudo novo', () => {
  const c1 = chk([row({ nome: 'CASA A', cep: '11111111' }), row({ nome: 'CASA B', cep: '22222222' }), row({ nome: 'CASA C', cep: '33333333' }), row({ nome: 'CASA D', cep: '44444444', ibge: '3200359' })], '2025/1');
  const c2 = chk([row({ nome: 'CASA A' }), row({ nome: 'CASA B RENOMEADA', cep: '22222222' }), row({ nome: 'CASA D', cep: '44444444', ibge: '3205309' }), row({ nome: 'CASA NOVA', cep: '55555555' })].map((r, i) => i === 0 ? { ...r, cep: '11111111' } : r), '2025/2');
  const r = resolveIdentities([{ semester: c2.semester, rows: c2.rows }, { semester: c1.semester, rows: c1.rows }]);   // ordem de entrada embaralhada de propósito
  const as = (c: typeof c1, name: string) => r.assigns.get(`${c.semester.competence}:${c.rows.find(x => x.nome === name)!.row}`)!;
  assert.ok([...c1.rows].every(x => r.assigns.get(`${c1.semester.competence}:${x.row}`)!.method === 0), 'primeiro ciclo: todas novas');
  assert.equal(as(c2, 'CASA A').method, 1); assert.equal(as(c2, 'CASA A').unitId, as(c1, 'CASA A').unitId);
  assert.equal(as(c2, 'CASA B RENOMEADA').method, 2); assert.equal(as(c2, 'CASA B RENOMEADA').review, 1); assert.equal(as(c2, 'CASA B RENOMEADA').unitId, as(c1, 'CASA B').unitId);
  assert.equal(as(c2, 'CASA D').method, 3); assert.equal(as(c2, 'CASA D').unitId, as(c1, 'CASA D').unitId); assert.equal(as(c2, 'CASA NOVA').method, 0);
  assert.equal(r.units.size, 5); assert.equal(r.units.get(as(c1, 'CASA C').unitId)!.lastCompetence, c1.semester.competence, 'CASA C ausente em 2025/2: continua existindo, sem encerramento');
  const ids = [...r.units.keys()].sort((a, b) => a - b); assert.deepEqual(ids, [1, 2, 3, 4, 5]);
  assert.throws(() => resolveIdentities([{ semester: c1.semester, rows: c1.rows }, { semester: c1.semester, rows: c1.rows }]), /ciclo repetido/);
});
test('identidade: homônimos no mesmo ciclo com candidatos viram unidades separadas (método 9, revisão); reaparecimento após ausência volta à mesma unidade', () => {
  const c1 = chk([row({ nome: 'UNIDADE Z', cep: '99999999' })], '2024/1'); const c2 = chk([row({ nome: 'OUTRA' })], '2024/2');
  const c3 = chk([row({ nome: 'UNIDADE Z', cep: '99999999' }), row({ nome: 'UNIDADE Z', cep: '88888888' })], '2025/1');
  const r = resolveIdentities([c1, c2, c3].map(c => ({ semester: c.semester, rows: c.rows })));
  const z1 = r.assigns.get(`${c1.semester.competence}:${c1.rows[0]!.row}`)!; const a = c3.rows.map(x => r.assigns.get(`${c3.semester.competence}:${x.row}`)!);
  assert.ok(a.every(x => x.method === 9 && x.review === 1 && x.unitId !== z1.unitId), 'nome repetido com candidato: nenhuma união automática');
  const c4 = chk([row({ nome: 'UNIDADE Z', cep: '99999999' })], '2025/2'); const r2 = resolveIdentities([c1, c2, c4].map(c => ({ semester: c.semester, rows: c.rows })));
  assert.equal(r2.assigns.get(`${c4.semester.competence}:${c4.rows[0]!.row}`)!.unitId, r2.assigns.get(`${c1.semester.competence}:${c1.rows[0]!.row}`)!.unitId, 'reapareceu após um ciclo de ausência: mesma unidade');
});
test('fatia UF: fatos só com célula preenchida (zero declarado fica), município não conciliado vai à UF e ao resto; Σ municípios + resto = UF; Brasil = Σ UFs', () => {
  const dir = buildEntityDir([{ entity_id: 1, kind: 3, ibge7: 32, uf_code: 32, name: 'ES' }, { entity_id: 10, kind: 4, ibge7: 3205309, uf_code: 32, name: 'Vitória' }, { entity_id: 11, kind: 4, ibge7: 3200359, uf_code: 32, name: 'Alto Rio Novo' }]);
  const c = chk([row({ nome: 'A', capM: 100, popT: 130 }), row({ nome: 'B', capM: 0, popT: 5, ibge: '3200359', cep: '2' }), row({ nome: 'C', capM: 50, popT: 70, ibge: '', cep: '3' }), row({ nome: 'S', uf: 'SP', ibge: '3550308', cep: '4' })]);
  const resolved = resolveIdentities([{ semester: c.semester, rows: c.rows }]);
  const s = buildPriSlice(c, { ufAcronym: 'ES', ufCode: 32, ufEntity: 1, dir, resolved, prevUnits: new Set() });
  assert.equal(s.obs.length, 3); assert.equal(s.cov[0]!.unassigned_mun, 1); assert.equal(s.cov[0]!.cela, 3);
  const capFacts = s.facts.filter(f => f.measure_id === 122); assert.deepEqual(capFacts.map(f => f.value).sort(), [0, 100, 50], 'zero declarado preservado');
  assert.equal(s.facts.filter(f => f.measure_id === 123).length, 0, 'célula vazia: sem linha');
  const uf = s.indicators.filter(r => r.entity_id === 1); const mun = s.indicators.filter(r => r.entity_id !== 1);
  assert.equal(uf.find(r => r.indicator_id === 6003)!.value, 205); assert.equal(mun.filter(r => r.indicator_id === 6003).reduce((x, r) => x + r.value!, 0) + s.unassigned[6003]!, 205);
  assert.equal(s.unassigned[6003], 70); assert.ok(PRI_ADDITIVE_IDS.includes(6003));
  assert.ok(!s.obs.some(o => o.source_name === 'S'), 'outra UF não entra'); for (const o of s.obs) assert.ok(!('cep' in o) && !('address' in o), 'sem CEP/endereço no registro persistido');
  const br = buildPriNational([s.agg, emptyAgg()], 76, c.semester); assert.equal(br.find(r => r.indicator_id === 6003)!.value, 205); assert.ok(br.every(r => r.entity_id === 76));
  assert.throws(() => buildPriSlice(c, { ufAcronym: 'ES', ufCode: 32, ufEntity: 1, dir, resolved: resolveIdentities([]), prevUnits: new Set() }), /sem unit_id/);
});
