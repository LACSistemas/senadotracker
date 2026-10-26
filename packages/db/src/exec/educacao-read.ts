import type { Pool } from 'pg';
import { EDU_DEP, EDU_FLAG, EDU_LOC, EDU_SIT } from './educacao-build.ts';

/**
 * Contratos de leitura do cadastro de escolas (P10.1, Censo Escolar) para as futuras páginas de Educação. Somente SELECT, consultas parametrizadas, paginação real: nenhuma função
 * devolve todas as escolas de um território nem todo o histórico para montar uma lista. Pontos de extensão (P10.2+): `school.extensions` e `territory.extensions` ficam vazios
 * até as ondas de matrículas, infraestrutura, docentes e aprendizagem; elas se ligam por `inep` (exec_edu_school) e por (year, entity_id).
 * REGRAS (em `restrictions`): cadastro ≠ em atividade ≠ com matrícula; ausência numa edição NÃO é fechamento; rede ≠ localização; cada edição é uma fotografia de maio.
 */
type Q = Pick<Pool, 'query'>;
export const EDU_RESTRICTIONS = [
  'O Censo Escolar é uma fotografia anual (referência: última quarta-feira de maio). A mudança entre duas edições é a diferença entre duas fotografias, não a data em que algo ocorreu.',
  '"Cadastradas" são todas as linhas do arquivo oficial da edição; "em atividade" usa a situação de funcionamento informada pelo INEP; "com matrícula" exige matrícula na educação básica maior que zero. "Recorte da Sinopse" = em atividade e com matrícula (o universo dos totais oficiais de estabelecimentos). Os quatro números são diferentes e nunca devem ser trocados entre si.',
  'Escola ausente de uma edição NÃO é escola encerrada: o arquivo pode simplesmente não a listar. Só são fechamento as situações "extinta" e "paralisada" informadas pela fonte. As edições 2007 a 2010 só listam escolas em atividade, então a ausência nelas não diz nada sobre a situação.',
  'A dependência administrativa e o município são os registrados NA edição. Escolas da rede municipal de um município (as que a prefeitura mantém) não são as mesmas que as escolas localizadas nele (que incluem estaduais, federais e privadas); um município pode ter escola de rede municipal registrada em outro município.',
  'Contagem de escolas não é contagem de matrículas, turmas ou alunos. Um mesmo estabelecimento pode oferecer várias etapas de ensino.',
  'O cadastro não traz latitude/longitude, gestor, contatos nem dados de alunos ou docentes (minimização). O nome é o nome oficial da escola na edição.',
];
export const EDU_SOURCE = { name: 'INEP, Censo Escolar da Educação Básica (microdados abertos)', reference: 'última quarta-feira de maio', url: 'https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/censo-escolar' } as const;

export interface EduSchoolEdition { inep: number; year: number; municipality: { entityId: number; ibge7: string; name: string; uf: string }; name: string; dependency: { code: number; label: string }; location: { code: number; label: string } | null; situation: { code: number; label: string }; withEnrollment: boolean; sinopseUniverse: boolean }
export interface EduTransition { fromYear: number; toYear: number; kind: 'NOME' | 'MUNICIPIO' | 'DEPENDENCIA' | 'LOCALIZACAO' | 'SITUACAO'; from: string; to: string }
export interface EduGap { afterYear: number; beforeYear: number; missingEditions: number[]; meaning: 'AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO' }
export interface EduSchoolHistory { inep: number; editions: EduSchoolEdition[]; transitions: EduTransition[]; gaps: EduGap[]; firstYear: number | null; lastYear: number | null; publishedEditions: number[] }
export interface EduSchool { inep: number; latest: EduSchoolEdition | null; firstYear: number | null; lastYear: number | null; editionsPresent: number; publishedEditions: number; history: EduSchoolHistory; source: typeof EDU_SOURCE; restrictions: string[]; extensions: Record<string, never> }

