import type { Pool } from 'pg';
import { EDU_BUYER, EDU_CATEGORY, EDU_CONFIDENCE_LABEL, EDU_VIA_LABEL } from './edu-contract-build.ts';

/**
 * Leitura das contratações, obras e investimentos da Educação (P10.7). Somente SELECT, parametrizados, sem N+1.
 * Regras de honestidade que a leitura não quebra:
 *  - `valor_global` é o valor CONTRATADO no PNCP. Não é valor pago, executado nem investido; o PNCP não traz pagamento. Empenho (Obrasgov) ≠ pago.
 *  - valor estimado (contratação), homologado (contratação) e contratado (contrato) são colunas separadas e nunca somadas entre si.
 *  - contrato sem valor entra na contagem e NÃO na soma; contrato com valor acima de R$ 10 bilhões é marcado `outlier` e fica fora da soma (erro de digitação na origem).
 *  - POSSIBLE_EDUCATION nunca entra no total "confirmado + alta confiança": é devolvido à parte.
 *  - um contrato pode ter mais de uma categoria: somar categorias dá mais que o total de contratos (use `total`, não a soma das categorias).
 *  - escola: o PNCP não traz o código INEP; sem chave oficial NÃO há vínculo contrato→escola (nada de nome parecido).
 */
type Q = Pick<Pool, 'query'>;
export const EDU_CONTRACT_RESTRICTIONS = [
  'Valor de contrato é o valor CONTRATADO publicado no PNCP. Não é o valor pago, executado ou investido na educação: o PNCP não publica pagamento. Contrato sem valor entra na contagem e não na soma.',
  'Valor estimado e homologado pertencem à contratação (licitação); o contratado pertence ao contrato. São medidas diferentes e nunca são somadas.',
  'A classificação como educacional é determinística e auditável (regra, evidência e confiança por contrato). CONFIRMED_OFFICIAL = comprador é o MEC, o FNDE ou o INEP; HIGH_CONFIDENCE_DERIVED = órgão de educação ou unidade escolar nomeada no objeto; POSSIBLE_EDUCATION = indício fraco, mostrado à parte.',
  'Contrato de órgão de educação sem tema identificado (categoria 16) é contratação institucional do órgão; não prova gasto em sala de aula. Um contrato pode ter mais de uma categoria.',
  'Ensino superior (universidade, instituto federal, CEFET), escola de governo, hospital-escola e ensino militar ficam fora do núcleo.',
  'Contrato do PNCP não traz o código INEP da escola: não há vínculo contrato→escola sem chave oficial. Município vem do órgão contratante, não do local da obra.',
  'Obras vêm do Obrasgov (nacional por UF, sem código de município nem INEP). Empenho não é pagamento. O vínculo obra→contrato só existe quando o contrato do PNCP informa o identificador CIPI da obra.',
  'Cobertura: contratos do PNCP de 2021 a 2026, com volume crescente por adoção gradual da Lei 14.133; a ausência de contratos em um ano ou município não significa ausência de contratação.',
];
export const EDU_CONTRACT_SOURCES = {
  pncp: { name: 'PNCP, contratos e atas (API de consulta pública)', url: 'https://pncp.gov.br/api/consulta/swagger-ui/index.html' },
  obrasgov: { name: 'Obrasgov.br, projetos de investimento e execução (API pública)', url: 'https://api.obrasgov.gestao.gov.br/' },
};
export interface EduContractKey { ufCode?: number; ibge7?: string }
type Entity = { entity_id: number; name: string; kind: number };
async function resolveEntity(q: Q, o: EduContractKey): Promise<Entity | undefined> {
  if (o.ibge7 != null) { if (!/^\d{7}$/.test(o.ibge7)) return undefined; return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 4 AND ibge7 = $1`, [Number(o.ibge7)])).rows[0]; }
  if (o.ufCode != null) return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 3 AND uf_code = $1`, [o.ufCode])).rows[0];
  return (await q.query(`SELECT entity_id, name, kind FROM civica_exec.exec_entity WHERE kind = 1`)).rows[0];
}
const num = (v: unknown): number => Number(v ?? 0);
const reais = (v: unknown): number => Math.round(Number(v ?? 0)) / 100;
const cap = (n: number | undefined, d: number, max: number): number => Math.max(1, Math.min(max, Number.isInteger(n) ? n! : d));
const CONF_HIGH = 2;

