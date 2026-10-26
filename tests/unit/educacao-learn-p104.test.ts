import assert from 'node:assert/strict';
import test from 'node:test';
import {
  IDEB_MEASURES, SAEB_LEVEL_COLS, buildIdebYear, buildSaebYear, idebSliceFingerprint, learnKey, redeCode,
  type IdebFile, type IdebRaw, type LearnEntities, type SaebFile, type SaebRaw,
} from '../../packages/db/src/exec/index.ts';

const ent = (): LearnEntities & { uf: Map<number, { entityId: number; uf: number }>; brasil: number } => ({
  byIbge7: new Map([[3205309, { entityId: 3205309, uf: 32 }], [3550308, { entityId: 3550308, uf: 35 }]]),
  geo: new Map([['brasil', { entityId: 76, uf: 0 }], ['norte', { entityId: 1, uf: 0 }], ['espiritosanto', { entityId: 32, uf: 32 }], ['riograndedosul', { entityId: 43, uf: 43 }]]),
  ufBySigla: new Map([['ES', 32], ['SP', 35]]), schools: new Set([32000001, 32000002, 35000001]),
  uf: new Map([[32, { entityId: 32, uf: 32 }]]), brasil: 76,
});
const v = (o: Record<string, string> = {}): Record<string, string> => Object.fromEntries(IDEB_MEASURES.map(m => [m, o[m] ?? '']));
const raw = (level: IdebFile['level'], k1: string, k2: string, k3: string, rede: string, year: number, o: Record<string, string>, stage = 1, row = 1): IdebRaw => ({ row, k1, k2, k3, rede, stage, year, v: v(o) });

test('Ideb: rede e nomes de território normalizados; "Privada (1)" e abreviações de UF resolvem', () => {
  assert.equal(redeCode('Privada (1)'), 4); assert.equal(redeCode('Pública'), 5); assert.equal(redeCode('Total'), 0); assert.equal(redeCode('Marte'), undefined);
  assert.equal(learnKey('R. G. do Sul'), 'riograndedosul'); assert.equal(learnKey('Espírito Santo'), 'espiritosanto');
});

test('Ideb: escola, município, UF e Brasil publicados como vieram; vazio = NULL; meta só onde existe; cobertura por nível', () => {
  const files: IdebFile[] = [
    { level: 'escolas', sha256: ['a'], rows: [raw('escolas', 'ES', '3205309', '32000001', 'Municipal', 2023, { ap_tot: '93.1', p: '0.93', nota_media: '5.4', ideb: '5.0' }), raw('escolas', 'ES', '3205309', '32000002', 'Estadual', 2023, {}, 1, 2)] },
    { level: 'municipios', sha256: ['b'], rows: [raw('municipios', 'ES', '3205309', 'Vitória', 'Municipal', 2023, { ideb: '5.6', meta: '' }), raw('municipios', 'ES', '3205309', 'Vitória', 'Total', 2021, { ideb: '5.8', meta: '5.5' }, 1, 2)] },
    { level: 'ufs', sha256: ['c'], rows: [raw('ufs', 'Espírito Santo', '', '', 'Total', 2023, { ideb: '5.5' }), raw('ufs', 'Norte', '', '', 'Total', 2023, { ideb: '4.9' }, 1, 2)] },
    { level: 'brasil', sha256: ['d'], rows: [raw('brasil', 'Brasil', '', '', 'Total', 2023, { ideb: '5.2' })] },
  ];
  const s = buildIdebYear(files, ent(), [2023]);
  const es = s.get('2023:32')!, nat = s.get('2023:0')!;
  assert.equal(es.school.length, 1); assert.equal(es.school[0]!.uf, 32); assert.equal(es.school[0]!.ideb, 5); assert.equal(es.school[0]!.meta, null); assert.equal(es.school[0]!.ap_1, null);
  assert.equal(es.terr.length, 2); assert.deepEqual(es.terr.map(r => [r.entity_id, r.dep]), [[32, 0], [3205309, 3]]);
  assert.equal(nat.terr.length, 2); assert.deepEqual(nat.terr.map(r => r.entity_id), [1, 76]);
  assert.deepEqual(es.cov.map(c => [c.lvl, c.rows_in, c.valid, c.rejected]), [[1, 2, 1, 0], [2, 2, 2, 0]]);   // a escola só com "-" e a edição 2021 (fora do filtro) não geram linha
  assert.equal(s.get('2021:32'), undefined);
  const all = buildIdebYear(files, ent()); assert.equal(all.get('2021:32')!.terr[0]!.meta, 5.5);
});

