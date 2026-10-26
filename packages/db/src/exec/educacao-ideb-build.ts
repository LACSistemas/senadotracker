import { IDEB_MEASURES, REDE_CODE } from './educacao-learn-catalog.ts';
import { sha256 } from './publication.ts';

/**
 * Ideb (P10.4): validação e montagem das fatias UF × edição a partir das planilhas oficiais do INEP (extraídas por scripts/exec/ideb_extract.py). Puro (sem banco): testável com linhas sintéticas.
 * Contrato: docs/executivo-collector-plan/educacao-p104-execucao/CONTRATOS_IDEB_SAEB.md. Regras (versionar IDEB_VERSION ao mudar):
 *  - O valor é o PUBLICADO. Brasil, região, UF, município e rede vêm da própria linha da planilha; nada é recalculado nem é média de escolas.
 *  - Ausente ("-") é NULL, nunca zero. Etapas (AI, AF, EM) não se somam. Meta só existe no 1º ciclo (2007–2021).
 *  - Escola exige identidade no cadastro da P10.1 (`exec_edu_school`). Edições anteriores ao cadastro (2005) só entram para escolas que também existem de 2007 em diante; as demais ficam contadas em `no_identity` e não geram snapshot escolar inventado.
 */
export const IDEB_VERSION = { parser: 'edu-ideb-2', publish: 'edu-ideb-pub-1' } as const;
export const learnCompetence = (year: number): number => year * 100 + 5;
export type IdebLevel = 'brasil' | 'ufs' | 'municipios' | 'escolas';
export interface IdebRaw { row: number; k1: string; k2: string; k3: string; rede: string; stage: number; year: number; v: Record<string, string> }
export interface IdebFile { level: IdebLevel; sha256: string[]; rows: IdebRaw[] }
export interface LearnEntities { byIbge7: Map<number, { entityId: number; uf: number }>; byIbge6?: Map<number, { entityId: number; uf: number }>; geo: Map<string, { entityId: number; uf: number }>; ufBySigla: Map<string, number>; schools: Set<number> }
export type IdebReject = 'INEP_INVALIDO' | 'SEM_IDENTIDADE_ESCOLAR' | 'MUNICIPIO_INEXISTENTE' | 'TERRITORIO_INEXISTENTE' | 'UF_INEXISTENTE' | 'REDE_INVALIDA' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA' | 'CHAVE_DUPLICADA';
export type IdebRow = Record<string, number | null>;
export interface LearnCovRow { year: number; uf: number; family: number; lvl: number; rows_in: number; valid: number; rejected: number; no_identity: number; cells_num: number; cells_supp: number }
export interface IdebSlice { uf: number; year: number; school: IdebRow[]; terr: IdebRow[]; cov: LearnCovRow[]; rejects: Array<{ level: string; row: number; reason: IdebReject }> }
export const LEARN_FAMILY = { ideb: 1, saeb: 2, tx_rend: 3, tdi: 4, transicao: 5, inse: 6 } as const;
const MAX: Record<string, number> = { ap_tot: 100, ap_1: 100, ap_2: 100, ap_3: 100, ap_4: 100, ap_5: 100, p: 1.0001, nota_mt: 500, nota_lp: 500, nota_media: 10, ideb: 10, meta: 10 };
const ALIAS: Record<string, string> = { rgdosul: 'riograndedosul', rgdonorte: 'riograndedonorte', mgdosul: 'matogrossodosul' };
export const learnKey = (s: string): string => { const k = s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, ''); return ALIAS[k] ?? k; };
export const redeCode = (s: string): number | undefined => REDE_CODE[learnKey(s)];

