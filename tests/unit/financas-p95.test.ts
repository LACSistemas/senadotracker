import assert from 'node:assert/strict';
import test from 'node:test';
import {
  COV, COV_CAVEAT, FIN_DCA_IDS, FIN_DEFS, FIN_RREO_IDS, FIN_SOURCE, FLAG, FUNCTIONS, buildFinSlice, checkFin, dcaIeColumn, dcaIgColumn, parseDcaIG, parseDcaIE, parseRreo02, rreoColumn,
  type FinEnteInput, type SiconfiItem,
} from '../../packages/db/src/exec/index.ts';

const dca = (conta: string, coluna: string, valor: number | null, o: Partial<SiconfiItem> = {}): SiconfiItem => ({ exercicio: 2024, cod_ibge: 3205309, anexo: 'DCA-Anexo I-E', coluna, cod_conta: 'TotalDespesas', conta, valor, ...o });
const COLS = ['Despesas Empenhadas', 'Despesas Liquidadas', 'Despesas Pagas', 'Inscrição de Restos a Pagar Não Processados', 'Inscrição de Restos a Pagar Processados'];
/** Ente típico: 3 funções (04, 06, 10), função 06 com 4 subfunções + "Demais"; total = Σ funções. Valores em reais. */
function ente(scale = 1, o: { drop06?: boolean; breakSub?: boolean } = {}): SiconfiItem[] {
  const items: SiconfiItem[] = [];
  COLS.forEach((c, i) => {
    const k = (i + 1) * scale; const f06 = 1000 * k, f04 = 5000 * k, f10 = 9000 * k;
    items.push(dca('Despesas Exceto Intraorçamentárias', c, f06 + f04 + f10 + (o.drop06 ? -f06 : 0)));
    items.push(dca('Despesas Intraorçamentárias', c, 77 * k));
    items.push(dca('04 - Administração', c, f04), dca('10 - Saúde', c, f10));
    if (!o.drop06) items.push(dca('06 - Segurança Pública', c, f06), dca('06.122 - Administração Geral', c, 600 * k), dca('06.181 - Policiamento', c, 250 * k), dca('06.182 - Defesa Civil', c, 100 * k - (o.breakSub ? 40 * k : 0)), dca('FU06 - Demais Subfunções', c, 50 * k));
  });
  return items;
}
const ids = { conta: (c: string) => c.length, col: (c: string) => c.length };
const slice = (entities: FinEnteInput[], pop = new Map<number, number>(), year = 2024) => buildFinSlice({ source: FIN_SOURCE.dcaIE, year, periodo: 0, pop, entities, ids });

test('contrato: indicadores 7001–7046 únicos, partidos entre DCA e RREO, sem agregação nem ranking, com nota de função 06 e de esferas', () => {
  assert.equal(new Set(FIN_DEFS.map(d => d.id)).size, FIN_DEFS.length); assert.ok(FIN_DEFS.every(d => d.id >= 7001 && d.id <= 7046));
  assert.equal(FIN_DCA_IDS.length + FIN_RREO_IDS.length, FIN_DEFS.length); assert.ok(FIN_DCA_IDS.every(i => !FIN_RREO_IDS.includes(i)));
  for (const d of FIN_DEFS) { assert.ok(d.note.length > 150, d.code); assert.match(d.note, /função 06|FUNÇÃO orçamentária 06/i, d.code); assert.match(d.note, /NÃO se somam|não se somam/i, d.code); }
  assert.ok(FIN_DEFS.filter(d => d.source === 'RREO').every(d => /ACUMULADOS/.test(d.note) && /50 mil/.test(d.note)));
  assert.equal(FUNCTIONS.length, 29); assert.deepEqual(FUNCTIONS.find(f => f[0] === '06'), ['06', 'Segurança Pública']);
});