export interface EduContractAggregate { contracts: number; withValue: number; withoutValue: number; outliers: number; contractedValue: number }
const aggRow = (r: Record<string, unknown>): EduContractAggregate => ({ contracts: num(r.n), withValue: num(r.n_valor), withoutValue: num(r.n) - num(r.n_valor), outliers: num(r.n_out), contractedValue: reais(r.soma) });
/** Escopo territorial: Brasil (todos os contratos), UF (uf do órgão) ou município (ente do município). Contratos federais ficam no ente Brasil, mesmo quando a unidade está em uma UF. */
function scopeWhere(e: Entity, alias: string): { sql: string; params: unknown[] } {
  if (e.kind === 1) return { sql: 'TRUE', params: [] };
  if (e.kind === 3) return { sql: `${alias}.uf = (SELECT uf_code FROM civica_exec.exec_entity WHERE entity_id = $1)::smallint AND ${alias}.esfera IN ('E', 'D', 'M')`, params: [e.entity_id] };
  return { sql: `${alias}.entity_id = $1`, params: [e.entity_id] };
}

export interface EduCategoryRow extends EduContractAggregate { year: number; category: number; categoryLabel: string; confidence: number; confidenceLabel: string }
export interface EduTerritoryResult {
  scope: { kind: 'brasil' | 'uf' | 'municipio'; entityId: number; name: string };
  total: { highAndConfirmed: EduContractAggregate; possible: EduContractAggregate };
  byYear: Array<{ year: number } & EduContractAggregate>;
  byCategory: EduCategoryRow[];
  restrictions: string[]; sources: typeof EDU_CONTRACT_SOURCES;
}
/** Território: totais por ano e por categoria × confiança, separando POSSIBLE_EDUCATION. Valor = contratado. */
export async function getEduContractsTerritory(q: Q, o: EduContractKey & { year?: number }): Promise<EduTerritoryResult | null> {
  const e = await resolveEntity(q, o); if (!e) return null;
  const w = scopeWhere(e, 'c'); const yi = w.params.length + 1; const yp = [...w.params, o.year ?? null];
  const total = (await q.query(`SELECT (c.best_confidence <= ${CONF_HIGH}) AS firm, count(*)::int n, count(c.valor_global)::int n_valor, count(*) FILTER (WHERE c.outlier)::int n_out,
      coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier), 0)::numeric soma FROM civica_exec.exec_edu_contract c WHERE ${w.sql} AND ($${yi}::smallint IS NULL OR c.year = $${yi}) GROUP BY 1`, yp)).rows;
  const zero = { n: 0, n_valor: 0, n_out: 0, soma: 0 };
  const firm = total.find(r => r.firm) ?? zero; const poss = total.find(r => !r.firm) ?? zero;
  const byYear = (await q.query(`SELECT c.year, count(*)::int n, count(c.valor_global)::int n_valor, count(*) FILTER (WHERE c.outlier)::int n_out, coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier), 0)::numeric soma
      FROM civica_exec.exec_edu_contract c WHERE ${w.sql} AND c.best_confidence <= ${CONF_HIGH} AND ($${yi}::smallint IS NULL OR c.year = $${yi}) GROUP BY c.year ORDER BY c.year`, yp)).rows;
  const wk = scopeWhere(e, 'k');   // a classe carrega year/uf/ente/esfera/valor/outlier do contrato: sem JOIN
  const byCat = (await q.query(`SELECT k.year, k.category, k.confidence, count(*)::int n, count(k.valor)::int n_valor, count(*) FILTER (WHERE k.outlier)::int n_out, coalesce(sum(k.valor) FILTER (WHERE NOT k.outlier), 0)::numeric soma
      FROM civica_exec.exec_edu_contract_class k WHERE ${wk.sql} AND ($${yi}::smallint IS NULL OR k.year = $${yi}) GROUP BY k.year, k.category, k.confidence ORDER BY k.year, k.category, k.confidence`, yp)).rows;
  if (!total.length) return null;
  return {
    scope: { kind: e.kind === 1 ? 'brasil' : e.kind === 3 ? 'uf' : 'municipio', entityId: e.entity_id, name: e.name },
    total: { highAndConfirmed: aggRow(firm), possible: aggRow(poss) }, byYear: byYear.map(r => ({ year: num(r.year), ...aggRow(r) })),
    byCategory: byCat.map(r => ({ year: num(r.year), category: num(r.category), categoryLabel: EDU_CATEGORY[num(r.category)] ?? String(r.category), confidence: num(r.confidence), confidenceLabel: EDU_CONFIDENCE_LABEL[num(r.confidence)] ?? String(r.confidence), ...aggRow(r) })),
    restrictions: EDU_CONTRACT_RESTRICTIONS, sources: EDU_CONTRACT_SOURCES,
  };
}

