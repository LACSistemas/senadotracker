import assert from 'node:assert/strict';
import test from 'node:test';
import {
  FLOW_COLS, INSE_LEVEL_COLS, TDI_COLS, TRN_COLS, TXR_COLS, buildFlowYear, buildInseYear, flowSliceFingerprint, inseClass,
  type FlowEntities, type FlowFile, type FlowRaw, type InseEntities, type InseFile, type InseRaw,
} from '../../packages/db/src/exec/index.ts';

const ent = (): FlowEntities & InseEntities => ({
  byIbge7: new Map([[3205309, { entityId: 3205309, uf: 32 }], [3550308, { entityId: 3550308, uf: 35 }]]),
  geo: new Map([['brasil', { entityId: 76, uf: 0 }], ['norte', { entityId: 1, uf: 0 }], ['espiritosanto', { entityId: 32, uf: 32 }]]),
  ufBySigla: new Map([['ES', 32], ['SP', 35]]), schools: new Set([32000001, 32000002, 35000001]),
  uf: new Map([[32, { entityId: 32, uf: 32 }], [35, { entityId: 35, uf: 35 }]]), brasil: 76,
});
const v = (o: Record<string, string>, cols: string[]): Record<string, string> => Object.fromEntries(cols.map(c => [c, o[c] ?? '']));
const rawS = (key: string, uf: string, dep: string, loc: string, o: Record<string, string>, cols = TXR_COLS, row = 1): FlowRaw => ({ row, key, uf, dep, loc, v: v(o, cols) });
const rawT = (key: string, dep: string, loc: string, o: Record<string, string>, cols = TXR_COLS, row = 1): FlowRaw => ({ row, key, dep, loc, v: v(o, cols) });

test('Fluxo: colunas do catálogo (54 rendimento, 17 distorção, 71 juntas, 64 transição) sem repetição', () => {
  assert.equal(TXR_COLS.length, 54); assert.equal(TDI_COLS.length, 17); assert.equal(FLOW_COLS.length, 71); assert.equal(TRN_COLS.length, 64);
  assert.equal(new Set([...FLOW_COLS, ...TRN_COLS]).size, 71 + 64 - 0 - 0 - [...FLOW_COLS].filter(c => TRN_COLS.includes(c)).length);
});

test('Fluxo: rendimento e distorção da mesma escola viram uma linha; "--" e vazio são NULL; soma ≈ 100 conferida e não corrigida', () => {
  const files: FlowFile[] = [
    { family: 'TXR', level: 'escolas', year: 2023, sha256: ['a'], rows: [rawS('32000001', 'ES', 'Municipal', 'Urbana', { ap_fun: '90.5', rp_fun: '8', ab_fun: '1.5', ap_f1: '--', rp_f1: '', ab_f1: '' })] },
    { family: 'TDI', level: 'escolas', year: 2023, sha256: ['b'], rows: [rawS('32000001', 'ES', 'Municipal', 'Urbana', { td_fun: '12.3' }, TDI_COLS)] },
    { family: 'TXR', level: 'municipios', year: 2023, sha256: ['c'], rows: [rawT('3205309', 'Pública', 'Total', { ap_fun: '88', rp_fun: '9', ab_fun: '2' })] },
    { family: 'TXR', level: 'uf', year: 2023, sha256: ['d'], rows: [rawT('Brasil', 'Total', 'Total', { ap_fun: '91.1', rp_fun: '7.4', ab_fun: '1.5' }), rawT('Norte', 'Total', 'Rural', { ap_fun: '85', rp_fun: '10', ab_fun: '5' }, TXR_COLS, 2), rawT('Espírito Santo', 'Estadual', 'Total', { ap_fun: '92.3' }, TXR_COLS, 3)] },
  ];
  const s = buildFlowYear(files, ent()); const es = s.get('2023:32')!, nat = s.get('2023:0')!;
  assert.equal(es.school.length, 1); const sc = es.school[0]!; assert.equal(sc.ap_fun, 9050); assert.equal(sc.td_fun, 1230); assert.equal(sc.ap_f1, null); assert.equal(sc.rp_f1, null); assert.equal(sc.uf, 32); assert.equal(sc.dep, 3);
  assert.deepEqual(es.terr.map(r => [r.entity_id, r.loc, r.dep]), [[32, 0, 2], [3205309, 0, 5]]);
  assert.deepEqual(nat.terr.map(r => [r.entity_id, r.loc, r.dep]), [[1, 2, 0], [76, 0, 0]]);
  assert.deepEqual([es.sumChecked, es.sumOff, nat.sumChecked, nat.sumOff], [2, 1, 2, 0]);   // 88+9+2 = 99 está fora da tolerância (0,3 p.p.): contado, não corrigido
  assert.equal(es.cov.find(c => c.family === 3 && c.lvl === 1)!.valid, 1);
});