test('colunas: estágios reconhecidos apesar de acento corrompido; RP processados ≠ não processados; coluna desconhecida é ignorada', () => {
  assert.equal(dcaIeColumn('Despesas Empenhadas'), 'EMP'); assert.equal(dcaIeColumn('Despesas Liquidadas'), 'LIQ'); assert.equal(dcaIeColumn('Despesas Pagas'), 'PAG');
  assert.equal(dcaIeColumn('Inscrição de Restos a Pagar Não Processados'), 'RPNP_INSC'); assert.equal(dcaIeColumn('Inscri��o de Restos a Pagar N�o Processados'), 'RPNP_INSC');
  assert.equal(dcaIeColumn('Inscrição de Restos a Pagar Processados'), 'RPP_INSC'); assert.equal(dcaIeColumn('Inscri��o de Restos a Pagar Processados'), 'RPP_INSC'); assert.equal(dcaIeColumn('Restos a Pagar Pagos'), null);
  assert.equal(rreoColumn('DOTAÇÃO INICIAL'), 'DOT_INI'); assert.equal(rreoColumn('DOTAÇÃO ATUALIZADA (a)'), 'DOT_ATU'); assert.equal(rreoColumn('DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)'), 'EMP_ATE');
  assert.equal(rreoColumn('DESPESAS EMPENHADAS NO BIMESTRE'), 'EMP_NO'); assert.equal(rreoColumn('DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)'), 'LIQ_ATE'); assert.equal(rreoColumn('SALDO (c) = (a-b)'), null); assert.equal(rreoColumn('% (b/total b)'), null);
});

test('DCA I-E: função 06, subfunções e totais; centavos exatos; intra e demais anexos ficam fora da função', () => {
  const p = parseDcaIE([...ente(), dca('06 - Segurança Pública', 'Despesas Empenhadas', 1, { anexo: 'DCA-Anexo I-D' }), dca('06 - Segurança Pública', 'Despesas Empenhadas', 2, { cod_conta: 'OutraConta' })]);
  assert.equal(p.facts.get('06|EMP'), 100000); assert.equal(p.facts.get('06.181|PAG'), 75000); assert.equal(p.facts.get('FU06|EMP'), 5000); assert.equal(p.facts.get('TOT|EMP'), 1500000); assert.equal(p.facts.get('INTRA|EMP'), 7700);
  assert.equal(p.facts.get('06|RPNP_INSC'), 400000); assert.equal(p.ignored, 2); assert.equal(p.caveats, 0);
  assert.equal(parseDcaIE([dca('06 - Segurança Pública', 'Despesas Empenhadas', 1234567.89)]).facts.get('06|EMP'), 123456789);   // sem erro de ponto flutuante
  assert.ok(![...p.facts.keys()].some(k => k.startsWith('10.')), 'subfunções de outras funções não são guardadas');
});

test('invariantes: Σ funções = total e Σ subfunções (com "Demais") = função 06; quebra vira ressalva, não ajuste', () => {
  const ok = checkFin(parseDcaIE(ente()), ['EMP', 'LIQ', 'PAG']); assert.equal(ok.caveats, 0);
  const bad = checkFin(parseDcaIE(ente(1, { breakSub: true })), ['EMP', 'LIQ', 'PAG']); assert.equal(bad.caveats & COV_CAVEAT.sumSubfunctionsNeFunction, COV_CAVEAT.sumSubfunctionsNeFunction); assert.ok(bad.detail.every(d => d.a !== d.b));
  const dup = parseDcaIE([dca('06 - Segurança Pública', 'Despesas Empenhadas', 10), dca('06 - Segurança Pública', 'Despesas Empenhadas', 11)]); assert.equal(dup.caveats & COV_CAVEAT.divergentDuplicates, COV_CAVEAT.divergentDuplicates); assert.equal(dup.facts.get('06|EMP'), 1000);
  assert.equal(parseDcaIE([dca('06 - Segurança Pública', 'Despesas Empenhadas', 10), dca('06 - Segurança Pública', 'Despesas Empenhadas', 10)]).caveats, 0);
});