export interface EduContractListRow {
  pncpId: string; year: number; uf: number; entityId: number; orgCnpj: string; buyer: number; buyerLabel: string; confidence: number; confidenceLabel: string; categories: number[];
  contractedValue: number | null; outlier: boolean; signed: string | null; vigEnd: string | null; supplierCnpj: string | null; supplierName: string | null; object: string; cipi: string | null; compra: string | null; empenho: string | null;
}
const day = (v: unknown): string | null => v == null ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10);
const listRow = (r: Record<string, unknown>): EduContractListRow => ({
  pncpId: String(r.pncp_id), year: num(r.year), uf: num(r.uf), entityId: num(r.entity_id), orgCnpj: String(r.org_cnpj).padStart(14, '0'), buyer: num(r.buyer), buyerLabel: EDU_BUYER[num(r.buyer)] ?? '', confidence: num(r.best_confidence),
  confidenceLabel: EDU_CONFIDENCE_LABEL[num(r.best_confidence)] ?? '', categories: (r.cats as number[] | null) ?? [], contractedValue: r.valor_global == null ? null : reais(r.valor_global), outlier: Boolean(r.outlier), signed: day(r.signed), vigEnd: day(r.vig_end),
  supplierCnpj: r.supplier == null ? null : String(r.supplier).padStart(14, '0'), supplierName: r.supplier_name == null ? null : String(r.supplier_name), object: String(r.objeto), cipi: r.cipi == null ? null : String(r.cipi), compra: r.compra == null ? null : String(r.compra), empenho: r.empenho == null ? null : String(r.empenho),
});
const LIST_SELECT = `SELECT c.pncp_id, c.year, c.uf, c.entity_id, c.org_cnpj, c.buyer, c.best_confidence, c.valor_global, c.outlier, c.signed, c.vig_end, c.supplier, s.name supplier_name, c.objeto, c.cipi, c.compra, c.empenho,
  (SELECT array_agg(k.category ORDER BY k.category) FROM civica_exec.exec_edu_contract_class k WHERE k.pncp_id = c.pncp_id) cats
  FROM civica_exec.exec_edu_contract c LEFT JOIN civica_exec.exec_fin_supplier s ON s.cnpj = c.supplier`;
/** Lista paginada de contratos de um território, filtrável por ano, categoria e confiança mínima. Ordem: maior valor contratado, depois id (estável). */
export async function getEduContractList(q: Q, o: EduContractKey & { year?: number; category?: number; includePossible?: boolean; limit?: number; offset?: number }): Promise<{ scope: EduTerritoryResult['scope']; rows: EduContractListRow[]; limit: number; offset: number } | null> {
  const e = await resolveEntity(q, o); if (!e) return null; const w = scopeWhere(e, 'c'); const n = w.params.length;
  const limit = cap(o.limit, 50, 200); const offset = Math.max(0, o.offset ?? 0);
  const rows = (await q.query(`${LIST_SELECT} WHERE ${w.sql} AND ($${n + 1}::smallint IS NULL OR c.year = $${n + 1}) AND ($${n + 2}::smallint IS NULL OR EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract_class k2 WHERE k2.pncp_id = c.pncp_id AND k2.category = $${n + 2}))
      AND ($${n + 3}::boolean OR c.best_confidence <= ${CONF_HIGH}) ORDER BY c.valor_global DESC NULLS LAST, c.pncp_id LIMIT $${n + 4} OFFSET $${n + 5}`, [...w.params, o.year ?? null, o.category ?? null, o.includePossible ?? false, limit, offset])).rows;
  return { scope: { kind: e.kind === 1 ? 'brasil' : e.kind === 3 ? 'uf' : 'municipio', entityId: e.entity_id, name: e.name }, rows: rows.map(listRow), limit, offset };
}