test('Fluxo: rejeições classificadas (identidade escolar, município, território, rede, localização, faixa, valor, duplicidade) sem corrigir o dado', () => {
  const files: FlowFile[] = [
    { family: 'TXR', level: 'escolas', year: 2023, sha256: ['a'], rows: [
      rawS('123', 'ES', 'Municipal', 'Urbana', { ap_fun: '90' }, TXR_COLS, 1), rawS('99999999', 'ES', 'Municipal', 'Urbana', { ap_fun: '90' }, TXR_COLS, 2), rawS('32000001', 'XX', 'Municipal', 'Urbana', { ap_fun: '90' }, TXR_COLS, 3),
      rawS('32000001', 'ES', 'Marte', 'Urbana', { ap_fun: '90' }, TXR_COLS, 4), rawS('32000001', 'ES', 'Municipal', 'Lua', { ap_fun: '90' }, TXR_COLS, 5), rawS('32000001', 'ES', 'Municipal', 'Urbana', { ap_fun: '120' }, TXR_COLS, 6),
      rawS('32000001', 'ES', 'Municipal', 'Urbana', { ap_fun: 'x' }, TXR_COLS, 7), rawS('32000001', 'ES', 'Municipal', 'Urbana', { ap_fun: '90' }, TXR_COLS, 8), rawS('32000001', 'ES', 'Municipal', 'Urbana', { ap_fun: '91' }, TXR_COLS, 9)] },
    { family: 'TXR', level: 'municipios', year: 2023, sha256: ['b'], rows: [rawT('1111111', 'Total', 'Total', { ap_fun: '90' })] },
    { family: 'TXR', level: 'uf', year: 2023, sha256: ['c'], rows: [rawT('Atlantida', 'Total', 'Total', { ap_fun: '90' })] },
  ];
  const s = buildFlowYear(files, ent()); const reasons = [...s.values()].flatMap(x => x.rejects.map(r => r.reason)).sort();
  assert.deepEqual(reasons, ['CHAVE_DUPLICADA', 'INEP_INVALIDO', 'LOCALIZACAO_INVALIDA', 'MUNICIPIO_INEXISTENTE', 'REDE_INVALIDA', 'SEM_IDENTIDADE_ESCOLAR', 'TERRITORIO_INEXISTENTE', 'TERRITORIO_INEXISTENTE', 'VALOR_FORA_DE_FAIXA', 'VALOR_INVALIDO']);
  const es = s.get('2023:32')!; assert.equal(es.school.length, 1); assert.equal(es.school[0]!.ap_fun, 9000); assert.ok(es.cov.find(c => c.lvl === 1)!.no_identity >= 1);
});

test('Transição: só entra no modo trn, com as quatro taxas; o modo fluxo ignora o arquivo', () => {
  const f: FlowFile[] = [{ family: 'TRN', level: 'uf', year: 2021, sha256: ['t'], rows: [rawT('Brasil', 'Total', 'Total', { pro_fun: '93.6', rep_fun: '3.2', eva_fun: '2.2', mej_fun: '1', pro_m1: '84.8' }, TRN_COLS)] }];
  const t = buildFlowYear(f, ent(), 'trn').get('2021:0')!; assert.equal(t.terr.length, 1); assert.equal(t.terr[0]!.pro_fun, 9360); assert.equal(t.terr[0]!.mej_fun, 100); assert.deepEqual([t.sumChecked, t.sumOff], [1, 0]);
  assert.equal(buildFlowYear(f, ent(), 'flow').size, 0);
  assert.notEqual(flowSliceFingerprint(['t'], t, 'trn'), flowSliceFingerprint(['u'], t, 'trn'));
});

test('Fluxo: a impressão da fatia muda com qualquer valor e com os arquivos de origem', () => {
  const mk = (x: string) => buildFlowYear([{ family: 'TXR', level: 'uf', year: 2023, sha256: ['d'], rows: [rawT('Brasil', 'Total', 'Total', { ap_fun: x })] }], ent()).get('2023:0')!;
  assert.notEqual(flowSliceFingerprint(['a'], mk('91.1'), 'flow'), flowSliceFingerprint(['a'], mk('91.2'), 'flow'));
  assert.notEqual(flowSliceFingerprint(['a'], mk('91.1'), 'flow'), flowSliceFingerprint(['b'], mk('91.1'), 'flow'));
  assert.equal(flowSliceFingerprint(['a'], mk('91.1'), 'flow'), flowSliceFingerprint(['a'], mk('91.1'), 'flow'));
});