test('cobertura: ausência ≠ zero; resposta vazia, declaração sem função 06, fonte indisponível e valor zero declarado são estados distintos', () => {
  const s = slice([
    { entityId: 1, status: 200, items: ente(1) }, { entityId: 2, status: 200, items: [] }, { entityId: 3, status: 200, items: ente(1, { drop06: true }) }, { entityId: 4, status: 503, items: [] },
    { entityId: 5, status: 200, items: [dca('06 - Segurança Pública', 'Despesas Empenhadas', 0), dca('04 - Administração', 'Despesas Empenhadas', 500), dca('Despesas Exceto Intraorçamentárias', 'Despesas Empenhadas', 500)] },
  ]);
  const st = new Map(s.cov.map(c => [Number(c.entity_id), Number(c.status)]));
  assert.deepEqual([...st.entries()], [[1, COV.PUBLISHED], [2, COV.NOT_REPORTED], [3, COV.DECLARED_WITHOUT_FUNCTION], [4, COV.SOURCE_UNAVAILABLE], [5, COV.PUBLISHED]]);
  const ind = (e: number, i: number) => s.indicators.find(x => x.entity_id === e && x.indicator_id === i);
  assert.equal(ind(5, 7001)?.value, 0, 'zero declarado vira zero'); assert.equal(ind(2, 7001), undefined); assert.equal(ind(3, 7001), undefined); assert.equal(ind(4, 7001), undefined);
  assert.equal(ind(5, 7031)?.value, 0); assert.equal(s.facts.filter(f => f.entity_id === 3).some(f => f.conta_id === 2), true, 'o ente sem função 06 mantém as outras funções (denominador)');
  assert.equal(s.quality.notReported, 1); assert.equal(s.quality.noFn06, 1);
});

test('indicadores DCA: estágios separados, restos inscritos fora do pago, participação, taxa de pagamento e per capita só com população do ano', () => {
  const pop = new Map([[1, 100000], [2, 15000]]);
  const s = slice([{ entityId: 1, status: 200, items: ente(1) }, { entityId: 2, status: 200, items: ente(1) }, { entityId: 3, status: 200, items: ente(1) }], pop);
  const v = (e: number, i: number) => s.indicators.find(x => x.entity_id === e && x.indicator_id === i);
  assert.equal(v(1, 7001)!.value, 1000); assert.equal(v(1, 7002)!.value, 2000); assert.equal(v(1, 7003)!.value, 3000); assert.equal(v(1, 7004)!.value, 4000); assert.equal(v(1, 7005)!.value, 5000);
  assert.equal(v(1, 7006)!.value, 15000); assert.equal(v(1, 7031)!.value, (1000 / 15000) * 100); assert.equal(v(1, 7034)!.value, 300);   // 3000 pago / 1000 empenhado (restos inscritos NÃO entram)
  assert.equal(v(1, 7032)!.value, 0.03); assert.equal(v(1, 7033)!.value, 0.01); assert.equal(v(1, 7032)!.denominator, 100000);
  assert.equal(v(3, 7032), undefined, 'sem população do ano não há per capita'); assert.equal(v(3, 7001)!.value, 1000);
  assert.equal((v(2, 7032)!.flags ?? 0) & FLAG.smallN, FLAG.smallN); assert.equal((v(1, 7032)!.flags ?? 0) & FLAG.smallN, 0);
  assert.equal(v(1, 7011)!.value, 600); assert.equal(v(1, 7013)!.value, 250); assert.equal(v(1, 7015)!.value, 100); assert.equal(v(1, 7019)!.value, 50, 'demais = FU06'); assert.equal(v(1, 7017), undefined, 'subfunção 183 ausente não vira zero');
  assert.ok(s.indicators.every(i => i.status === 2 && ((i.flags ?? 0) & FLAG.preliminary) === 0));
  assert.ok(s.indicators.every(i => FIN_DCA_IDS.includes(i.indicator_id)));
});