export interface EduContractDetail {
  contract: EduContractListRow; classes: Array<{ category: number; categoryLabel: string; via: number; viaLabel: string; rule: number; confidence: number; confidenceLabel: string; evidence: string }>;
  procurement: { compra: string; modalidade: number | null; situacao: number | null; srp: boolean | null; estimatedValue: number | null; approvedValue: number | null; secret: boolean; published: string | null } | null;
  terms: Array<{ seq: number; kind: string; signed: string | null; vigEnd: string | null; addedValue: number | null; globalValue: number | null; days: number | null; object: string }>;
  work: { workId: string; name: string; situacao: string | null; physicalPercent: number | null } | null;
  restrictions: string[];
}
/** Contrato + classificações (com evidência) + contratação (estimado/homologado separados) + termos + obra pelo CIPI. Cada elo só aparece se a chave oficial existe. */
export async function getEduContractDetail(q: Q, pncpId: string): Promise<EduContractDetail | null> {
  const c = (await q.query(`${LIST_SELECT} WHERE c.pncp_id = $1`, [pncpId])).rows[0]; if (!c) return null;
  const cls = (await q.query(`SELECT category, via, rule, confidence, evidence FROM civica_exec.exec_edu_contract_class WHERE pncp_id = $1 ORDER BY category`, [pncpId])).rows;
  const pr = c.compra ? (await q.query(`SELECT compra, modalidade, situacao, srp, valor_estimado, valor_homologado, sigiloso, pub_date FROM civica_exec.exec_edu_procurement WHERE compra = $1`, [c.compra])).rows[0] : undefined;
  const tm = (await q.query(`SELECT seq, kind, signed, vig_end, valor_acrescido, valor_global, prazo_dias, objeto FROM civica_exec.exec_edu_contract_term WHERE pncp_id = $1 ORDER BY seq`, [pncpId])).rows;
  const wk = c.cipi ? (await q.query(`SELECT work_id, name, situacao, phys_percent FROM civica_exec.exec_edu_work WHERE work_id = $1`, [c.cipi])).rows[0] : undefined;
  const cents = (v: unknown): number | null => v == null ? null : reais(v);
  return {
    contract: listRow(c),
    classes: cls.map(k => ({ category: num(k.category), categoryLabel: EDU_CATEGORY[num(k.category)] ?? '', via: num(k.via), viaLabel: EDU_VIA_LABEL[num(k.via)] ?? '', rule: num(k.rule), confidence: num(k.confidence), confidenceLabel: EDU_CONFIDENCE_LABEL[num(k.confidence)] ?? '', evidence: String(k.evidence) })),
    procurement: pr ? { compra: String(pr.compra), modalidade: pr.modalidade == null ? null : num(pr.modalidade), situacao: pr.situacao == null ? null : num(pr.situacao), srp: pr.srp, estimatedValue: cents(pr.valor_estimado), approvedValue: cents(pr.valor_homologado), secret: Boolean(pr.sigiloso), published: day(pr.pub_date) } : null,
    terms: tm.map(t => ({ seq: num(t.seq), kind: String(t.kind), signed: day(t.signed), vigEnd: day(t.vig_end), addedValue: cents(t.valor_acrescido), globalValue: cents(t.valor_global), days: t.prazo_dias == null ? null : num(t.prazo_dias), object: String(t.objeto) })),
    work: wk ? { workId: String(wk.work_id), name: String(wk.name), situacao: wk.situacao == null ? null : String(wk.situacao), physicalPercent: wk.phys_percent == null ? null : num(wk.phys_percent) } : null,
    restrictions: EDU_CONTRACT_RESTRICTIONS,
  };
}