const inse = (level: InseRaw['level'], o: Partial<InseRaw> = {}): InseRaw => ({ row: 1, year: 2023, level, uf_code: '32', uf: 'ES', ibge7: '', inep: '', dep: '0', loc: '0', cap: '0', qtd: '1000', media: '4.7512', cls: '', nv: ['0.5', '10', '20', '30', '20', '10', '8.5', '1'], ...o });
test('INSE: média ×10000 e níveis ×100 sem perda; qtd 0 com média 0 é "não calculado" (média NULL); classe romana; dep 5 e 6 do Inep convertidos ao esquema único', () => {
  assert.equal(inseClass('Nível IV'), 4); assert.equal(inseClass('Nível VIII'), 8); assert.equal(inseClass(''), null); assert.equal(inseClass('Grupo 4'), undefined);
  const files: InseFile[] = [
    { level: 'escolas', sha256: ['a'], rows: [inse('escolas', { inep: '32000001', dep: '3', loc: '1', cap: '2', cls: 'Nível IV', qtd: '30', media: '4.54' }), inse('escolas', { row: 2, inep: '99999999', dep: '3', loc: '1' })] },
    { level: 'municipios', sha256: ['b'], rows: [inse('municipios', { ibge7: '3205309', dep: '6' }), inse('municipios', { row: 2, ibge7: '3205309', dep: '3', loc: '1', qtd: '0', media: '0', nv: Array(8).fill('') })] },
    { level: 'estados', sha256: ['c'], rows: [inse('estados', { dep: '5', cap: '1' })] },
    { level: 'brasil', sha256: ['d'], rows: [inse('brasil', { uf_code: '', dep: '0' })] },
  ];
  const s = buildInseYear(files, ent()); const es = s.get('2023:32')!, nat = s.get('2023:0')!;
  assert.equal(es.school.length, 1); assert.equal(es.school[0]!.media, 45400); assert.equal(es.school[0]!.cls, 4); assert.equal(es.school[0]!.nv2, 1000);
  assert.deepEqual(es.terr.map(r => [r.entity_id, r.dep, r.loc, r.cap, r.media]), [[32, 6, 0, 1, 47512], [3205309, 3, 1, 0, null], [3205309, 5, 0, 0, 47512]]);
  assert.equal(es.terr.find(r => r.dep === 3)!.qtd, 0); assert.equal(nat.terr[0]!.entity_id, 76); assert.equal(es.lossy + nat.lossy, 0);
  assert.equal(es.rejects.map(r => r.reason).join(), 'SEM_IDENTIDADE_ESCOLAR'); assert.equal(INSE_LEVEL_COLS.length, 8);
  assert.deepEqual([es.sumChecked, es.sumOff], [3, 0]);
});

test('INSE: linha idêntica repetida (defeito do arquivo municipal de 2023) vale uma só; mesmo território com valor diferente é duplicidade; rede privada (4) é aceita', () => {
  const a = inse('municipios', { ibge7: '3205309', dep: '2', loc: '1', cap: '2' });
  const s = buildInseYear([{ level: 'municipios', sha256: ['b'], rows: [a, { ...a, row: 2 }, { ...a, row: 3 }, { ...a, row: 4, media: '4.9' }, inse('municipios', { row: 5, ibge7: '3205309', dep: '4' })] }], ent()).get('2023:32')!;
  assert.equal(s.terr.length, 2); assert.equal(s.identicalRepeats, 2); assert.deepEqual(s.rejects.map(r => r.reason), ['CHAVE_DUPLICADA']); assert.equal(s.cov[0]!.rows_in, 3);
});

test('Fluxo: "***" (sigilo estatístico do Inep) fica ausente e é contado em cells_supp; nunca vira zero nem é reconstruído', () => {
  const s = buildFlowYear([{ family: 'TRN', level: 'municipios', year: 2010, sha256: ['t'], rows: [rawT('3205309', 'Total', 'Total', { pro_fun: '90', rep_fun: '***', eva_fun: '--', mej_fun: '***' }, TRN_COLS)] }], ent(), 'trn').get('2010:32')!;
  assert.equal(s.rejects.length, 0); assert.equal(s.terr[0]!.rep_fun, null); assert.equal(s.terr[0]!.pro_fun, 9000); assert.equal(s.cov[0]!.cells_supp, 2); assert.equal(s.cov[0]!.cells_num, 1);
});

test('Fluxo: escola sem coluna de UF no arquivo (distorção 2013–2014) usa o prefixo IBGE do código da escola; sigla inválida continua rejeitada', () => {
  const s = buildFlowYear([{ family: 'TDI', level: 'escolas', year: 2013, sha256: ['a'], rows: [rawS('32000001', '', 'Estadual', 'Rural', { td_fun: '10' }, TDI_COLS, 1), rawS('32000002', 'XX', 'Estadual', 'Rural', { td_fun: '10' }, TDI_COLS, 2)] }], ent());
  assert.equal(s.get('2013:32')!.school.length, 1); assert.equal(s.get('2013:32')!.school[0]!.uf, 32); assert.deepEqual([...s.values()].flatMap(x => x.rejects.map(r => r.reason)), ['TERRITORIO_INEXISTENTE']);
});
