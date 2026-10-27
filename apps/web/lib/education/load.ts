import {
  getEduContractsTerritory, getEduSuppliers, getEduWorks, getEducationMunicipalityInfra, getEducationMunicipalityOffer, getEducationNationalInfra, getEducationNationalOffer,
  getEducationOverview, getEducationSection, getEducationSeries, getEducationTeachers, getEducationTerritoryIndicators, getFlowSeries, getFlowTerritory, getIdebTerritory,
  getInseTerritory, getSaebTerritory, getTransitionTerritory,
  type FlowResult, type IdebResult, type InseResult, type SaebResult,
} from '@senadotracker/db';
import { webPostgresPool } from '@/lib/postgres-pool';
import { memo, scopeOf } from '@/lib/security/load';
import type { Kpi } from '@/lib/security/types';
import { brlShort, compact, fmt } from '@/lib/security/format';
import {
  FLOW_MEASURES, FLOW_STAGES, IDEB_STAGES, INFRA_ITEMS, REDES, SAEB_GRADES, SUBJECTS, PROGRAMS, STAGE_LABEL, SITUACAO_OBRA_ORDER,
} from './catalog';
import { bars, chart, compareSeries, deltaText, explorer, lastOf, nameOf, pick, prevOf, stat, table, type YV } from './build';
import { narrative } from './narrative';
import type { DistBar, EduScope, EducationPageData, Explorer, ExplorerView } from './types';

type Key = { ibge7?: string; ufCode?: number };
type Loose = Record<string, any>; // payloads heterogêneos das leituras de oferta/infra/indicadores: lidos campo a campo, com checagem

const SRC = {
  saeb: 'INEP, Saeb (resultados agregados 2017–2025)', ideb: 'INEP, Ideb 2005–2025', flow: 'INEP, Indicadores Educacionais (rendimento e distorção)',
  inse: 'INEP, Indicador de Nível Socioeconômico', censo: 'INEP, Censo Escolar', pncp: 'PNCP (contratos)', obras: 'Obrasgov',
};

/** Leitura que nunca derruba a página: registra o erro e devolve null (a UI então diz "sem dado", e o log mostra o motivo). */
async function read<T>(name: string, errors: string[], fn: () => Promise<T>): Promise<T | null> {
  try { return await fn(); } catch (error) { errors.push(name); console.error(`education read failed: ${name}`, error); return null; }
}

async function keyFor(scope: EduScope): Promise<Key> {
  if (scope.kind === 'uf') return { ufCode: scope.ufCode };
  const row = (await webPostgresPool().query('SELECT ibge7::text FROM civica_exec.exec_entity WHERE entity_id=$1 AND kind=4', [scope.entityId])).rows[0];
  return { ibge7: String(row?.ibge7 ?? scope.entityId).padStart(7, '0') };
}

// ---------------------------------------------------------------- séries a partir das leituras
const yearsOf = (rows: Array<{ year: number }>): number[] => [...new Set(rows.map(r => r.year))].sort((a, b) => a - b);
const saebSeries = (r: SaebResult | null, subj: number, grade: number, dep: number): YV[] => r ? r.rows.filter(x => x.subj === subj && x.grade === grade && x.dep === dep && x.loc === 0 && x.cap === 0).map(x => ({ year: x.year, value: x.media })) : [];
const idebSeries = (r: IdebResult | null, stage: number, dep: number, field: string): YV[] => r ? r.rows.filter(x => x.stage === stage && x.dep === dep).map(x => ({ year: x.year, value: x.values[field] ?? null })) : [];
const flowSeries = (rows: Array<{ year: number; values: Record<string, number | null> }> | null, code: string): YV[] => (rows ?? []).map(x => ({ year: x.year, value: x.values[code] ?? null }));
const hasData = (rows: YV[]): boolean => rows.some(r => r.value != null);
const unitPts = (v: number, d = 1) => `${fmt(v, d)} pontos`;

function cmpLine(own: YV[], uf: YV[] | null, br: YV[] | null, scope: EduScope, d: number, suffix: string): string | null {
  const l = lastOf(own); if (!l) return null; const at = (rows: YV[] | null) => rows?.find(r => r.year === l.year)?.value ?? null; const parts: string[] = [];
  const u = at(uf); const b = at(br);
  if (scope.kind === 'municipio' && u != null) parts.push(`${scope.stateName}: ${fmt(u, d)}${suffix}`);
  if (b != null) parts.push(`Brasil: ${fmt(b, d)}${suffix}`);
  return parts.length ? parts.join(' · ') : null;
}
/** Frase de posição frente à referência: descreve, nunca classifica como bom ou ruim. */
function versus(v: number, ref: number | null, refName: string, d: number, unit: string, tol: number): string | null {
  if (ref == null) return null; const diff = v - ref;
  return Math.abs(diff) <= tol ? `Em linha com ${refName} (${fmt(ref, d)}${unit}).` : `${diff > 0 ? 'Acima' : 'Abaixo'} de ${refName} (${fmt(ref, d)}${unit}) em ${fmt(Math.abs(diff), d)}${unit === '%' ? ' p.p' : ' pontos'}.`;
}