export interface EduSupplierRow extends EduContractAggregate { cnpj: string; name: string }
/** Fornecedores PJ de um território, por valor contratado (confirmado + alta confiança). Pessoa física nunca aparece. */
export async function getEduSuppliers(q: Q, o: EduContractKey & { year?: number; category?: number; limit?: number }): Promise<{ scope: EduTerritoryResult['scope']; rows: EduSupplierRow[]; restrictions: string[] } | null> {
  const e = await resolveEntity(q, o); if (!e) return null; const w = scopeWhere(e, 'c'); const n = w.params.length; const limit = cap(o.limit, 20, 200);
  const rows = (await q.query(`SELECT c.supplier, s.name, count(*)::int n, count(c.valor_global)::int n_valor, count(*) FILTER (WHERE c.outlier)::int n_out, coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier), 0)::numeric soma
      FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_fin_supplier s ON s.cnpj = c.supplier WHERE ${w.sql} AND c.best_confidence <= ${CONF_HIGH} AND ($${n + 1}::smallint IS NULL OR c.year = $${n + 1})
      AND ($${n + 2}::smallint IS NULL OR EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract_class k WHERE k.pncp_id = c.pncp_id AND k.category = $${n + 2})) GROUP BY c.supplier, s.name ORDER BY soma DESC, c.supplier LIMIT $${n + 3}`, [...w.params, o.year ?? null, o.category ?? null, limit])).rows;
  return { scope: { kind: e.kind === 1 ? 'brasil' : e.kind === 3 ? 'uf' : 'municipio', entityId: e.entity_id, name: e.name }, rows: rows.map(r => ({ cnpj: String(r.supplier).padStart(14, '0'), name: String(r.name), ...aggRow(r) })), restrictions: EDU_CONTRACT_RESTRICTIONS };
}
/** Um fornecedor PJ: contratos educacionais por ano e por órgão contratante. */
export async function getEduSupplier(q: Q, cnpj: string): Promise<{ cnpj: string; name: string; byYear: Array<{ year: number } & EduContractAggregate>; byEntity: Array<{ entityId: number; entityName: string } & EduContractAggregate>; restrictions: string[] } | null> {
  if (!/^\d{14}$/.test(cnpj)) return null;
  const s = (await q.query(`SELECT cnpj, name FROM civica_exec.exec_fin_supplier WHERE cnpj = $1`, [Number(cnpj)])).rows[0]; if (!s) return null;
  const agg = `count(*)::int n, count(c.valor_global)::int n_valor, count(*) FILTER (WHERE c.outlier)::int n_out, coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier), 0)::numeric soma`;
  const by = (await q.query(`SELECT c.year, ${agg} FROM civica_exec.exec_edu_contract c WHERE c.supplier = $1 AND c.best_confidence <= ${CONF_HIGH} GROUP BY c.year ORDER BY c.year`, [Number(cnpj)])).rows;
  const be = (await q.query(`SELECT c.entity_id, e.name, ${agg} FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_entity e ON e.entity_id = c.entity_id WHERE c.supplier = $1 AND c.best_confidence <= ${CONF_HIGH} GROUP BY c.entity_id, e.name ORDER BY soma DESC, c.entity_id LIMIT 50`, [Number(cnpj)])).rows;
  if (!by.length) return null;
  return { cnpj, name: String(s.name), byYear: by.map(r => ({ year: num(r.year), ...aggRow(r) })), byEntity: be.map(r => ({ entityId: num(r.entity_id), entityName: String(r.name), ...aggRow(r) })), restrictions: EDU_CONTRACT_RESTRICTIONS };
}
/** Órgão contratante (CNPJ do órgão): contratos educacionais por ano e categoria. */
export async function getEduOrgan(q: Q, orgCnpj: string): Promise<{ orgCnpj: string; entityName: string | null; byYear: Array<{ year: number } & EduContractAggregate>; restrictions: string[] } | null> {
  if (!/^\d{14}$/.test(orgCnpj)) return null;
  const by = (await q.query(`SELECT c.year, count(*)::int n, count(c.valor_global)::int n_valor, count(*) FILTER (WHERE c.outlier)::int n_out, coalesce(sum(c.valor_global) FILTER (WHERE NOT c.outlier), 0)::numeric soma
      FROM civica_exec.exec_edu_contract c WHERE c.org_cnpj = $1 AND c.best_confidence <= ${CONF_HIGH} GROUP BY c.year ORDER BY c.year`, [Number(orgCnpj)])).rows;
  if (!by.length) return null;
  const e = (await q.query(`SELECT e.name FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_entity e ON e.entity_id = c.entity_id WHERE c.org_cnpj = $1 LIMIT 1`, [Number(orgCnpj)])).rows[0];
  return { orgCnpj, entityName: e ? String(e.name) : null, byYear: by.map(r => ({ year: num(r.year), ...aggRow(r) })), restrictions: EDU_CONTRACT_RESTRICTIONS };
}
/** Escola: sem código INEP no PNCP não há vínculo oficial contrato→escola; a resposta diz isso em vez de inventar. */
export async function getEduSchoolContracts(q: Q, inep: number): Promise<{ inep: number; schoolName: string | null; linked: number; contracts: EduContractListRow[]; reason: string } | null> {
  if (!Number.isInteger(inep) || inep < 10_000_000) return null;
  const s = (await q.query(`SELECT name FROM civica_exec.exec_edu_school_year WHERE inep = $1 ORDER BY year DESC LIMIT 1`, [inep])).rows[0]; if (!s) return null;
  return { inep, schoolName: String(s.name), linked: 0, contracts: [], reason: 'O contrato do PNCP e a obra do Obrasgov não trazem o código INEP da escola. Sem chave oficial (INEP, CNPJ da unidade ou CIPI com INEP), nenhum vínculo é afirmado; correspondência por nome não é usada.' };
}

