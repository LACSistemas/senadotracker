import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { zipSync, strToU8 } from 'fflate';
import {
  EFE_DEFS, EFE_DEF_BY_ID, ESTADIC_VARS, FBSP_ALL_IDS, FBSP_CORPS, FLAG, IBGE_EDITIONS, MUNIC_VARS, SIAPE_IDS, assertDictionary, buildEntityDir, buildEstadic, buildFbsp, buildMunic, buildSiape, parseAnswer, statusOf,
  type FbspJson, type IbgeJson, type SiapeJson,
} from '../../packages/db/src/exec/index.ts';

const fbspFix = JSON.parse(readFileSync(new URL('../fixtures/exec/fbsp_raiox_tabelas.json', import.meta.url), 'utf8')) as FbspJson;
const clone = <T>(x: T): T => JSON.parse(JSON.stringify(x));
const SIGLAS = ['RO', 'AC', 'AM', 'RR', 'PA', 'AP', 'TO', 'MA', 'PI', 'CE', 'RN', 'PB', 'PE', 'AL', 'SE', 'BA', 'MG', 'ES', 'RJ', 'SP', 'PR', 'SC', 'RS', 'MS', 'MT', 'GO', 'DF'];
const UFCODES = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27, 28, 29, 31, 32, 33, 35, 41, 42, 43, 50, 51, 52, 53];
const ufEntityBySigla = new Map(SIGLAS.map((s, i) => [s, 100 + i])); const ufEntityByCode = new Map(UFCODES.map((c, i) => [c, 100 + i]));
const BR = 76;
const fbspArgs = () => ({ ufEntityBySigla, brEntity: BR, popByEntity: new Map<number, number>(SIGLAS.map((_, i) => [100 + i, 1_000_000])) });
const byId = (rows: Array<{ indicator_id: number; entity_id: number; value: number | null; flags?: number; period_start: string; period_end: string }>, id: number, ent: number) => rows.find(r => r.indicator_id === id && r.entity_id === ent);
const ent = (s: string) => ufEntityBySigla.get(s)!;

// =============================================================================== definições
test('definições: ids únicos e estáveis, sem indicador que some corporações, sem taxa sem corporação, textos de método preenchidos', () => {
  const ids = EFE_DEFS.map(d => d.id); assert.equal(new Set(ids).size, ids.length); assert.ok(ids.every(i => i >= 5001 && i < 5400));
  assert.equal(EFE_DEFS.filter(d => d.source === 'FBSP').length, 10 + 9 + 3 + 4); assert.equal(EFE_DEFS.filter(d => d.source === 'ESTADIC').length, 10);
  assert.equal(EFE_DEFS.filter(d => d.source === 'MUNIC').length, 18 + 4); assert.equal(SIAPE_IDS.length, 4);
  for (const d of EFE_DEFS) { assert.ok(d.note.length > 40 && d.definition.length > 10 && d.comparability.length > 10, d.code); assert.ok(!/total geral|todas as corpora/i.test(d.label), d.label); if (d.measure === 'taxa') assert.ok(d.corporation, d.code); }
  assert.ok(FBSP_ALL_IDS.every(i => EFE_DEF_BY_ID.has(i)));
  assert.ok(EFE_DEFS.filter(d => d.source === 'SIAPE').every(d => /não é efetivo|Não é número|≠ policial/i.test(d.note + d.comparability + d.definition)));
  assert.ok(MUNIC_VARS.every(v => EFE_DEF_BY_ID.get(v.id)?.level === 'municipio')); assert.ok(ESTADIC_VARS.every(v => EFE_DEF_BY_ID.get(v.id)?.level === 'uf'));
});
test('parseAnswer: vocabulário das duas edições; "-" é pergunta não aplicável; valor desconhecido não é adivinhado', () => {
  assert.deepEqual(parseAnswer('Sim'), { kind: 'yes' }); assert.deepEqual(parseAnswer('Não'), { kind: 'no' }); assert.deepEqual(parseAnswer('-'), { kind: 'na' });
  assert.deepEqual(parseAnswer('Não informou'), { kind: 'notInformed' }); assert.deepEqual(parseAnswer('(*) Não soube informar'), { kind: 'notInformed' }); assert.deepEqual(parseAnswer('Recusa'), { kind: 'refused' });
  assert.deepEqual(parseAnswer(12), { kind: 'num', v: 12 }); assert.equal(parseAnswer('talvez').kind, 'unknown'); assert.equal(parseAnswer(undefined).kind, 'unknown');
});
test('statusOf: valor nulo nunca vira zero; inexistente vale zero por definição', () => {
  assert.equal(statusOf(5, 0), 'reported'); assert.equal(statusOf(0, FLAG.inexistent), 'inexistent'); assert.equal(statusOf(null, FLAG.refused), 'refused'); assert.equal(statusOf(null, FLAG.notInformed), 'not_informed');
  assert.equal(statusOf(null, FLAG.composite), 'included_in_other'); assert.equal(statusOf(null, FLAG.unavailable), 'unavailable'); assert.equal(statusOf(null, 0), 'unavailable');
});