export async function loadEducationPage(scope: EduScope, selectedYear = 2025): Promise<EducationPageData> {
  const pool = webPostgresPool(); const errors: string[] = []; const key = await keyFor(scope); const isMuni = scope.kind === 'municipio';
  const ufKey: Key = { ufCode: scope.ufCode }; const brKey: Key = {};
  const R = <T,>(n: string, fn: () => Promise<T>) => read(n, errors, fn);
  const FLOW_CODES = FLOW_MEASURES.flatMap(m => FLOW_STAGES.map(s => `${m.value}_${s.value}`));
  const overview = await R('overview', () => getEducationOverview(pool, key, selectedYear) as Promise<Loose | null>);
  const year = Number(overview?.year ?? selectedYear);
  const [saeb, saebUf, saebBr, ideb, idebUf, idebBr, flow, flowUf, flowBr, flowCut, trn, inse, inseUf, inseBr] = await Promise.all([
    R('saeb', () => getSaebTerritory(pool, key)), isMuni ? R('saebUf', () => getSaebTerritory(pool, ufKey)) : Promise.resolve(null), R('saebBr', () => getSaebTerritory(pool, brKey)),
    R('ideb', () => getIdebTerritory(pool, key)), isMuni ? R('idebUf', () => getIdebTerritory(pool, ufKey)) : Promise.resolve(null), R('idebBr', () => getIdebTerritory(pool, brKey)),
    R('flow', () => getFlowSeries(pool, { ...key, codes: FLOW_CODES })), isMuni ? R('flowUf', () => getFlowSeries(pool, { ...ufKey, codes: FLOW_CODES })) : Promise.resolve(null), R('flowBr', () => getFlowSeries(pool, { ...brKey, codes: FLOW_CODES })),
    R('flowCut', () => getFlowTerritory(pool, { ...key })), R('trn', () => getTransitionTerritory(pool, key)),
    R('inse', () => getInseTerritory(pool, key)), isMuni ? R('inseUf', () => getInseTerritory(pool, ufKey)) : Promise.resolve(null), R('inseBr', () => getInseTerritory(pool, brKey)),
  ]);
  const [offer, infra, infraUf, infraBr, indicators, teachers, enrollment] = await Promise.all([
    R('offer', () => (isMuni ? getEducationMunicipalityOffer(pool, key.ibge7!, { year, series: false }) : getEducationNationalOffer(pool, { year, ufCode: scope.ufCode })) as Promise<Loose | null>),
    R('infra', () => (isMuni ? getEducationMunicipalityInfra(pool, key.ibge7!, { year, series: true }) : getEducationNationalInfra(pool, { year, ufCode: scope.ufCode, series: true })) as Promise<Loose | null>),
    isMuni ? R('infraUf', () => getEducationNationalInfra(pool, { year, ufCode: scope.ufCode, series: true }) as Promise<Loose | null>) : Promise.resolve(null),
    R('infraBr', () => getEducationNationalInfra(pool, { year, series: true }) as Promise<Loose | null>),
    R('indicators', () => getEducationTerritoryIndicators(pool, { ...key, year, series: true }) as Promise<Loose | null>),
    R('teachers', () => getEducationTeachers(pool, { ...key, year }) as Promise<Loose | null>),
    R('enrollment', () => getEducationSeries(pool, { ...key, indicator: 'edu.enrollment.total', limit: 100 })),
  ]);
  const contractKey: Key = isMuni ? { ibge7: key.ibge7! } : { ufCode: scope.ufCode };
  const [contracts, suppliers, works, finance] = await Promise.all([
    R('contracts', () => getEduContractsTerritory(pool, contractKey)), R('suppliers', () => getEduSuppliers(pool, { ...contractKey, limit: 5 })),
    R('works', () => getEduWorks(pool, { ufCode: scope.ufCode, limit: 60 })), R('finance', () => getEducationSection(pool, { ...key, section: 'finance', year }) as Promise<Loose | null>),
  ]);

  // ======================================================================= Aprendizagem
  const redesIn = (r: SaebResult | null) => new Set((r?.rows ?? []).filter(x => x.loc === 0 && x.cap === 0).map(x => String(x.dep)));
  const sbRedes = redesIn(saeb); const sbGrades = new Set((saeb?.rows ?? []).map(x => String(x.grade)));
  const saebDims = [
    { id: 'subj', label: 'Disciplina', options: SUBJECTS.map(s => ({ value: s.value, label: s.label })) },
    { id: 'grade', label: 'Etapa', options: pick(SAEB_GRADES, v => sbGrades.has(v)) },
    { id: 'rede', label: 'Rede', options: pick(REDES, v => sbRedes.has(v)) },
  ];
  const saebExplorer = saeb ? explorer('saeb', saebDims, ([subj, grade, rede]) => {
    const s = Number(subj), g = Number(grade), d = Number(rede); const own = saebSeries(saeb, s, g, d); if (!hasData(own)) return null;
    const uf = saebSeries(saebUf, s, g, d), br = saebSeries(saebBr, s, g, d); const subjName = SUBJECTS.find(x => x.value === subj)!.lower; const gradeName = SAEB_GRADES.find(x => x.value === grade)!.label; const redeName = REDES.find(x => x.value === rede)!.label.toLowerCase();
    const l = lastOf(own)!; const p = prevOf(own, l); const bl = br.find(r => r.year === l.year)?.value ?? null; const ul = uf.find(r => r.year === l.year)?.value ?? null;
    const ref = isMuni ? ul : bl; const refName = isMuni ? scope.stateName : 'o Brasil';
    const headline = `Em ${l.year}, a média em ${subjName} no ${gradeName} (${redeName}) foi ${unitPts(l.value!)}${p ? `, contra ${fmt(p.value!, 1)} em ${p.year}` : ''}. ${versus(l.value!, ref, refName, 1, '', 1) ?? ''}`.trim();
    const row = saeb.rows.find(x => x.subj === s && x.grade === g && x.dep === d && x.loc === 0 && x.cap === 0 && x.year === l.year);
    const brRow = saebBr?.rows.find(x => x.subj === s && x.grade === g && x.dep === d && x.loc === 0 && x.cap === 0 && x.year === l.year);
    const dist = row ? { title: `Como os alunos se distribuem pelos níveis de proficiência (${l.year})`, caption: 'Cada barra é o percentual de alunos em um nível. Níveis mais altos indicam mais conhecimento. A linha marca o Brasil.', refLabel: brRow ? 'Brasil' : null,
      bars: row.niveis.map((v, i): DistBar | null => v == null ? null : { label: `Nível ${i}`, value: v, ref: brRow?.niveis[i] ?? null }).filter((x): x is DistBar => x != null) } : undefined;
    return { chart: chart({ id: `saeb-${subj}-${grade}-${rede}`, title: `${SUBJECTS.find(x => x.value === subj)!.label}: média no Saeb, ${gradeName}`, unit: 'pontos', digits: 1, stepYears: 2, zoom: true, series: compareSeries(scope, { own, uf: isMuni ? uf : null, br }),
      notes: ['A prova é aplicada a amostras de alunos, a cada dois anos, e a média está numa escala própria desta série e disciplina.', 'Não compare o 5º ano com o 9º ano nem Matemática com Língua Portuguesa: as escalas são diferentes.'], source: SRC.saeb, coverage: redeName }),
      headline, note: 'Escala própria de cada série e disciplina.', dist: dist && dist.bars.length ? dist : undefined } satisfies ExplorerView;
  }, 'Não há resultado do Saeb publicado para esta combinação neste território.') : null;

  const idRedes = new Set((ideb?.rows ?? []).map(x => String(x.dep))); const idStages = new Set((ideb?.rows ?? []).map(x => String(x.stage)));
  const idebDims = [{ id: 'stage', label: 'Etapa', options: pick(IDEB_STAGES, v => idStages.has(v)) }, { id: 'rede', label: 'Rede', options: pick(REDES, v => idRedes.has(v)) }];
  const idebExplorer = ideb ? explorer('ideb', idebDims, ([stage, rede]) => {
    const st = Number(stage), d = Number(rede); const own = idebSeries(ideb, st, d, 'ideb'); if (!hasData(own)) return null;
    const uf = idebSeries(idebUf, st, d, 'ideb'), br = idebSeries(idebBr, st, d, 'ideb'); const goal = idebSeries(ideb, st, d, 'meta'); const l = lastOf(own)!; const p = prevOf(own, l);
    const series = compareSeries(scope, { own, uf: isMuni ? uf : null, br }); if (hasData(goal)) series.push({ key: 'meta', label: 'Meta (até 2021)', color: 'amber', dash: true, points: goal.map(r => ({ t: String(r.year), v: r.value, state: r.value == null ? 'absent' : 'ok' })) });
    const mt = idebSeries(ideb, st, d, 'nota_mt').filter(r => r.value != null).at(-1); const lp = idebSeries(ideb, st, d, 'nota_lp').filter(r => r.value != null).at(-1);
    const stageName = IDEB_STAGES.find(x => x.value === stage)!.label; const ref = (isMuni ? uf : br).find(r => r.year === l.year)?.value ?? null;
    return { chart: chart({ id: `ideb-${stage}-${rede}`, title: `Ideb: ${stageName}`, unit: 'nota de 0 a 10', digits: 1, stepYears: 2, zoom: true, series, notes: ['Ideb = nota nas provas (Saeb) × aprovação dos alunos. Não é a média das escolas.', 'A meta oficial existe só até 2021.'], source: SRC.ideb, coverage: REDES.find(x => x.value === rede)!.label.toLowerCase() }),
      headline: `O Ideb ${stageName.toLowerCase()} em ${l.year} foi ${fmt(l.value!, 1)}${p ? ` (era ${fmt(p.value!, 1)} em ${p.year})` : ''}. ${versus(l.value!, ref, isMuni ? scope.stateName : 'o Brasil', 1, '', 0.2) ?? ''}${mt ? ` Nota média em matemática: ${fmt(mt.value!, 0)} pontos${lp ? `; em português: ${fmt(lp.value!, 0)}` : ''} (${mt.year}).` : ''}`.trim(), note: null } satisfies ExplorerView;
  }, 'Não há Ideb publicado para esta combinação.') : null;
  const alfRows = (r: SaebResult | null) => (r?.rows ?? []).filter(x => x.grade === 2 && x.alfabetizacao != null && x.dep === 0 && x.loc === 0 && x.cap === 0);
  const alfEd = [...new Set(alfRows(saeb).map(x => x.year))];
  const alfTable = alfEd.length ? table('Alfabetização no 2º ano (Saeb)', ['Edição', nameOf(scope), ...(isMuni ? [scope.stateName] : []), 'Brasil'], alfEd.map(y => [String(y), [`${fmt(alfRows(saeb).find(x => x.year === y)!.alfabetizacao!, 1)}%`, ...(isMuni ? [alfRows(saebUf).find(x => x.year === y)?.alfabetizacao != null ? `${fmt(alfRows(saebUf).find(x => x.year === y)!.alfabetizacao!, 1)}%` : null] : []), alfRows(saebBr).find(x => x.year === y)?.alfabetizacao != null ? `${fmt(alfRows(saebBr).find(x => x.year === y)!.alfabetizacao!, 1)}%` : null]]), 'Percentual de crianças alfabetizadas. É uma estimativa por amostra: em 2023 a margem de erro é grande nas UFs e nos municípios, então não use para comparar territórios.') : null;

  // ======================================================================= Trajetória
  const flowDims = [{ id: 'm', label: 'O que medir', options: FLOW_MEASURES.map(m => ({ value: m.value, label: m.label })) }, { id: 's', label: 'Etapa', options: FLOW_STAGES.map(s => ({ value: s.value, label: s.label })) }];
  const flowExplorer = flow?.length ? explorer('flow', flowDims, ([m, s]) => {
    const code = `${m}_${s}`; const own = flowSeries(flow, code); if (!hasData(own)) return null; const uf = flowSeries(flowUf, code), br = flowSeries(flowBr, code);
    const meas = FLOW_MEASURES.find(x => x.value === m)!; const stg = FLOW_STAGES.find(x => x.value === s)!; const l = lastOf(own)!; const p = prevOf(own, l); const ref = (isMuni ? uf : br).find(r => r.year === l.year)?.value ?? null;
    const note = m === 'td' ? 'Distorção = alunos com 2 anos ou mais de atraso na série. Não é a mesma coisa que reprovação.' : m === 'ab' ? 'Abandono = alunos que saíram da escola antes do fim do ano. Abandono, reprovação e aprovação somam cerca de 100%.' : null;
    return { chart: chart({ id: `flow-${code}`, title: `${meas.label} ${stg.lower}`, unit: '%', digits: 1, series: compareSeries(scope, { own, uf: isMuni ? uf : null, br }), notes: [note ?? 'Aprovação, reprovação e abandono somam cerca de 100% dos alunos.', 'Taxas oficiais do INEP, publicadas por ano letivo; não são recalculadas.'], source: SRC.flow, coverage: 'rede total' }),
      headline: `Em ${l.year}, ${fmt(l.value!, 1)}% dos alunos ${stg.lower} ${meas.verb}${p ? ` (eram ${fmt(p.value!, 1)}% em ${p.year})` : ''}. ${versus(l.value!, ref, isMuni ? scope.stateName : 'o Brasil', 1, '%', 0.2) ?? ''}`.trim(), note } satisfies ExplorerView;
  }, 'Não há taxa publicada para esta combinação neste território.') : null;
  const cutRows = (flowCut?.cuts ?? []).filter(c => (c.dep !== 1) && ((c.loc === 0 && [0, 2, 3, 4].includes(c.dep)) || (c.dep === 0 && c.loc !== 0)));
  const cv = (c: { values: Array<{ code: string; value: number | null }> }, code: string) => { const v = c.values.find(x => x.code === code)?.value; return v == null ? null : `${fmt(v, 1)}%`; };
  const breakdown = cutRows.length ? table(`Por rede e localização (${flowCut!.cuts[0]!.year})`, ['Abandono (fund.)', 'Reprovação (fund.)', 'Aprovação (fund.)', 'Distorção (anos finais)'],
    cutRows.map(c => [`${c.depLabel}${c.loc !== 0 ? ` · ${c.locLabel}` : ''}`, [cv(c, 'ab_fun'), cv(c, 'rp_fun'), cv(c, 'ap_fun'), cv(c, 'td_af')]]), 'Cada linha é um recorte oficial do INEP. Recorte sem número = a fonte não divulgou (poucos alunos ou sigilo).') : null;
  const tr = trn?.series.at(-1); const trStats: ReturnType<typeof stat>[] = [];
  if (tr) for (const [lab, st] of [['fundamental', 'fun'], ['ensino médio', 'med']] as const) for (const [name, m] of [['Passaram de ano', 'pro'], ['Repetiram', 'rep'], ['Deixaram a escola', 'eva']] as const) { const v = tr.values[`${m}_${st}`]; if (v != null) trStats.push(stat(`${name} · ${lab}`, `${fmt(v, 1)}%`)); }

  // ======================================================================= Contexto (INSE)
  const inseRows = (r: InseResult | null): YV[] => (r?.rows ?? []).filter(x => x.dep === 0 && x.loc === 0 && x.cap === 0).map(x => ({ year: x.year, value: x.media }));
  const inseOwn = inseRows(inse); const inseLast = inse?.rows.filter(x => x.dep === 0 && x.loc === 0 && x.cap === 0).at(-1);
  const insePts = (rows: YV[]) => rows.filter(r => r.year >= 2021);
  const inseChart = chart({ id: 'inse', title: 'Nível socioeconômico médio dos alunos (INSE)', unit: 'escala 1 a 8', digits: 2, stepYears: 2, zoom: true, series: compareSeries(scope, { own: insePts(inseOwn), uf: isMuni ? insePts(inseRows(inseUf)) : null, br: insePts(inseRows(inseBr)) }), notes: ['O INSE descreve o contexto das famílias, não a qualidade da escola.', 'A edição de 2019 usa outra escala e não entra no gráfico.'], source: SRC.inse, coverage: '2021 e 2023' });
  const inseClasses = inseLast ? bars(inseLast.niveis.map((v, i) => ({ label: `Nível ${i + 1}`, value: v, display: v == null ? '' : `${fmt(v, 1)}%` }))) : [];

  // ======================================================================= Rede
  const totals = (offer?.totals ?? {}) as Loose; const enr: YV[] = (enrollment ?? []).map((r: Loose) => ({ year: Number(r.year), value: r.value == null ? null : Number(r.value) })).sort((a, b) => a.year - b.year);
  const enrLast = lastOf(enr); const enr5 = enrLast ? enr.find(r => r.year === enrLast.year - 5 && r.value != null) ?? null : null;
  const enrChart = chart({ id: 'enrollment', title: 'Matrículas na educação básica', unit: 'alunos', digits: 0, series: [{ key: 'own', label: nameOf(scope), color: 'primary', points: enr.map(r => ({ t: String(r.year), v: r.value, state: r.value == null ? 'absent' : 'ok' })) }], notes: ['Matrícula é um vínculo aluno–turma na data do Censo Escolar; um aluno pode ter mais de uma.'], source: SRC.censo, coverage: 'escolas com oferta no ano' });
  const stageBars = bars(((offer?.stages ?? []) as Loose[]).map(s => ({ label: String(s.label), value: s.matriculas == null ? null : Number(s.matriculas), display: s.matriculas == null ? '' : fmt(Number(s.matriculas)) })));
  const depBars = bars(((offer?.byDependency ?? []) as Loose[]).map(s => ({ label: String(s.label), value: s.matriculas == null ? null : Number(s.matriculas), display: s.matriculas == null ? '' : fmt(Number(s.matriculas)) })));
  const sp = (offer?.special ?? {}) as Loose; const spStats = [
    sp.tempoIntegral?.total != null && stat('Em tempo integral', fmt(sp.tempoIntegral.total), 'matrículas'), sp.educacaoEspecial?.total != null && stat('Educação especial', fmt(sp.educacaoEspecial.total), 'matrículas'),
    sp.educacaoProfissionalTotal != null && stat('Educação profissional', fmt(sp.educacaoProfissionalTotal), 'matrículas'), sp.ead != null && stat('Ensino a distância', fmt(sp.ead), 'matrículas'),
  ].filter((x): x is ReturnType<typeof stat> => !!x);

  // ======================================================================= Estrutura
  const infraItems = ((infra?.itens ?? []) as Loose[]); const infraSeries = (r: Loose | null, code: string): YV[] => ((r?.series ?? []) as Loose[]).map(s => ({ year: Number(s.year), value: s.itens?.[code]?.pct == null ? null : Number(s.itens[code].pct) }));
  const infraBars = INFRA_ITEMS.map(i => { const it = infraItems.find(x => x.code === i.code && x.available); return it?.pct == null ? null : { label: i.label, value: Number(it.pct), display: `${fmt(Number(it.pct), 0)}%`, note: i.group }; }).filter((x): x is NonNullable<typeof x> => !!x);
  const infraDims = [{ id: 'item', label: 'Item', options: INFRA_ITEMS.filter(i => hasData(infraSeries(infra, i.code))).map(i => ({ value: i.code, label: i.label })) }];
  const infraExplorer = infraDims[0]!.options.length ? explorer('infra', infraDims, ([code]) => {
    const own = infraSeries(infra, code!); const label = INFRA_ITEMS.find(i => i.code === code)!.label; const l = lastOf(own); if (!l) return null; const uf = infraSeries(isMuni ? infraUf : null, code!), br = infraSeries(infraBr, code!);
    const it = infraItems.find(x => x.code === code);
    return { chart: chart({ id: `infra-${code}`, title: `Escolas com ${label.toLowerCase()}`, unit: '% das escolas', digits: 0, yMax: 100, series: compareSeries(scope, { own, uf: isMuni ? uf : null, br }), notes: ['Informação autodeclarada pela escola no Censo Escolar; o percentual considera só as que responderam.', it?.comparability === 'COMPARABLE_WITH_CAVEATS' ? 'A pergunta mudou ao longo do tempo (quebra em 2019): compare as edições com cautela.' : 'Pergunta comparável entre as edições.'], source: SRC.censo, coverage: 'escolas ativas' }),
      headline: `Em ${l.year}, ${fmt(l.value!, 0)}% das escolas têm ${label.toLowerCase()}. ${versus(l.value!, (isMuni ? uf : br).find(r => r.year === l.year)?.value ?? null, isMuni ? scope.stateName : 'o Brasil', 0, '%', 1) ?? ''}`.trim(), note: null } satisfies ExplorerView;
  }, 'Sem série publicada para este item.') : null;

  // ======================================================================= Professores
  const meds = (((indicators?.recortes ?? []) as Loose[]).find(r => r.dep === 0 && r.loc === 0)?.medidas ?? []) as Loose[]; const med = (code: string): number | null => { const v = meds.find(m => m.code === code)?.value; return v == null ? null : Number(v); };
  const docs = ((teachers?.docentes ?? []) as Loose[]).find(d => d.code === 'doc_total'); const docSeries: YV[] = ((teachers?.series ?? []) as Loose[]).map(s => ({ year: Number(s.year), value: s.docentes == null ? null : Number(s.docentes) }));
  const docChart = chart({ id: 'docentes', title: 'Professores da educação básica', unit: 'docentes', digits: 0, series: [{ key: 'own', label: nameOf(scope), color: 'primary', points: docSeries.map(r => ({ t: String(r.year), v: r.value, state: r.value == null ? 'absent' : 'ok' })) }], notes: ['Docentes distintos (cada professor conta uma vez, mesmo em várias escolas).'], source: SRC.censo, coverage: '' });
  const afdBars = meds.filter(m => /^afd_fun[1-5]$/.test(String(m.code)) && m.value != null).map(m => ({ label: String(m.label).replace(/^.*?— ?/, ''), value: Number(m.value), display: `${fmt(Number(m.value), 1)}%` }));
  const atuRows: Array<[string, Array<string | null>]> = [['Creche', 'atu_cre'], ['Pré-escola', 'atu_pre'], ['Anos iniciais', 'atu_ai'], ['Anos finais', 'atu_af'], ['Ensino médio', 'atu_med']].map(([l, c]) => [l!, [med(c!) != null ? fmt(med(c!)!, 1) : null, med(c!.replace('atu', 'had')) != null ? fmt(med(c!.replace('atu', 'had'))!, 1) : null]] as [string, Array<string | null>]).filter(([, c]) => c[0] != null);
  const teacherTable = table('Condições de ensino por etapa', ['Alunos por turma', 'Horas-aula por dia'], atuRows, 'Média de alunos por turma e de horas-aula diárias, indicadores oficiais do INEP para o total das redes.');

  // ======================================================================= Dinheiro, contratos e obras
  const cByYear = contracts?.byYear ?? []; const cTot = contracts?.total.highAndConfirmed;
  const contractsChart = contracts ? chart({ id: 'contratos', title: 'Valor contratado por ano (contratos de educação)', unit: 'R$ milhões', digits: 1, series: [{ key: 'own', label: nameOf(scope), color: 'primary', points: cByYear.map(r => ({ t: String(r.year), v: r.contractedValue / 1e6, state: r.year >= 2026 ? 'partial' : 'ok' })) }], notes: ['É o valor CONTRATADO nos contratos publicados no PNCP: não é o valor pago nem o que foi entregue.', '2026 está incompleto.'], source: SRC.pncp, coverage: 'alta confiança + oficial' }) : null;
  const catMap = new Map<number, { label: string; v: number; n: number }>(); for (const c of contracts?.byCategory ?? []) if (c.confidence <= 2) { const e = catMap.get(c.category) ?? { label: c.categoryLabel, v: 0, n: 0 }; e.v += c.contractedValue; e.n += c.contracts; catMap.set(c.category, e); }
  const categories = [...catMap.values()].sort((a, b) => b.v - a.v).slice(0, 8).map(e => ({ label: e.label, value: e.v, display: `${brlShort(e.v)} · ${fmt(e.n)} contratos` }));
  const contractStats = cTot ? [stat('Contratos de educação', fmt(cTot.contracts), 'contratos'), stat('Valor contratado', brlShort(cTot.contractedValue), undefined, 'soma dos contratos com valor; não é gasto'), contracts!.total.possible.contracts ? stat('Indício fraco (à parte)', fmt(contracts!.total.possible.contracts), 'contratos', 'não entram nos totais') : null].filter((x): x is ReturnType<typeof stat> => !!x) : [];
  const supplierTable = suppliers?.rows.length ? table('Maiores fornecedores (valor contratado)', ['Contratos', 'Valor contratado'], suppliers.rows.map(r => [r.name, [fmt(r.contracts), brlShort(r.contractedValue)]]), 'Pessoas jurídicas identificadas pelo CNPJ. Pessoa física não é exibida.') : null;
  const schoolWorks = (works?.rows ?? []).filter(w => w.eduBasis !== 1).slice(0, 6);   // só obras com marcador escolar no nome ou contrato de educação ligado pelo CIPI; obra só "de órgão de educação" pode ser rodovia ou campus
  const worksTable = schoolWorks.length ? table(`Obras de escolas em ${scope.uf} (Obrasgov)`, ['Situação', 'Valor previsto', 'Execução física'], schoolWorks.map(w => [w.name, [w.situacao, w.plannedValue != null && !w.placeholderValue ? brlShort(w.plannedValue) : '—', w.physicalPercent != null ? `${w.physicalPercent}%` : '—']]), 'Valor previsto "—" = o cadastro não informa valor real. Só aparecem obras com indício escolar no nome ou em contrato de educação. Empenho não é pagamento.') : null;
  const programRows = ((overview?.programs ?? []) as Loose[]).filter(p => p.amountCents != null); const programTable = programRows.length ? table(`Repasses federais (${year})`, ['Situação', 'Valor'], programRows.map(p => [PROGRAMS[String(p.program)] ?? String(p.program), [STAGE_LABEL[String(p.stage)] ?? String(p.stage), brlShort(Number(p.amountCents) / 100)]]), 'Só o ano de 2025 está publicado. Fonte e situação do pagamento nunca são somadas.') : null;
  const finRows = (Array.isArray(finance) ? finance : (finance?.rows ?? finance?.items ?? [])) as Loose[]; const financeTable = finRows.length && finRows[0]?.amountCents != null ? table('Despesa em educação (Siconfi)', ['Fonte', 'Valor'], finRows.slice(0, 6).map(f => [STAGE_LABEL[String(f.stage)] ?? String(f.stage), [String(f.source ?? ''), brlShort(Number(f.amountCents) / 100)]]), 'Empenhado, liquidado e pago são etapas do mesmo gasto: nunca se somam.') : null;
  const worksNote = schoolWorks.length ? null : works ? 'Há obras cadastradas no Obrasgov para esta UF, mas nenhuma com indício escolar suficiente para listar aqui.' : 'As obras de educação desta UF ainda não foram coletadas do Obrasgov; só algumas UFs têm cobertura.';

  // ======================================================================= Narrativas, KPIs e página
  const N = narrative({ scope, year, errors, enr, enrLast, enr5, totals, saebExplorer, idebExplorer, flowExplorer, saeb, ideb, flow, infraBars, docs, cTot, contracts, catTop: categories[0] ?? null, inseLast, tr });
  const kpis: Kpi[] = [];
  const mathOwn = saebSeries(saeb, 2, 5, [0, 5, 3, 2].find(d => hasData(saebSeries(saeb, 2, 5, d))) ?? 0); const mathBr = saebSeries(saebBr, 2, 5, [0, 5, 3, 2].find(d => hasData(saebSeries(saeb, 2, 5, d))) ?? 0); const mathUf = saebSeries(saebUf, 2, 5, 0);
  const mathL = lastOf(mathOwn); if (mathL) { const p = prevOf(mathOwn, mathL); kpis.push({ id: 'matematica', label: 'Matemática · 5º ano', plain: 'Média dos alunos do 5º ano na prova nacional (Saeb)', value: fmt(mathL.value!, 0), unit: 'pontos na escala do Saeb', basis: `Saeb ${mathL.year}`, chapter: 'aprendizagem', delta: p ? deltaText(mathL.value!, p.value!, p.year, 'pontos', 0) : null, compare: null, ruler: null, spark: mathOwn.filter(r => r.value != null).map(r => r.value!), sparkLabel: 'edições do Saeb', secondary: cmpLine(mathOwn, mathUf, mathBr, scope, 0, ''), caveat: 'Escala própria desta série e disciplina.', source: 'INEP/Saeb', state: 'ok' }); }
  const idOwn = idebSeries(ideb, 1, [5, 0, 3, 2].find(d => hasData(idebSeries(ideb, 1, d, 'ideb'))) ?? 0, 'ideb'); const idD = [5, 0, 3, 2].find(d => hasData(idebSeries(ideb, 1, d, 'ideb'))) ?? 0; const idL = lastOf(idOwn);
  if (idL) { const p = prevOf(idOwn, idL); kpis.push({ id: 'ideb', label: 'Ideb · anos iniciais', plain: 'Nota de 0 a 10 que junta a prova nacional e a aprovação', value: fmt(idL.value!, 1), unit: 'de 10', basis: `Ideb ${idL.year}`, chapter: 'aprendizagem', delta: p ? deltaText(idL.value!, p.value!, p.year, 'pontos', 1) : null, compare: null, ruler: null, spark: idOwn.filter(r => r.value != null).map(r => r.value!), sparkLabel: 'edições do Ideb', secondary: cmpLine(idOwn, idebSeries(idebUf, 1, idD, 'ideb'), idebSeries(idebBr, 1, idD, 'ideb'), scope, 1, ''), caveat: null, source: 'INEP/Ideb', state: 'ok' }); }
  const abOwn = flowSeries(flow, 'ab_fun'); const abL = lastOf(abOwn);
  if (abL) { const p = prevOf(abOwn, abL); kpis.push({ id: 'abandono', label: 'Abandono · fundamental', plain: 'Alunos que saíram da escola antes do fim do ano', value: `${fmt(abL.value!, 1)}%`, unit: 'dos alunos do ensino fundamental', basis: `ano letivo ${abL.year}`, chapter: 'trajetoria', delta: p ? deltaText(abL.value!, p.value!, p.year, 'p.p.', 1) : null, compare: null, ruler: null, spark: abOwn.filter(r => r.value != null).map(r => r.value!), sparkLabel: 'série histórica', secondary: cmpLine(abOwn, flowSeries(flowUf, 'ab_fun'), flowSeries(flowBr, 'ab_fun'), scope, 1, '%'), caveat: null, source: 'INEP/Indicadores Educacionais', state: 'ok' }); }
  if (enrLast) kpis.push({ id: 'matriculas', label: 'Matrículas', plain: 'Alunos matriculados na educação básica', value: fmt(enrLast.value!), unit: `alunos${totals.escolas ? ` em ${fmt(Number(totals.escolas))} escolas` : ''}`, basis: `Censo ${enrLast.year}`, chapter: 'rede', delta: enr5 ? { text: `${enrLast.value! >= enr5.value! ? '+' : '−'}${fmt(Math.abs(enrLast.value! - enr5.value!))} alunos desde ${enr5.year}`, direction: Math.abs(enrLast.value! / enr5.value! - 1) < 0.02 ? 'flat' : enrLast.value! > enr5.value! ? 'up' : 'down' } : null, compare: null, ruler: null, spark: enr.filter(r => r.value != null).map(r => r.value!), sparkLabel: 'por ano', secondary: null, caveat: null, source: 'INEP/Censo Escolar', state: 'ok' });

  const learning = { id: 'aprendizagem', number: 2, title: 'O que os alunos aprendem', narrative: N.learning, available: !!(saebExplorer || idebExplorer), emptyReason: 'Ainda não há resultado do Saeb nem do Ideb publicado para este território.', limits: ['Valores oficiais do INEP, sem recálculo: o Ideb de uma rede ou cidade não é a média das escolas.', 'Escalas do Saeb diferem por série e disciplina; não compare etapas nem disciplinas.', 'Resultado ausente = a fonte não divulgou (poucos alunos ou participação insuficiente), não é zero.', 'A meta do Ideb vai só até 2021. O Saeb não é publicado por escola.', ...(saeb?.restrictions ?? []).slice(4, 6)], sources: 'Fontes: INEP, Saeb 2017–2025 e Ideb 2005–2025.', explorer: saebExplorer, ideb: idebExplorer, secondary: alfTable };
  const sources: Array<{ label: string; period: string }> = [
    saeb && { label: SRC.saeb, period: `edições ${saeb.editions.join(', ')}` }, ideb && { label: SRC.ideb, period: `edições ${ideb.editions.at(0)}–${ideb.editions.at(-1)}` }, flow?.length && { label: SRC.flow, period: `${flow[0]!.year}–${flow.at(-1)!.year}` },
    offer && { label: SRC.censo + ' (matrículas e infraestrutura)', period: `${year}` }, contracts && { label: SRC.pncp + ' e fornecedores', period: '2021–2026' }, works && { label: SRC.obras, period: 'cobertura parcial por UF' },
  ].filter((x): x is { label: string; period: string } => !!x);

  return {
    scope, year, hero: { lede: N.lede, kpis },
    network: { id: 'rede', number: 1, title: 'Quantos estudam', narrative: N.network, available: !!enrLast || !!totals.matriculas, emptyReason: 'Não há matrículas publicadas para este território.', limits: ['Matrícula não é aluno único: o mesmo aluno pode ter mais de uma.', 'A rede privada entra nas contas de matrículas e escolas; veja a divisão por rede.', ...((offer?.restrictions ?? []) as string[]).slice(0, 3)], sources: 'Fonte: INEP, Censo Escolar da Educação Básica.',
      stats: [totals.matriculas != null && stat('Matrículas', fmt(Number(totals.matriculas))), totals.escolas != null && stat('Escolas', fmt(Number(totals.escolas))), totals.turmas != null && stat('Turmas', fmt(Number(totals.turmas))), totals.matPorTurma != null && stat('Alunos por turma', fmt(Number(totals.matPorTurma), 1))].filter((x): x is ReturnType<typeof stat> => !!x), enrollment: enrChart, stages: stageBars, dependency: depBars, special: spStats },
    learning,
    trajectory: { id: 'trajetoria', number: 3, title: 'Quem fica pelo caminho', narrative: N.trajectory, available: !!flowExplorer, emptyReason: 'Não há taxas de aprovação, reprovação e abandono publicadas para este território.', limits: ['Taxas oficiais do INEP por ano letivo, sem recálculo. Aprovação, reprovação e abandono somam cerca de 100%.', 'Distorção idade-série não é reprovação: mede o atraso em relação à idade esperada.', 'Transição (passou, repetiu, saiu) é outra medida e só existe até 2021.', 'Por escola, estas taxas só serão exibidas depois da validação jurídica (LGPD).'], sources: 'Fonte: INEP, Indicadores Educacionais (rendimento, distorção e transição).', explorer: flowExplorer, breakdown, transition: trStats, transitionYear: trn?.editions.at(-1) ?? null },
    context: { id: 'contexto', number: 4, title: 'Contexto das famílias', narrative: N.context, available: !!inseLast, emptyReason: 'O INEP não publicou o nível socioeconômico para este território.', limits: ['O INSE descreve o contexto socioeconômico dos alunos; não mede a qualidade da escola e não prova causa de resultados.', '2019 usa uma escala diferente de 2021 e 2023.'], sources: 'Fonte: INEP, Indicador de Nível Socioeconômico (Saeb).', inse: inseChart, stats: inseLast ? [stat(`INSE médio (${inseLast.year})`, fmt(inseLast.media ?? 0, 2), 'escala de 1 a 8'), stat('Alunos considerados', fmt(inseLast.alunos ?? 0))] : [], classes: inseClasses },
    structure: { id: 'estrutura', number: 5, title: 'Como são as escolas', narrative: N.structure, available: infraBars.length > 0, emptyReason: 'Não há infraestrutura publicada para este território.', limits: ['Informação autodeclarada pela escola no Censo Escolar; o percentual considera só as escolas que responderam.', 'Internet declara acesso, não velocidade nem qualidade.', 'Algumas perguntas mudaram em 2019: o gráfico avisa quando a comparação pede cautela.'], sources: 'Fonte: INEP, Censo Escolar (tabela de infraestrutura).', explorer: infraExplorer, items: infraBars, universe: infra?.universe ? `${fmt(Number(infra.universe.comResposta))} de ${fmt(Number(infra.universe.escolas))} escolas responderam` : null, stats: [] },
    teachers: { id: 'professores', number: 6, title: 'Quem ensina', narrative: N.teachers, available: !!docs || afdBars.length > 0 || !!teacherTable, emptyReason: 'Não há dados de docentes publicados para este território.', limits: ['Docentes distintos: cada professor conta uma vez. Por escola, o número de docentes não é somado (contaria duas vezes quem trabalha em várias).', 'Os indicadores de formação e de condições de ensino são do INEP e descrevem, não ranqueiam.'], sources: 'Fonte: INEP, Sinopse Estatística e Indicadores Educacionais.', stats: [docs && stat('Professores', fmt(Number(docs.value)), 'docentes'), med('atu_fun') != null && stat('Alunos por turma (fund.)', fmt(med('atu_fun')!, 1)), med('afd_fun1') != null && stat('Com formação adequada (fund.)', `${fmt(med('afd_fun1')!, 0)}%`)].filter((x): x is ReturnType<typeof stat> => !!x), docentes: docChart, formation: afdBars, table: teacherTable },
    money: { id: 'recursos', number: 7, title: 'Dinheiro, contratos e obras', narrative: N.money, available: !!(contracts || programTable || worksTable || financeTable), emptyReason: 'Ainda não há contratos, repasses ou obras de educação publicados para este território.', limits: ['Valor de contrato é o valor CONTRATADO no PNCP: não é o valor pago nem o que foi entregue.', 'O contrato não informa a escola: não é possível ligar contratos a escolas específicas.', 'Obras vêm do Obrasgov por UF e só algumas UFs foram coletadas; empenho não é pagamento.', 'Repasses do FNDE: só 2025. Fonte e situação do pagamento nunca são somadas.', 'Contratos com indício fraco de serem de educação ficam fora dos totais.'], sources: 'Fontes: PNCP, Obrasgov, FNDE (Portal da Transparência) e Siconfi.', contractsChart, contractStats, categories, suppliers: supplierTable, works: worksTable, worksNote, programs: programTable, finance: financeTable },
    sources,
  };
}

const cachedLoad = (scope: EduScope, y?: number) => memo(`edu:${scope.entityId}:${y ?? 'd'}`, () => loadEducationPage(scope, y), 60_000);
export { scopeOf, cachedLoad as loadEducationPageCached };
export type { Explorer };