type Row = Record<string, unknown>;
const mk = (x: Row): EduSchoolEdition => ({
  inep: Number(x.inep), year: Number(x.year), municipality: { entityId: Number(x.entity_id), ibge7: String(x.ibge7), name: String(x.mun_name), uf: String(x.uf) }, name: String(x.name),
  dependency: { code: Number(x.dep), label: EDU_DEP[Number(x.dep)] ?? String(x.dep) }, location: x.loc == null ? null : { code: Number(x.loc), label: EDU_LOC[Number(x.loc)] ?? String(x.loc) },
  situation: { code: Number(x.sit), label: EDU_SIT[Number(x.sit)] ?? String(x.sit) }, withEnrollment: (Number(x.flags) & EDU_FLAG.withEnrollment) !== 0, sinopseUniverse: (Number(x.flags) & EDU_FLAG.universe) !== 0,
});
const SEL = `SELECT y.inep, y.year, y.entity_id, e.ibge7::text AS ibge7, e.name AS mun_name, e.uf, y.name, y.dep, y.loc, y.sit, y.flags FROM civica_exec.exec_edu_school_year y JOIN civica_exec.exec_entity e ON e.entity_id = y.entity_id`;

export async function publishedEditions(q: Q): Promise<number[]> {
  return (await q.query(`SELECT DISTINCT year FROM civica_exec.exec_edu_cov ORDER BY year`)).rows.map(r => Number(r.year));
}

export function transitionsOf(editions: EduSchoolEdition[]): EduTransition[] {
  const out: EduTransition[] = []; const e = [...editions].sort((a, b) => a.year - b.year);
  for (let i = 1; i < e.length; i++) {
    const a = e[i - 1]!, b = e[i]!; const t = (kind: EduTransition['kind'], from: string, to: string) => { if (from !== to) out.push({ fromYear: a.year, toYear: b.year, kind, from, to }); };
    t('NOME', a.name, b.name); t('MUNICIPIO', `${a.municipality.name}/${a.municipality.uf} (${a.municipality.ibge7})`, `${b.municipality.name}/${b.municipality.uf} (${b.municipality.ibge7})`);
    t('DEPENDENCIA', a.dependency.label, b.dependency.label); t('LOCALIZACAO', a.location?.label ?? 'não informada', b.location?.label ?? 'não informada'); t('SITUACAO', a.situation.label, b.situation.label);
  }
  return out;
}
export function gapsOf(editions: EduSchoolEdition[], published: number[]): EduGap[] {
  const years = new Set(editions.map(e => e.year)); const sorted = [...years].sort((a, b) => a - b); const gaps: EduGap[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const miss = published.filter(y => y > sorted[i - 1]! && y < sorted[i]!);
    if (miss.length) gaps.push({ afterYear: sorted[i - 1]!, beforeYear: sorted[i]!, missingEditions: miss, meaning: 'AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO' });
  }
  return gaps;
}

/** Histórico de UMA escola (índice da chave primária (inep, year)). */
export async function getEducationSchoolHistory(q: Q, inep: number): Promise<EduSchoolHistory | null> {
  if (!Number.isInteger(inep)) return null;
  const [r, pub] = await Promise.all([q.query(`${SEL} WHERE y.inep = $1 ORDER BY y.year`, [inep]), publishedEditions(q)]);
  if (!r.rows.length) return null;
  const editions = r.rows.map(mk);
  return { inep, editions, transitions: transitionsOf(editions), gaps: gapsOf(editions, pub), firstYear: editions[0]!.year, lastYear: editions.at(-1)!.year, publishedEditions: pub };
}
export async function getEducationSchool(q: Q, inep: number): Promise<EduSchool | null> {
  const history = await getEducationSchoolHistory(q, inep); if (!history) return null;
  return { inep, latest: history.editions.at(-1) ?? null, firstYear: history.firstYear, lastYear: history.lastYear, editionsPresent: history.editions.length, publishedEditions: history.publishedEditions.length, history, source: EDU_SOURCE, restrictions: EDU_RESTRICTIONS, extensions: {} };
}

export interface EduListOptions { year?: number; dependency?: number; situation?: number; location?: number; sinopseUniverse?: boolean; withEnrollment?: boolean; search?: string; page?: number; pageSize?: number }
export interface EduCounts { registered: number; active: number; withEnrollment: number; sinopseUniverse: number }
export interface EduByDependency { dependency: { code: number; label: string }; registered: number; active: number; sinopseUniverse: number }
export interface EduSeriesPoint extends EduCounts { year: number }
export interface EduCoverageEdition { year: number; layout: number; rowsInFile: number; valid: number; rejected: number; activatedAt: string | null; runId: number | null; note: string | null }
export interface EduTerritorySchools {
  scope: { kind: 'municipio' | 'uf'; entityId: number | null; ibge7: string | null; ufCode: number | null; name: string; uf: string };
  year: number; dataBase: string; counts: EduCounts; byDependency: EduByDependency[]; series: EduSeriesPoint[]; coverage: EduCoverageEdition[];
  filters: { dependency: number | null; situation: number | null; location: number | null; sinopseUniverse: boolean | null; withEnrollment: boolean | null; search: string | null };
  page: { number: number; size: number; total: number; pages: number }; schools: EduSchoolEdition[]; source: typeof EDU_SOURCE; restrictions: string[]; extensions: Record<string, never>;
}
const MAX_PAGE = 200;
const noteOf = (year: number): string | null => year <= 2010 ? 'O arquivo desta edição lista somente escolas em atividade; ausência não informa a situação.' : null;