export interface EduWorkRow { workId: string; name: string; uf: number; situacao: string | null; eduBasis: number; eduConfidence: number; confidenceLabel: string; plannedValue: number | null; placeholderValue: boolean; physicalPercent: number | null; physicalDate: string | null; committed: number | null; commits: number; startEff: string | null; endPrev: string | null; endEff: string | null; contracts: number }
const workRow = (r: Record<string, unknown>): EduWorkRow => ({ workId: String(r.work_id), name: String(r.name), uf: num(r.uf), situacao: r.situacao == null ? null : String(r.situacao), eduBasis: num(r.edu_basis), eduConfidence: num(r.edu_confidence), confidenceLabel: EDU_CONFIDENCE_LABEL[num(r.edu_confidence)] ?? '',
  plannedValue: r.valor_previsto == null ? null : reais(r.valor_previsto), placeholderValue: Boolean(r.valor_placeholder), physicalPercent: r.phys_percent == null ? null : num(r.phys_percent), physicalDate: day(r.phys_date), committed: r.committed == null ? null : reais(r.committed), commits: num(r.commits),
  startEff: day(r.d_start_eff), endPrev: day(r.d_end_prev), endEff: day(r.d_end_eff), contracts: num(r.contracts) });
/** Obras educacionais de uma UF (Obrasgov): situação, valor previsto, execução física oficial e empenho (não pago). Ordenadas por valor previsto. */
export async function getEduWorks(q: Q, o: { ufCode: number; situacao?: string; limit?: number; offset?: number }): Promise<{ ufCode: number; total: number; rows: EduWorkRow[]; coverage: { pendingPages: number } | null; restrictions: string[] } | null> {
  const limit = cap(o.limit, 50, 200); const offset = Math.max(0, o.offset ?? 0);
  const t = (await q.query(`SELECT count(*)::int n FROM civica_exec.exec_edu_work WHERE uf = $1 AND ($2::text IS NULL OR situacao = $2)`, [o.ufCode, o.situacao ?? null])).rows[0];
  const cov = (await q.query(`SELECT pending FROM civica_exec.exec_edu_ctr_cov WHERE kind = 4 AND uf = $1 ORDER BY year DESC LIMIT 1`, [o.ufCode])).rows[0];
  if (!num(t.n) && !cov) return null;
  const rows = (await q.query(`SELECT w.*, (SELECT count(*) FROM civica_exec.exec_edu_contract c WHERE c.cipi = w.work_id)::int contracts FROM civica_exec.exec_edu_work w WHERE w.uf = $1 AND ($2::text IS NULL OR w.situacao = $2)
      ORDER BY w.valor_previsto DESC NULLS LAST, w.work_id LIMIT $3 OFFSET $4`, [o.ufCode, o.situacao ?? null, limit, offset])).rows;
  return { ufCode: o.ufCode, total: num(t.n), rows: rows.map(workRow), coverage: cov ? { pendingPages: num(cov.pending) } : null, restrictions: EDU_CONTRACT_RESTRICTIONS };
}
/** Uma obra: dados oficiais, empenhos (um a um) e contratos do PNCP que a apontam pelo CIPI. */
export async function getEduWorkDetail(q: Q, workId: string): Promise<{ work: EduWorkRow; commitments: Array<{ nota: string | null; ug: string | null; natureza: string | null; fonte: string | null; value: number | null }>; contracts: EduContractListRow[]; restrictions: string[] } | null> {
  const w = (await q.query(`SELECT w.*, (SELECT count(*) FROM civica_exec.exec_edu_contract c WHERE c.cipi = w.work_id)::int contracts FROM civica_exec.exec_edu_work w WHERE w.work_id = $1`, [workId])).rows[0]; if (!w) return null;
  const cm = (await q.query(`SELECT nota, ug_emitente, natureza, fonte, valor FROM civica_exec.exec_edu_work_commit WHERE work_id = $1 ORDER BY idx`, [workId])).rows;
  const ct = (await q.query(`${LIST_SELECT} WHERE c.cipi = $1 ORDER BY c.valor_global DESC NULLS LAST, c.pncp_id LIMIT 50`, [workId])).rows;
  return { work: workRow(w), commitments: cm.map(r => ({ nota: r.nota == null ? null : String(r.nota), ug: r.ug_emitente == null ? null : String(r.ug_emitente), natureza: r.natureza == null ? null : String(r.natureza), fonte: r.fonte == null ? null : String(r.fonte), value: r.valor == null ? null : reais(r.valor) })), contracts: ct.map(listRow), restrictions: EDU_CONTRACT_RESTRICTIONS };
}