const rreo = (conta: string, coluna: string, valor: number, cod = 'RREO2TotalDespesas'): SiconfiItem => ({ exercicio: 2024, cod_ibge: 3205309, anexo: 'RREO-Anexo 02', coluna, cod_conta: cod, conta, valor });
function rreoEnte(): SiconfiItem[] {
  const out: SiconfiItem[] = [];
  const cols: Array<[string, number]> = [['DOTAÇÃO INICIAL', 100], ['DOTAÇÃO ATUALIZADA (a)', 200], ['DESPESAS EMPENHADAS ATÉ O BIMESTRE (b)', 150], ['DESPESAS LIQUIDADAS ATÉ O BIMESTRE (d)', 120], ['DESPESAS EMPENHADAS NO BIMESTRE', 30], ['SALDO (c) = (a-b)', 50]];
  for (const [c, k] of cols) {
    out.push(rreo('DESPESAS (EXCETO INTRA-ORÇAMENTÁRIAS) (I)', c, k * 10), rreo('Administração', c, k * 4), rreo('FU04 - Administração Geral', c, k * 4), rreo('Segurança Pública', c, k * 2),
      rreo('Policiamento', c, k), rreo('Defesa Civil', c, k / 4), rreo('Informação e Inteligência', c, k / 4), rreo('FU06 - Administração Geral', c, k / 2), rreo('Saúde', c, k * 4), rreo('FU10 - Demais Subfunções', c, k * 4),
      rreo('DESPESAS (INTRA-ORÇAMENTÁRIAS) (II)', c, 7), rreo('Segurança Pública', c, 999, 'RREO2TotalDespesasIntra'), rreo('TOTAL (III) = (I + II)', c, k * 10 + 7));
  }
  return out;
}
test('RREO Anexo 02: função pelo nome oficial, subfunções pela posição, só o bloco exceto-intra, colunas acumuladas; invariantes e execução', () => {
  const p = parseRreo02(rreoEnte());
  assert.equal(p.facts.get('06|DOT_INI'), 20000); assert.equal(p.facts.get('06.181|DOT_ATU'), 20000); assert.equal(p.facts.get('06.122|EMP_ATE'), 7500); assert.equal(p.facts.get('06.182|LIQ_ATE'), 3000);
  assert.equal(p.facts.get('INTRA|DOT_INI'), 700); assert.equal(p.facts.get('TOT|EMP_ATE'), 150000); assert.ok(!p.facts.has('06|SALDO'), 'saldo e percentuais não são guardados');
  assert.ok(![...p.facts.entries()].some(([k, v]) => k.startsWith('06|') && v === 99900), 'a função 06 do bloco intra-orçamentário não entra');
  assert.equal(p.facts.get('04|EMP_ATE'), 60000, 'a função "Administração" (04) não se confunde com a subfunção FU04 - Administração Geral'); assert.equal(p.facts.has('04.122|EMP_ATE'), false);
  assert.equal(checkFin(p, ['DOT_INI', 'DOT_ATU', 'EMP_ATE', 'LIQ_ATE', 'EMP_NO']).caveats, 0);
  const s = buildFinSlice({ source: FIN_SOURCE.rreo02, year: 2024, periodo: 6, pop: new Map(), entities: [{ entityId: 7, status: 200, items: rreoEnte() }], ids });
  const v = (i: number) => s.indicators.find(x => x.indicator_id === i)!;
  assert.equal(v(7042).value, 400); assert.equal(v(7043).value, 300); assert.equal(v(7045).value, 75); assert.equal(v(7046).value, 60); assert.ok(s.indicators.every(i => FIN_RREO_IDS.includes(i.indicator_id) && i.status === 2));
  assert.deepEqual(s.cov.map(c => [c.periodo, c.status, c.stages]), [[6, COV.PUBLISHED, 31]]);
});
test('RREO parcial (bimestre < 6): preliminar; subfunção desconhecida na função 06 vira ressalva', () => {
  const s = buildFinSlice({ source: FIN_SOURCE.rreo02, year: 2026, periodo: 4, pop: new Map(), entities: [{ entityId: 7, status: 200, items: rreoEnte() }], ids });
  assert.ok(s.indicators.every(i => i.status === 1 && ((i.flags ?? 0) & FLAG.preliminary) === FLAG.preliminary)); assert.equal(s.cov[0]!.periodo, 4);
  const odd = rreoEnte(); odd.splice(5, 0, rreo('Subfunção Inventada', 'DOTAÇÃO INICIAL', 3));
  const p = parseRreo02(odd); assert.equal(p.caveats & COV_CAVEAT.unknownLabelInFn06, COV_CAVEAT.unknownLabelInFn06); assert.deepEqual(p.unknown06, ['Subfunção Inventada']);
  assert.equal(checkFin(p, ['DOT_INI']).caveats & COV_CAVEAT.unknownLabelInFn06, COV_CAVEAT.unknownLabelInFn06);
});