interface Scope { kind: 'municipio' | 'uf'; whereSql: string; arg: number; entityId: number | null; ibge7: string | null; ufCode: number | null; name: string; uf: string }
async function municipalityScope(q: Q, ibge7: string): Promise<Scope | null> {
  const r = await q.query(`SELECT entity_id, ibge7::text AS ibge7, name, uf, uf_code FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1::int`, [ibge7]); const x = r.rows[0]; if (!x) return null;
  return { kind: 'municipio', whereSql: 'y.entity_id = $2', arg: Number(x.entity_id), entityId: Number(x.entity_id), ibge7: String(x.ibge7), ufCode: Number(x.uf_code), name: String(x.name), uf: String(x.uf) };
}
async function ufScope(q: Q, ufCode: number): Promise<Scope | null> {
  const r = await q.query(`SELECT name, uf FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [ufCode]); const x = r.rows[0]; if (!x) return null;
  return { kind: 'uf', whereSql: 'y.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 4 AND uf_code = $2)', arg: ufCode, entityId: null, ibge7: null, ufCode, name: String(x.name), uf: String(x.uf) };
}
async function territorySchools(q: Q, s: Scope, o: EduListOptions, wantList: boolean): Promise<EduTerritorySchools | null> {
  const pub = await publishedEditions(q); if (!pub.length) return null;
  const year = o.year ?? pub.at(-1)!; if (!pub.includes(year)) return null;
  const size = Math.min(Math.max(1, Math.floor(o.pageSize ?? 50)), MAX_PAGE); const number = Math.max(1, Math.floor(o.page ?? 1));
  const total = (c: string) => `count(*) FILTER (WHERE ${c})::int`;
  const [byDep, series, cov] = await Promise.all([
    q.query(`SELECT y.dep, count(*)::int registered, ${total('y.sit = 1')} active, ${total(`(y.flags & ${EDU_FLAG.withEnrollment}) <> 0`)} with_mat, ${total(`(y.flags & ${EDU_FLAG.universe}) <> 0`)} universe FROM civica_exec.exec_edu_school_year y WHERE y.year = $1 AND ${s.whereSql} GROUP BY y.dep ORDER BY y.dep`, [year, s.arg]),
    // série da UF: vem da cobertura (já agregada por edição × UF, sem varrer 19 edições de escolas); a do município varre só as linhas dele pelo índice (year, entity_id)
    s.kind === 'uf'
      ? q.query(`SELECT c.year, c.valid::int registered, c.active::int active, c.with_mat::int with_mat, c.univ::int universe FROM civica_exec.exec_edu_cov c WHERE c.uf = $2 AND c.year = ANY($1::smallint[]) ORDER BY c.year`, [pub, s.arg])
      : q.query(`SELECT y.year, count(*)::int registered, ${total('y.sit = 1')} active, ${total(`(y.flags & ${EDU_FLAG.withEnrollment}) <> 0`)} with_mat, ${total(`(y.flags & ${EDU_FLAG.universe}) <> 0`)} universe FROM civica_exec.exec_edu_school_year y WHERE y.year = ANY($1::smallint[]) AND ${s.whereSql} GROUP BY y.year ORDER BY y.year`, [pub, s.arg]),
    q.query(`SELECT c.year, c.layout, sum(c.rows_in)::int rows_in, sum(c.valid)::int valid, sum(c.rejected)::int rejected FROM civica_exec.exec_edu_cov c WHERE ${s.kind === 'uf' ? 'c.uf = $1' : 'c.uf = $1'} GROUP BY c.year, c.layout ORDER BY c.year`, [s.ufCode]),
  ]);
  const runs = await q.query(`SELECT competence, run_id, activated_at FROM civica_exec.exec_publication WHERE dataset_id = 70 AND uf = $1`, [s.ufCode]);
  const runBy = new Map(runs.rows.map(r => [Math.floor(Number(r.competence) / 100), r]));
  const sum = (key: 'registered' | 'active' | 'with_mat' | 'universe') => byDep.rows.reduce((n, r) => n + Number(r[key]), 0);
  const filt: string[] = []; const args: unknown[] = [year, s.arg];
  const add = (sql: string, v: unknown) => { args.push(v); filt.push(sql.replace('?', `$${args.length}`)); };
  if (o.dependency != null) add('y.dep = ?', o.dependency);
  if (o.situation != null) add('y.sit = ?', o.situation);
  if (o.location != null) add('y.loc = ?', o.location);
  if (o.sinopseUniverse != null) filt.push(`(y.flags & ${EDU_FLAG.universe}) ${o.sinopseUniverse ? '<>' : '='} 0`);
  if (o.withEnrollment != null) filt.push(`(y.flags & ${EDU_FLAG.withEnrollment}) ${o.withEnrollment ? '<>' : '='} 0`);
  const search = o.search?.trim() ? o.search.trim().slice(0, 80) : null;
  if (search) { if (/^\d{8}$/.test(search)) add('y.inep = ?::int', search); else add(`y.name ILIKE ? ESCAPE '\\'`, `%${search.replace(/[\\%_]/g, m => '\\' + m)}%`); }
  const where = `y.year = $1 AND ${s.whereSql}${filt.length ? ' AND ' + filt.join(' AND ') : ''}`;
  let schools: EduSchoolEdition[] = []; let totalRows = 0;
  if (wantList) {
    const cnt = await q.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_school_year y WHERE ${where}`, args); totalRows = Number(cnt.rows[0].n);
    const list = await q.query(`${SEL} WHERE ${where} ORDER BY y.name, y.inep LIMIT ${size} OFFSET ${(number - 1) * size}`, args); schools = list.rows.map(mk);
  }
  return {
    scope: { kind: s.kind, entityId: s.entityId, ibge7: s.ibge7, ufCode: s.ufCode, name: s.name, uf: s.uf }, year, dataBase: `${year}-05`,
    counts: { registered: sum('registered'), active: sum('active'), withEnrollment: sum('with_mat'), sinopseUniverse: sum('universe') },
    byDependency: byDep.rows.map(r => ({ dependency: { code: Number(r.dep), label: EDU_DEP[Number(r.dep)] ?? String(r.dep) }, registered: Number(r.registered), active: Number(r.active), sinopseUniverse: Number(r.universe) })),
    series: series.rows.map(r => ({ year: Number(r.year), registered: Number(r.registered), active: Number(r.active), withEnrollment: Number(r.with_mat), sinopseUniverse: Number(r.universe) })),
    coverage: cov.rows.map(r => ({ year: Number(r.year), layout: Number(r.layout), rowsInFile: Number(r.rows_in), valid: Number(r.valid), rejected: Number(r.rejected), activatedAt: runBy.get(Number(r.year))?.activated_at ? new Date(String(runBy.get(Number(r.year))!.activated_at)).toISOString() : null, runId: runBy.get(Number(r.year)) ? Number(runBy.get(Number(r.year))!.run_id) : null, note: noteOf(Number(r.year)) })),
    filters: { dependency: o.dependency ?? null, situation: o.situation ?? null, location: o.location ?? null, sinopseUniverse: o.sinopseUniverse ?? null, withEnrollment: o.withEnrollment ?? null, search },
    page: { number, size, total: totalRows, pages: Math.ceil(totalRows / size) }, schools, source: EDU_SOURCE, restrictions: EDU_RESTRICTIONS, extensions: {},
  };
}
/** Escolas registradas num município (ibge7) numa edição, com resumo por dependência e série comparável. */
export async function getEducationMunicipalitySchools(q: Q, ibge7: string, o: EduListOptions = {}): Promise<EduTerritorySchools | null> {
  if (!/^\d{7}$/.test(ibge7)) return null; const s = await municipalityScope(q, ibge7); return s ? territorySchools(q, s, o, true) : null;
}
/** Escolas registradas numa UF (código IBGE de 2 dígitos). `listSchools: false` devolve só o resumo territorial. */
export async function getEducationStateSchools(q: Q, ufCode: number, o: EduListOptions & { listSchools?: boolean } = {}): Promise<EduTerritorySchools | null> {
  if (!Number.isInteger(ufCode)) return null; const s = await ufScope(q, ufCode); return s ? territorySchools(q, s, o, o.listSchools !== false) : null;
}