// =============================================================================== FBSP
test('FBSP: reconciliações (41), controles nacionais e UFs, marcas de SP/RJ/CE/AC e sem linhas por UF para PF/PRF', () => {
  const b = buildFbsp(clone(fbspFix), fbspArgs()); assert.equal(b.recon.length, 41); assert.ok(b.recon.every(r => r.ok));
  assert.equal(byId(b.rows, 5001, BR)!.value, 413319); assert.equal(byId(b.rows, 5002, BR)!.value, 63002); assert.equal(byId(b.rows, 5003, BR)!.value, 96902); assert.equal(byId(b.rows, 5004, BR)!.value, 19340);
  assert.equal(byId(b.rows, 5005, BR)!.value, 91850); assert.equal(byId(b.rows, 5006, BR)!.value, 12536); assert.equal(byId(b.rows, 5007, BR)!.value, 12328); assert.equal(byId(b.rows, 5010, BR)!.value, 107457);
  assert.equal(byId(b.rows, 5011, BR)!.value, 628732, 'previsto PM nacional');
  const sp = byId(b.rows, 5001, ent('SP'))!; assert.equal(sp.value, 82250); assert.ok((sp.flags! & FLAG.composite) !== 0, 'PM de SP inclui bombeiros (nota 7)');
  const spCbm = byId(b.rows, 5002, ent('SP'))!; assert.equal(spCbm.value, null, 'célula vazia: nunca zero'); assert.ok((spCbm.flags! & FLAG.composite) !== 0);
  assert.equal(byId(b.rows, 5003, ent('SP'))!.value, 19420); assert.equal(byId(b.rows, 5003, ent('RS'))!.value, 5771); assert.equal(byId(b.rows, 5001, ent('RS'))!.value, 18360);
  assert.ok((byId(b.rows, 5001, ent('RJ'))!.flags! & FLAG.refDateUncertain) !== 0, 'nota da Tabela 3: PM do RJ de março/2022');
  assert.equal(byId(b.rows, 5010, ent('AC'))!.value, 0); assert.ok((byId(b.rows, 5010, ent('AC'))!.flags! & FLAG.inexistent) !== 0); assert.equal(byId(b.rows, 5010, ent('DF'))!.value, 0);
  const ceP = byId(b.rows, 5013, ent('CE'))!; assert.equal(ceP.value, null); assert.ok((ceP.flags! & FLAG.unavailable) !== 0, 'previsto da polícia penal do CE: "..."');
  assert.equal(byId(b.rows, 5016, ent('CE')), undefined, 'sem previsto: sem ocupação');
  assert.ok(Math.abs(byId(b.rows, 5014, ent('CE'))!.value! - 100.38) < 0.01); assert.equal(byId(b.rows, 5017, ent('CE'))!.value, -90, 'existente acima do previsto: diferença negativa');
  assert.ok(Math.abs(byId(b.rows, 5016, ent('AL'))!.value! - 56.8) < 0.05, 'AL: "..." impresso, calculado dos números');
  for (const id of [5006, 5007, 5008, 5009]) assert.equal(b.rows.filter(r => r.indicator_id === id).length, 1, `corporação federal ${id}: só Brasil`);
  const rate = byId(b.rows, 5031, ent('SP'))!; assert.equal(rate.value, 82250 / 1_000_000 * 100000); assert.ok((rate.flags! & FLAG.composite) !== 0); assert.equal(byId(b.rows, 5032, ent('SP')), undefined, 'sem taxa de bombeiros de SP');
  assert.equal(byId(b.rows, 5034, ent('AC')), undefined, 'sem taxa onde a guarda é inexistente');
  assert.equal(b.rows.filter(r => r.indicator_id >= 5031).every(r => r.entity_id !== BR), true, 'sem taxa nacional (Brasil não tem população carregada)');
  for (const r of b.rows) { assert.ok(r.period_end > r.period_start); assert.equal(r.status, 2); }
  assert.equal(byId(b.rows, 5006, BR)!.period_start, '2025-04-01'); assert.equal(byId(b.rows, 5008, BR)!.period_start, '2023-06-01'); assert.ok((byId(b.rows, 5009, BR)!.flags! & FLAG.refDateUncertain) !== 0);
  assert.equal(byId(b.rows, 5021, ent('SP'))!.value, 29393); assert.equal(byId(b.rows, 5020, BR)!.value, 1384);
});
test('FBSP: layout alterado e inconsistências barram a carga (célula vazia inesperada, existente ≠ Tabela 2, % impressa, Σ UFs, linha ausente)', () => {
  const blank = clone(fbspFix); blank.tables.T2.rows.MG!.cells.PM = { raw: '', state: 'BLANK', v: null }; assert.throws(() => buildFbsp(blank, fbspArgs()), /célula vazia inesperada/);
  const diff = clone(fbspFix); diff.tables.T3.rows.BA!.cells.EXISTENTE!.v = 30000; assert.throws(() => buildFbsp(diff, fbspArgs()), /difere da Tabela 2/);
  const pct = clone(fbspFix); pct.tables.T4.rows.BA!.cells.RELACAO_PCT!.v = 70; assert.throws(() => buildFbsp(pct, fbspArgs()), /ocupação calculada/);
  const sum = clone(fbspFix); sum.tables.T2.rows.BA!.cells.PM!.v = 31000; sum.tables.T3.rows.BA!.cells.EXISTENTE!.v = 31000; sum.tables.T3.rows.BA!.cells.RELACAO_PCT!.v = 65.7; assert.throws(() => buildFbsp(sum, fbspArgs()), /reconciliação do Raio-X falhou/);
  const miss = clone(fbspFix); delete miss.tables.T2.rows.TO; assert.throws(() => buildFbsp(miss, fbspArgs()), /sem a linha TO/);
  const gcm = clone(fbspFix); gcm.tables.T15.rows.SP!.cells.EF_FINAL!.v = 1; assert.throws(() => buildFbsp(gcm, fbspArgs()), /GCM SP/);
  const noEnt = fbspArgs(); noEnt.ufEntityBySigla.delete('TO'); assert.throws(() => buildFbsp(clone(fbspFix), noEnt), /UF sem entidade/); ufEntityBySigla.set('TO', 106);
});
test('FBSP: corporações — cada uma com data-base própria e nota; nenhuma definida como soma de outras', () => {
  assert.equal(FBSP_CORPS.length, 10); assert.ok(FBSP_CORPS.every(c => c.note.length > 30 && c.ref.start < c.ref.end));
  assert.equal(new Set(FBSP_CORPS.map(c => c.id)).size, 10);
});