export interface EduCoverageRow { kind: number; kindLabel: string; year: number; uf: number; rowsIn: number; rowsOut: number; rejected: number; noValue: number; pending: number }
const COV_KIND: Record<number, string> = { 1: 'contratos do PNCP', 2: 'contratações (compras) do PNCP', 3: 'termos aditivos do PNCP', 4: 'obras do Obrasgov' };
/** Cobertura publicada por fonte × ano × UF: lidos, publicados, rejeitados, sem valor e pendentes de coleta. */
export async function getEduContractCoverage(q: Q, o: { kind?: number; ufCode?: number } = {}): Promise<{ rows: EduCoverageRow[]; restrictions: string[] }> {
  const rows = (await q.query(`SELECT kind, year, uf, rows_in, rows_out, rejected, no_value, pending FROM civica_exec.exec_edu_ctr_cov WHERE ($1::smallint IS NULL OR kind = $1) AND ($2::smallint IS NULL OR uf = $2) ORDER BY kind, year, uf`, [o.kind ?? null, o.ufCode ?? null])).rows;
  return { rows: rows.map(r => ({ kind: num(r.kind), kindLabel: COV_KIND[num(r.kind)] ?? '', year: num(r.year), uf: num(r.uf), rowsIn: num(r.rows_in), rowsOut: num(r.rows_out), rejected: num(r.rejected), noValue: num(r.no_value), pending: num(r.pending) })), restrictions: EDU_CONTRACT_RESTRICTIONS };
}