export function buildIdebYear(files: IdebFile[], ent: LearnEntities, onlyYears?: number[]): Map<string, IdebSlice> {
  const slices = new Map<string, IdebSlice>();
  const sliceOf = (uf: number, year: number): IdebSlice => { const k = `${year}:${uf}`; let s = slices.get(k); if (!s) { s = { uf, year, school: [], terr: [], cov: [], rejects: [] }; slices.set(k, s); } return s; };
  const covOf = (s: IdebSlice, lvl: number): LearnCovRow => { let c = s.cov.find(x => x.lvl === lvl); if (!c) { c = { year: s.year, uf: s.uf, family: LEARN_FAMILY.ideb, lvl, rows_in: 0, valid: 0, rejected: 0, no_identity: 0, cells_num: 0, cells_supp: 0 }; s.cov.push(c); } return c; };
  const seen = new Set<string>(); const schoolRows = new Map<string, { slice: IdebSlice; r: IdebRow }>(); const terrRows = new Map<string, { slice: IdebSlice; r: IdebRow }>();
  for (const f of files) for (const r of f.rows) {
    if (onlyYears && !onlyYears.includes(r.year)) continue;
    const school = f.level === 'escolas'; let uf = 0; let entityId = 0; let inep = 0; let rej: IdebReject | null = null; let noIdentity = false;
    const dep = redeCode(r.rede);
    if (school) {
      const ok = /^\d{8}$/.test(r.k3) && Number(r.k3) >= 10_000_000; inep = ok ? Number(r.k3) : 0;
      const u = ent.ufBySigla.get(r.k1.trim().toUpperCase()); uf = u ?? 0;
      if (!ok) rej = 'INEP_INVALIDO'; else if (u == null) rej = 'UF_INEXISTENTE'; else if (!ent.schools.has(inep)) { rej = 'SEM_IDENTIDADE_ESCOLAR'; noIdentity = true; }
    } else if (f.level === 'municipios') {
      const code = Number(r.k2); const e = ent.byIbge7.get(code) ?? (String(r.k2).length === 6 ? ent.byIbge6?.get(code) : undefined);
      if (!e) rej = 'MUNICIPIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; }
    } else {
      const e = ent.geo.get(learnKey(r.k1)); if (!e) rej = 'TERRITORIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; }
    }
    if (!rej && dep === undefined) rej = 'REDE_INVALIDA';
    const s = sliceOf(uf, r.year); const c = covOf(s, school ? 1 : 2); c.rows_in++;
    const vals: IdebRow = {}; let n = 0;
    if (!rej) for (const m of IDEB_MEASURES) {
      const raw = (r.v[m] ?? '').trim();
      if (raw === '') { vals[m] = null; continue; }
      if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(raw)) { rej = 'VALOR_INVALIDO'; break; }
      const x = Number(raw); if (x < 0 || x > MAX[m]!) { rej = 'VALOR_FORA_DE_FAIXA'; break; }
      vals[m] = x; n++;
    }
    if (!rej) { const key = school ? `${inep}|${r.year}|${r.stage}` : `${entityId}|${r.year}|${r.stage}|${dep}`; if (seen.has(key)) rej = 'CHAVE_DUPLICADA'; seen.add(key); }
    if (rej) { c.rejected++; if (noIdentity) c.no_identity++; s.rejects.push({ level: f.level, row: r.row, reason: rej }); continue; }
    if (n === 0) continue;    // linha sem nenhum valor publicado: só cobertura
    c.valid++; c.cells_num += n;
    if (school) schoolRows.set(`${inep}|${r.year}|${r.stage}`, { slice: s, r: { inep, year: r.year, stage: r.stage, uf, dep: dep!, ...vals } });
    else terrRows.set(`${entityId}|${r.year}|${r.stage}|${dep}`, { slice: s, r: { year: r.year, entity_id: entityId, stage: r.stage, dep: dep!, ...vals } });
  }
  for (const { slice, r } of schoolRows.values()) slice.school.push(r);
  for (const { slice, r } of terrRows.values()) slice.terr.push(r);
  for (const s of slices.values()) { s.school.sort((a, b) => a.inep! - b.inep! || a.stage! - b.stage!); s.terr.sort((a, b) => a.entity_id! - b.entity_id! || a.stage! - b.stage! || a.dep! - b.dep!); s.cov.sort((a, b) => a.lvl - b.lvl); }
  return slices;
}

export const idebSliceFingerprint = (fileShas: string[], slice: IdebSlice): string =>
  sha256(`${fileShas.join(',')}:${IDEB_VERSION.parser}:${IDEB_VERSION.publish}:` + JSON.stringify(slice.school.map(r => [r.inep, r.stage, r.dep, ...IDEB_MEASURES.map(m => r[m])])) + JSON.stringify(slice.terr.map(r => [r.entity_id, r.stage, r.dep, ...IDEB_MEASURES.map(m => r[m])])) + JSON.stringify(slice.cov));