test('DCA I-G (restos a pagar): colunas reconhecidas, pagos e cancelados em indicadores próprios, nunca somados às despesas pagas do exercício', () => {
  assert.equal(dcaIgColumn('Restos a Pagar Não Processados Pagos'), 'RPNP_PAG'); assert.equal(dcaIgColumn('Restos a Pagar N�o Processados Cancelados'), 'RPNP_CANC'); assert.equal(dcaIgColumn('Restos a Pagar Processados Pagos'), 'RPP_PAG');
  assert.equal(dcaIgColumn('Restos a Pagar Não Processados Inscritos em 31 de Dezembro do Exercício Anterior'), 'RPNP_I31'); assert.equal(dcaIgColumn('Restos a Pagar Processados Inscritos em Exercícios Anteriores'), 'RPP_IEA'); assert.equal(dcaIgColumn('Restos a Pagar Não Processados Liquidados'), 'RPNP_LIQ'); assert.equal(dcaIgColumn('Despesas Pagas'), null);
  const g = (conta: string, coluna: string, valor: number): SiconfiItem => ({ exercicio: 2024, cod_ibge: 1, anexo: 'DCA-Anexo I-G', coluna, cod_conta: 'TotalDespesas', conta, valor });
  const items = [g('06 - Segurança Pública', 'Restos a Pagar Não Processados Pagos', 100), g('06 - Segurança Pública', 'Restos a Pagar Processados Pagos', 40), g('06 - Segurança Pública', 'Restos a Pagar Não Processados Cancelados', 7), g('06.181 - Policiamento', 'Restos a Pagar Não Processados Pagos', 60), g('FU06 - Demais Subfunções', 'Restos a Pagar Não Processados Pagos', 40), g('Despesas Exceto Intraorçamentárias', 'Restos a Pagar Não Processados Pagos', 100), g('10 - Saúde', 'Restos a Pagar Não Processados Pagos', 0)];
  const p = parseDcaIG(items); assert.equal(p.facts.get('06|RPNP_PAG'), 10000); assert.equal(p.facts.get('06.181|RPNP_PAG'), 6000);
  const s = buildFinSlice({ source: FIN_SOURCE.dcaIG, year: 2024, periodo: 0, pop: new Map(), entities: [{ entityId: 9, status: 200, items }], ids });
  const v = (i: number) => s.indicators.find(x => x.indicator_id === i)?.value; assert.equal(v(7021), 140); assert.equal(v(7022), 7); assert.ok(s.indicators.every(i => i.indicator_id === 7021 || i.indicator_id === 7022));
  assert.equal(parseDcaIE(items).facts.size, 0, 'o Anexo I-G não vira estágio da despesa do exercício');
});