test('Ideb: rejeições classificadas (identidade escolar, município, território, rede, faixa, valor, duplicidade) sem corrigir o dado', () => {
  const files: IdebFile[] = [{ level: 'escolas', sha256: ['a'], rows: [
    raw('escolas', 'ES', '3205309', '123', 'Municipal', 2023, { ideb: '5' }, 1, 1), raw('escolas', 'ES', '3205309', '99999999', 'Municipal', 2023, { ideb: '5' }, 1, 2), raw('escolas', 'XX', '3205309', '32000001', 'Municipal', 2023, { ideb: '5' }, 1, 3),
    raw('escolas', 'ES', '3205309', '32000001', 'Marte', 2023, { ideb: '5' }, 1, 4), raw('escolas', 'ES', '3205309', '32000001', 'Municipal', 2023, { ideb: '15' }, 1, 5), raw('escolas', 'ES', '3205309', '32000001', 'Municipal', 2023, { ideb: 'x' }, 1, 6),
    raw('escolas', 'ES', '3205309', '32000001', 'Municipal', 2023, { ideb: '5' }, 1, 7), raw('escolas', 'ES', '3205309', '32000001', 'Municipal', 2023, { ideb: '6' }, 1, 8)] },
  { level: 'municipios', sha256: ['b'], rows: [raw('municipios', 'ES', '1111111', 'X', 'Total', 2023, { ideb: '5' }), raw('municipios', 'ES', '3205309', 'Vitória', 'Total', 2023, { p: '1.5' }, 1, 2)] },
  { level: 'ufs', sha256: ['c'], rows: [raw('ufs', 'Atlantida', '', '', 'Total', 2023, { ideb: '5' })] }];
  const s = buildIdebYear(files, ent(), [2023]); const reasons = [...s.values()].flatMap(x => x.rejects.map(r => r.reason));
  assert.deepEqual(reasons.sort(), ['CHAVE_DUPLICADA', 'INEP_INVALIDO', 'MUNICIPIO_INEXISTENTE', 'REDE_INVALIDA', 'SEM_IDENTIDADE_ESCOLAR', 'TERRITORIO_INEXISTENTE', 'UF_INEXISTENTE', 'VALOR_FORA_DE_FAIXA', 'VALOR_FORA_DE_FAIXA', 'VALOR_INVALIDO'].sort());
  const es = s.get('2023:32')!; assert.ok(es.cov.find(c => c.lvl === 1)!.no_identity >= 1);
});

test('Ideb: a impressão da fatia muda com qualquer valor, e os arquivos de origem entram nela', () => {
  const mk = (id: string) => buildIdebYear([{ level: 'brasil', sha256: ['d'], rows: [raw('brasil', 'Brasil', '', '', 'Total', 2023, { ideb: id })] }], ent()).get('2023:0')!;
  assert.notEqual(idebSliceFingerprint(['a'], mk('5.2')), idebSliceFingerprint(['a'], mk('5.3'))); assert.notEqual(idebSliceFingerprint(['a'], mk('5.2')), idebSliceFingerprint(['b'], mk('5.2')));
  assert.equal(idebSliceFingerprint(['a'], mk('5.2')), idebSliceFingerprint(['a'], mk('5.2')));
});

const sraw = (level: SaebFile['level'], o: Partial<SaebRaw> = {}): SaebRaw => ({ row: 1, year: 2025, level, uf: '', ibge7: '', name: 'Brasil', dep: 'Total - Federal, Estadual, Municipal e Privada', loc: 'Total', cap: 'Total', grade: 5, subj: 'LP', media: '219.34', tx_alf: '', nv: ['2.5', '7.09', '10.8', '15.28', '18.49', '17.66', '13.91', '8.79', '3.95', '1.54', ''], ...o });

test('Saeb: média e níveis ×100 sem perda; Brasil e estados em fatias separadas; vazio = NULL; dependência "Total - …" = total', () => {
  const files: SaebFile[] = [
    { level: 'brasil', sha256: ['a'], rows: [sraw('brasil'), sraw('brasil', { row: 2, grade: 5, subj: 'MT', media: '232.32' }), sraw('brasil', { row: 3, dep: 'Estadual', loc: 'Rural', cap: 'Interior', media: '203.9' })] },
    { level: 'estados', sha256: ['b'], rows: [sraw('estados', { uf: '32', name: 'Espírito Santo', media: '230.1' })] },
    { level: 'municipios', sha256: ['c'], rows: [sraw('municipios', { uf: '32', ibge7: '3205309', name: 'Vitória', media: '245.55', cap: '', nv: Array(11).fill('') })] },
  ];
  const s = buildSaebYear(files, ent());
  const nat = s.get('2025:0')!, es = s.get('2025:32')!;
  assert.equal(nat.rows.length, 3); assert.equal(es.rows.length, 2); assert.equal(nat.lossy + es.lossy, 0);
  const b = nat.rows.find(r => r.subj === 1 && r.dep === 0)!; assert.equal(b.media, 21934); assert.equal(b.nv3, 1528); assert.equal(b.nv10, null); assert.equal(b.entity_id, 76);
  const e = nat.rows.find(r => r.dep === 2)!; assert.deepEqual([e.loc, e.cap], [2, 2]);
  const vit = es.rows.find(r => r.entity_id === 3205309)!; assert.equal(vit.media, 24555); assert.equal(vit.nv0, null);   // município sem distribuição: só a média
  assert.equal(SAEB_LEVEL_COLS.length, 11);
});