// =============================================================================== ESTADIC
const estadicJson = (edition: 2019 | 2023, patch: (rows: IbgeJson['rows']) => void = () => undefined): IbgeJson => {
  const y = edition === 2023 ? 2022 : 2018; const dic: IbgeJson['dictionary'] = {};
  for (const v of ESTADIC_VARS) dic[v.v] = { label: v.expectLabel, context: v.ctx.map(c => c.replace('{Y}', String(y))).join(' | ') };
  const rows = UFCODES.map((c, i) => ({ ufCode: c, v: Object.fromEntries(ESTADIC_VARS.map(v => [v.v, v.measure === 'existencia' ? 'Sim' : (i + 1) * 10 + (v.v.endsWith('1') ? 1 : v.v.endsWith('2') ? 2 : 0)])) as Record<string, number | string> }));
  for (const r of rows) { r.v.ESEG273 = (r.v.ESEG271 as number) + (r.v.ESEG272 as number); r.v.ESEG493 = (r.v.ESEG491 as number) + (r.v.ESEG492 as number); }
  patch(rows); return { version: 'ibge-perfil-seg-v2', mode: 'estadic', edition, sheet: 'x', columns: 1, rows, dictionary: dic, missingOptional: [] };
};
test('ESTADIC: recusa e "não informou" são estados (nunca zero); soma H+M; respondentes; edições 2019 e 2023 em janelas disjuntas', () => {
  const j = estadicJson(2023, rows => { const ro = rows[0]!; for (const k of Object.keys(ro.v)) ro.v[k] = 'Recusa'; const pa = rows[4]!; pa.v.ESEG271 = 'Não informou'; pa.v.ESEG272 = 'Não informou'; pa.v.ESEG5131 = '(*) Não soube informar'; rows[5]!.v.ESEG50 = 'Não'; });
  const b = buildEstadic(j, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 });
  const ro = b.rows.filter(r => r.entity_id === ufEntityByCode.get(11)); assert.equal(ro.length, 10); assert.ok(ro.every(r => r.value === null && (r.flags! & FLAG.refused) !== 0), 'RO: recusa ≠ zero');
  assert.ok(b.rows.find(r => r.indicator_id === 5102 && r.entity_id === ufEntityByCode.get(15))!.flags! & FLAG.notInformed);
  assert.ok(b.rows.find(r => r.indicator_id === 5108 && r.entity_id === ufEntityByCode.get(15))!.flags! & FLAG.notInformed, '"(*) Não soube informar" é não informou');
  assert.equal(b.rows.find(r => r.indicator_id === 5110 && r.entity_id === ufEntityByCode.get(16))!.value, 0); assert.equal(b.quality.respondents && (b.quality.respondents as Record<string, number>).ESEG273, 26);
  assert.ok(b.rows.every(r => r.period_start === '2022-12-31' && r.period_end === '2023-01-01'));
  const b19 = buildEstadic(estadicJson(2019), { ufEntityByCode, edition: IBGE_EDITIONS.estadic2019 }); assert.ok(b19.rows.every(r => r.period_start === '2018-12-31' && r.period_end === '2019-01-01'));
  assert.equal(b19.sums[5101], b19.sums[5102]! + b19.sums[5103]!);
});
test('ESTADIC: dicionário alterado, edição trocada, H+M≠total, valor desconhecido e UF repetida barram a carga', () => {
  const lab = estadicJson(2023); lab.dictionary.ESEG273!.label = 'Quantidade'; assert.throws(() => buildEstadic(lab, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /layout do dicionário IBGE mudou/);
  const year = estadicJson(2023); assert.throws(() => buildEstadic(year, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2019 }), /edição do arquivo/);
  const ctx = estadicJson(2023); ctx.dictionary.ESEG273!.context = 'Efetivo existente em 31 de dezembro de 2018'; assert.throws(() => buildEstadic(ctx, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /não contém/);
  const hm = estadicJson(2023, r => { r[3]!.v.ESEG273 = 1; }); assert.throws(() => buildEstadic(hm, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /homens \+ mulheres/);
  const unk = estadicJson(2023, r => { r[3]!.v.ESEG50 = 'talvez'; }); assert.throws(() => buildEstadic(unk, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /valor inesperado/);
  const dup = estadicJson(2023, r => { r[1]!.ufCode = 11; }); assert.throws(() => buildEstadic(dup, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /UF repetida/);
  const short = estadicJson(2023, r => { r.pop(); }); assert.throws(() => buildEstadic(short, { ufEntityByCode, edition: IBGE_EDITIONS.estadic2023 }), /esperado 27/);
});

// =============================================================================== MUNIC
const dir = buildEntityDir([
  { entity_id: 1, kind: 3, ibge7: 32, uf_code: 32, name: 'Espírito Santo' }, { entity_id: 10, kind: 4, ibge7: 3205309, uf_code: 32, name: 'Vitória' }, { entity_id: 11, kind: 4, ibge7: 3200359, uf_code: 32, name: 'Alto Rio Novo' },
  { entity_id: 12, kind: 4, ibge7: 3205200, uf_code: 32, name: 'Vila Velha' }, { entity_id: 13, kind: 4, ibge7: 3201308, uf_code: 32, name: 'Cariacica' }, { entity_id: 14, kind: 4, ibge7: 3205002, uf_code: 32, name: 'Serra' },
]);
const municJson = (edition: 2019 | 2023, rows: IbgeJson['rows']): IbgeJson => {
  const dic: IbgeJson['dictionary'] = {}; const vars = edition === 2023 ? MUNIC_VARS : MUNIC_VARS.filter(v => v.core);
  for (const v of vars) dic[v.v] = { label: v.expectLabel, context: edition === 2023 && v.datedCtx ? v.datedCtx.replace('{Y}', '2022') : 'Existe no município' };
  return { version: 'ibge-perfil-seg-v2', mode: 'munic', edition, sheet: 'x', columns: 1, rows, dictionary: dic, missingOptional: edition === 2023 ? [] : ['MSEG1611'] };
};
const mrow = (cod: number, v: Record<string, number | string>, ufCode = 32): IbgeJson['rows'][number] => ({ ufCode, cod, v: { MSEG27: 'Não', MSEG281: '-', MSEG282: '-', MSEG283: '-', MSEG161: 'Sim', MSEG162: 'Não', MSEG163: 'Não', MSEG164: 'Não', MSEG165: 'Não', MSEG166: 'Não', MSEG167: 'Não', MSEG168: 'Não', MSEG169: 'Não', MSEG1610: 'Não', MSEG1611: '-', MSEG17: 'Não', MSEG18: 'Sim', MSEG19: 'Não', ...v } });
const sample = (): IbgeJson['rows'] => [
  mrow(3205309, { MSEG27: 'Sim', MSEG281: 380, MSEG282: 47, MSEG283: 427, MSEG162: 'Sim', MSEG17: 'Sim' }),
  mrow(3200359, { MSEG27: 'Não' }),
  mrow(3205200, { MSEG27: 'Sim', MSEG281: 200, MSEG282: 86, MSEG283: 286 }),
  mrow(3201308, { MSEG27: 'Sim', MSEG281: 0, MSEG282: 0, MSEG283: 0 }),
  mrow(3205002, { MSEG27: 'Não informou', MSEG281: 'Não informou', MSEG282: 'Não informou', MSEG283: 'Não informou', MSEG161: 'Não informou', MSEG162: 'Não informou', MSEG163: 'Não informou', MSEG164: 'Não informou', MSEG165: 'Não informou', MSEG166: 'Não informou', MSEG167: 'Não informou', MSEG168: 'Não informou', MSEG169: 'Não informou', MSEG1610: 'Não informou', MSEG1611: 'Não informou', MSEG17: 'Não informou', MSEG18: 'Não informou', MSEG19: 'Não informou' }),
  mrow(1100015, { MSEG27: 'Sim', MSEG283: 5 }, 11),
];
const mb = (j = municJson(2023, sample()), edition = IBGE_EDITIONS.munic2023) => buildMunic(j, { ufCode: 32, ufEntity: 1, dir, edition, expectRows: j.rows.length });
test('MUNIC: existência, efetivo (Σ H+M), "-" sem linha, não informou como estado, zero declarado marcado, agregados da UF', () => {
  const b = mb(); const s = b.stats;
  assert.deepEqual([s.municipios, s.comGuarda, s.semGuarda, s.naoInformou, s.efetivo, s.comDelegaciaPc, s.zeroDeclarado, s.semEfetivoNumerico], [5, 3, 1, 1, 713, 4, 1, 1]);
  const get = (id: number, e: number) => byId(b.rows, id, e);
  assert.equal(get(5201, 10)!.value, 1); assert.equal(get(5202, 10)!.value, 427); assert.equal(get(5203, 10)!.value, 380); assert.equal(get(5204, 10)!.value, 47);
  assert.equal(get(5201, 11)!.value, 0); assert.equal(get(5202, 11), undefined, 'sem guarda: sem linha de efetivo (nunca zero presumido)');
  assert.equal(get(5211, 11)!.value, 1); assert.equal(get(5221, 11), undefined, '"-" (nenhuma das citadas não marcada): sem linha');
  assert.equal(get(5202, 13)!.value, 0); assert.ok((get(5202, 13)!.flags! & FLAG.zeroAmbiguous) !== 0, 'guarda com efetivo declarado 0');
  assert.equal(get(5202, 14)!.value, null); assert.ok((get(5202, 14)!.flags! & FLAG.notInformed) !== 0); assert.equal(get(5201, 14)!.value, null); assert.equal(get(5211, 14)!.value, null);
  assert.equal(get(5212, 10)!.value, 1); assert.equal(get(5222, 10)!.value, 1);
  assert.equal(get(5231, 1)!.value, 3); assert.equal(get(5232, 1)!.value, 713); assert.equal(get(5233, 1)!.value, 1); assert.equal(get(5234, 1)!.value, 4);
  assert.ok((get(5231, 1)!.flags! & FLAG.partialCoverage) !== 0, 'UF com município sem resposta: cobertura parcial'); assert.equal(get(5202, 10)!.period_start, '2022-12-31'); assert.equal(get(5201, 10)!.period_start, '2023-01-01');
  assert.equal(b.rows.some(r => r.entity_id === 99), false); assert.equal(b.unmatched.length, 0);
});
test('MUNIC: município fora da UF é ignorado; código sem entidade vira "unmatched" (não é inventado); controles ES (Vitória 427, Vila Velha 286, Alto Rio Novo sem guarda)', () => {
  const rows = sample(); rows.push(mrow(3299999, { MSEG27: 'Não' })); const b = mb(municJson(2023, rows)); assert.deepEqual(b.unmatched, [3299999]); assert.equal(b.stats.municipios, 5);
  assert.equal(byId(b.rows, 5202, 12)!.value, 286); assert.equal(byId(b.rows, 5201, 11)!.value, 0);
});
test('MUNIC: edição 2019 — "Recusa" e "Não soube informar", sem pergunta "nenhuma das citadas", efetivo com data-base incerta', () => {
  const rows: IbgeJson['rows'] = [mrow(3205309, { MSEG27: 'Sim', MSEG281: 1, MSEG282: 2, MSEG283: 3 }), mrow(3200359, { MSEG27: 'Recusa', MSEG161: 'Recusa' }), mrow(3205200, { MSEG27: 'Sim', MSEG283: 'Não soube informar', MSEG281: 'Não soube informar', MSEG282: 'Não soube informar' })];
  for (const r of rows) delete r.v.MSEG1611;
  const b = buildMunic(municJson(2019, rows), { ufCode: 32, ufEntity: 1, dir, edition: IBGE_EDITIONS.munic2019, expectRows: 3 });
  assert.equal(b.stats.recusa, 1); assert.equal(b.stats.naoInformou, 0); assert.equal(byId(b.rows, 5233, 1)!.value, 1, 'sem resposta = recusa + não informou');
  assert.ok((byId(b.rows, 5201, 11)!.flags! & FLAG.refused) !== 0); assert.ok((byId(b.rows, 5202, 12)!.flags! & FLAG.notInformed) !== 0); assert.equal(byId(b.rows, 5221, 10), undefined);
  assert.ok((byId(b.rows, 5202, 10)!.flags! & FLAG.refDateUncertain) !== 0, 'dicionário 2019 não traz a data do efetivo'); assert.equal(byId(b.rows, 5201, 10)!.period_start, '2019-01-01');
});
test('MUNIC: efetivo sem guarda, valor desconhecido, município repetido, dicionário e edição errada barram a carga', () => {
  const a = sample(); a[1]!.v.MSEG283 = 9; assert.throws(() => mb(municJson(2023, a)), /efetivo informado sem guarda/);
  const b = sample(); b[0]!.v.MSEG161 = 'talvez'; assert.throws(() => mb(municJson(2023, b)), /valor inesperado/);
  const c = sample(); c.push(mrow(3205309, {})); assert.throws(() => mb(municJson(2023, c)), /repetido/);
  const d = municJson(2023, sample()); d.dictionary.MSEG283!.label = 'Quantidade'; assert.throws(() => mb(d), /layout do dicionário IBGE mudou/);
  const e = municJson(2023, sample()); e.dictionary.MSEG283!.context = 'Efetivo em 31 de dezembro de 2018'; assert.throws(() => mb(e), /não contém/);
  assert.throws(() => mb(municJson(2019, sample()), IBGE_EDITIONS.munic2023), /edição do arquivo/);
  const f = municJson(2023, sample()); f.missingOptional = ['MSEG1611']; assert.throws(() => mb(f), /variáveis ausentes/);
  const g = municJson(2019, sample()); delete g.dictionary.MSEG27; assert.throws(() => buildMunic(g, { ufCode: 32, ufEntity: 1, dir, edition: IBGE_EDITIONS.munic2019, expectRows: 6 }), /obrigatórias ausentes/);
  assert.throws(() => buildMunic(municJson(2023, sample()), { ufCode: 32, ufEntity: 1, dir, edition: IBGE_EDITIONS.munic2023 }), /esperado 5570/);
  const h = sample(); h[0]!.v.MSEG27 = 'talvez'; assert.throws(() => mb(municJson(2023, h)), /MSEG27 inesperado/);
});
test('assertDictionary: {Y} é o ano da data-base', () => {
  const j = municJson(2023, []); assert.doesNotThrow(() => assertDictionary(j, [{ v: 'MSEG283', expectLabel: 'Total', ctx: ['Efetivo em 31 de dezembro de {Y}'] }], 2022));
  assert.throws(() => assertDictionary(j, [{ v: 'MSEG283', expectLabel: 'Total', ctx: ['Efetivo em 31 de dezembro de {Y}'] }], 2018), /não contém/);
});

// =============================================================================== SIAPE
const siape = (patch: (j: SiapeJson) => void = () => undefined): SiapeJson => { const j: SiapeJson = { version: 'siape-agg-v1', competence: 202608, file_rows: 780670, orgs: {
  '20115': { name: 'Departamento de Polícia Federal', rows: 17253, distinct: 1, by_tipo: { Cargo: 14579, Função: 2313, Outros: 361 }, situacao: { Sigiloso: 17253 }, uf_sigiloso: 17253, cargo_sigiloso: 17253 },
  '30802': { name: 'Departamento de Polícia Rodoviária Federal', rows: 14000, distinct: 1, by_tipo: { Cargo: 12951, Função: 1027, Outros: 22 }, situacao: { Sigiloso: 14000 }, uf_sigiloso: 14000, cargo_sigiloso: 14000 } } }; patch(j); return j; };
test('SIAPE: contagem agregada de PF e PRF (registros e tipo Cargo) como Brasil, janela do mês; órgão ausente, nome trocado e Σ por tipo barram', () => {
  const b = buildSiape(siape(), { brEntity: BR }); assert.equal(b.rows.length, 4);
  assert.deepEqual(b.rows.map(r => [r.indicator_id, r.value, r.period_start, r.period_end]), [[5301, 17253, '2026-08-01', '2026-09-01'], [5302, 14579, '2026-08-01', '2026-09-01'], [5303, 14000, '2026-08-01', '2026-09-01'], [5304, 12951, '2026-08-01', '2026-09-01']]);
  assert.ok(b.rows.every(r => r.entity_id === BR)); assert.equal((b.quality.PF as { distinctIds: number }).distinctIds, 1, 'identificador mascarado: não há como contar pessoas');
  assert.equal(buildSiape(siape(j => { j.competence = 202612; }), { brEntity: BR }).rows[0]!.period_end, '2027-01-01');
  assert.throws(() => buildSiape(siape(j => { delete j.orgs['30802']; }), { brEntity: BR }), /sem registros/);
  assert.throws(() => buildSiape(siape(j => { j.orgs['20115']!.name = 'Outro órgão'; }), { brEntity: BR }), /nome do órgão/);
  assert.throws(() => buildSiape(siape(j => { j.orgs['20115']!.by_tipo.Cargo = 1; }), { brEntity: BR }), /Σ por tipo/);
  assert.throws(() => buildSiape(siape(j => { j.competence = 12; }), { brEntity: BR }), /competência inválida/);
});

// =============================================================================== extratores Python (arquivos sintéticos)
const py = (script: string, args: string[]) => spawnSync('python', ['-I', script, ...args], { encoding: 'utf8', env: { ...process.env, PYTHONIOENCODING: 'utf-8' } });
test('extrator IBGE: lê só a aba de Segurança Pública + dicionário; exige variáveis obrigatórias e o número de linhas', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-efe-')); const xlsx = join(dir, 'm.xlsx'); const out = join(dir, 'm.json');
  const gen = spawnSync('python', ['-I', '-c', `
import openpyxl, sys
wb = openpyxl.Workbook(); d = wb.active; d.title = 'Dicionário'
d.append(['Temas']); d.append(['6.4 Guarda Municipal']); d.append(['Guarda municipal - existência', None, None, None, None, 'MSEG27']); d.append(['Efetivo em 31 de dezembro de 2022:']); d.append([None, 'Total', None, None, None, 'MSEG283'])
d.append(['Existe no município:']); d.append([None, 'Delegacia de Polícia Civil', None, None, None, 'MSEG161']); d.append([None, 'Instituto Médico Legal', None, None, None, 'MSEG17']); d.append([None, 'Sede de Comarca', None, None, None, 'MSEG18']); d.append([None, 'Unidade do Corpo de Bombeiros', None, None, None, 'MSEG19'])
d.append([None, 'Homens', None, None, None, 'MSEG281']); d.append([None, 'Mulheres', None, None, None, 'MSEG282'])
s = wb.create_sheet('Segurança Pública'); s.append(['CodMun', 'UF', 'Cod UF', 'Mun', 'PopMun', 'MSEG27', 'MSEG281', 'MSEG282', 'MSEG283', 'MSEG161', 'MSEG17', 'MSEG18', 'MSEG19'])
for i in range(3): s.append([1100000 + i, 'RO', 11, 'x', 10, 'Sim', 1, 2, 3, 'Sim', 'Não', 'Sim', 'Não'])
wb.save(sys.argv[1])
`, xlsx], { encoding: 'utf8' }); assert.equal(gen.status, 0, gen.stderr);
  const r = py('scripts/exec/ibge_perfil_extract.py', ['munic', xlsx, out, '2023']); assert.notEqual(r.status, 0, 'espera 5.570 linhas'); assert.match(r.stderr + r.stdout, /esperado 5570/);
  const e = py('scripts/exec/ibge_perfil_extract.py', ['estadic', xlsx, out, '2023']); assert.notEqual(e.status, 0); assert.match(e.stderr + e.stdout, /obrigat.rias ausentes|esperado 27/);
});
test('extrator SIAPE: saída só com contagens por órgão — nenhum nome, CPF, matrícula ou identificador; arquivo sem coluna esperada falha', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-siape-')); const zip = join(dir, '202608_Servidores_SIAPE.zip'); const out = join(dir, 'o.json');
  const header = 'Id_SERVIDOR_PORTAL;NOME;CPF;MATRICULA;DESCRICAO_CARGO;ORG_EXERCICIO;COD_ORG_EXERCICIO;TIPO_VINCULO;SITUACAO_VINCULO;UF_EXERCICIO';
  const row = (id: string, nome: string, cpf: string, cod: string, org: string, tipo: string) => `${id};${nome};${cpf};9${id};Sigiloso;${org};${cod};${tipo};Sigiloso;Sigiloso`;
  const csv = [header, row('***', 'FULANO DE TAL', '***.123.456-**', '20115', 'Departamento de Polícia Federal', 'Cargo'), row('***', 'BELTRANA SILVA', '***.987.654-**', '20115', 'Departamento de Polícia Federal', 'Função'), row('***', 'CICRANO', '***.111.222-**', '30802', 'Departamento de Polícia Rodoviária Federal', 'Cargo'), row('77', 'OUTRO', '***.000.000-**', '26454', 'UNIVERSIDADE', 'Cargo')].join('\r\n') + '\r\n';
  await writeFile(zip, zipSync({ '202608_Cadastro.csv': Buffer.from(csv, 'latin1'), '202608_Remuneracao.csv': strToU8('NOME;VALOR\r\nX;1\r\n') }));
  const r = py('scripts/exec/siape_extract.py', [zip, out]); assert.equal(r.status, 0, r.stderr); const txt = await readFile(out, 'utf8'); const j = JSON.parse(txt) as SiapeJson;
  assert.equal(j.orgs['20115']!.rows, 2); assert.deepEqual(j.orgs['20115']!.by_tipo, { Cargo: 1, 'Função': 1 }); assert.equal(j.orgs['30802']!.rows, 1); assert.equal(j.file_rows, 4);
  for (const secret of ['FULANO', 'BELTRANA', 'CICRANO', '123.456', '987.654', '9***', 'OUTRO']) assert.ok(!txt.includes(secret) && !r.stdout.includes(secret), `vazou ${secret}`);
  const bad = join(dir, '202608_Servidores_SIAPE_x.zip'); await writeFile(bad, zipSync({ '202608_Cadastro.csv': Buffer.from('A;B\r\n1;2\r\n', 'latin1') })); const fb = py('scripts/exec/siape_extract.py', [join(dir, 'xx.zip'), out]); assert.notEqual(fb.status, 0);
  const nocol = join(dir, '202609_Servidores_SIAPE.zip'); await writeFile(nocol, zipSync({ '202609_Cadastro.csv': Buffer.from('A;B\r\n1;2\r\n', 'latin1') })); const nc = py('scripts/exec/siape_extract.py', [nocol, out]); assert.notEqual(nc.status, 0); assert.match(nc.stderr + nc.stdout, /colunas ausentes/);
});