test('Saeb: precisão perdida é contada, faixa e disciplina inválidas rejeitam, repetição idêntica (alfabetização 2021) só acrescenta a taxa', () => {
  const s = buildSaebYear([{ level: 'brasil', sha256: ['a'], rows: [sraw('brasil', { grade: 2, subj: 'LP', media: '500.123', nv: Array(11).fill('') }), sraw('brasil', { row: 2, media: '2000' }), sraw('brasil', { row: 3, subj: 'XX' }), sraw('brasil', { row: 4, media: 'abc' })] }], ent());
  const n = s.get('2025:0')!; assert.equal(n.lossy, 1); assert.deepEqual(n.rejects.map(r => r.reason), ['VALOR_FORA_DE_FAIXA', 'DISCIPLINA_INVALIDA', 'VALOR_INVALIDO']);
  const two = buildSaebYear([{ level: 'brasil', sha256: ['a'], rows: [sraw('brasil', { year: 2021, grade: 2, media: '500', nv: Array(11).fill('') })] }, { level: 'brasil', sha256: ['b'], rows: [sraw('brasil', { year: 2021, grade: 2, media: '500', tx_alf: '43.59', nv: Array(11).fill('') })] }], ent()).get('2021:0')!;
  assert.equal(two.rows.length, 1); assert.equal(two.rows[0]!.tx_alf, 4359); assert.equal(two.cov.rows_in, 1);
  const conflict = buildSaebYear([{ level: 'brasil', sha256: ['a'], rows: [sraw('brasil', { media: '200' }), sraw('brasil', { row: 2, media: '201' })] }], ent()).get('2025:0')!;
  assert.deepEqual(conflict.rejects.map(r => r.reason), ['CHAVE_DUPLICADA']);
});

test('Saeb: as três linhas "Total - …" de dependência são redes distintas (0 todas, 5 pública, 6 estadual+municipal) e não colidem', () => {
  const dep = (d: string, row: number) => sraw('brasil', { row, dep: d, media: String(200 + row) });
  const s = buildSaebYear([{ level: 'brasil', sha256: ['a'], rows: [dep('Total - Federal, Estadual, Municipal e Privada', 1), dep('Total - Federal, Estadual e Municipal', 2), dep('Total - Estadual e Municipal', 3), dep('Privada', 4)] }], ent()).get('2025:0')!;
  assert.deepEqual(s.rows.map(r => r.dep).sort(), [0, 4, 5, 6]); assert.equal(s.rejects.length, 0);
});

test('Saeb: estrato sem alunos (média 0 e distribuição toda 0, marcador do arquivo 2017) fica ausente e é contado; média real continua', () => {
  const z = Array(11).fill('0');
  const s = buildSaebYear([{ level: 'estados', sha256: ['a'], rows: [sraw('estados', { uf: '32', name: 'Espírito Santo', media: '0', nv: z }), sraw('estados', { row: 2, uf: '32', name: 'Espírito Santo', grade: 9, media: '250', nv: z.map((_, i) => (i === 3 ? '100' : '0')) })] }], ent()).get('2025:32')!;
  assert.equal(s.rows.length, 1); assert.equal(s.rows[0]!.media, 25000); assert.equal(s.emptyStrata, 1); assert.equal(s.cov.rows_in, 1);
});
test('Saeb: a taxa de alfabetização que se junta a uma linha existente conta como célula publicada', () => {
  const two = buildSaebYear([{ level: 'brasil', sha256: ['a'], rows: [sraw('brasil', { year: 2021, grade: 2, media: '500', nv: Array(11).fill('') })] }, { level: 'brasil', sha256: ['b'], rows: [sraw('brasil', { year: 2021, grade: 2, media: '500', tx_alf: '43.59', nv: Array(11).fill('') })] }], ent()).get('2021:0')!;
  assert.equal(two.cov.cells_num, 2);
});
