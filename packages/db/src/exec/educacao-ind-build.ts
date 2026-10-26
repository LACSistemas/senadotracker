import { IND_BY_CODE, IND_MEASURES, IND_SCHOOL_COLS, IND_TERR_COLS, IND_DEP, IND_LOC, type IndFamily } from './educacao-ind-catalog.ts';
import { sha256 } from './publication.ts';

/**
 * Indicadores Educacionais oficiais do INEP (P10.3): validação e montagem das fatias UF × edição. Puro (sem banco): testável com linhas sintéticas.
 * Contrato: docs/executivo-collector-plan/educacao-p103-execucao/CATALOGO_INDICADORES_INEP_P103.csv. Regras de significado (versionar IND_VERSION ao mudar):
 *  - O valor é o PUBLICADO pelo INEP (planilha oficial). Nada é recalculado, somado ou ponderado aqui: município, UF e Brasil vêm das planilhas territoriais, nunca da média das escolas.
 *  - "--" (e célula vazia) = suprimido ou etapa que não se aplica = NULL; zero publicado = 0. Valor fora da faixa física do indicador rejeita a linha (não é "corrigido").
 *  - Linha sem nenhum valor publicado não gera linha no banco (entra só na cobertura).
 */
export const IND_VERSION = { parser: 'edu-ind-8', publish: 'edu-ind-pub-1' } as const;
export const indCompetence = (year: number): number => year * 100 + 5;
export const IND_FAMILY_ID: Record<IndFamily, number> = { ATU: 1, HAD: 2, DSU: 3, AFD: 4, IED: 5, IRD: 6, ICG: 7 };
export type IndFileLevel = 'escolas' | 'municipios' | 'uf';
export interface IndRawRow { row: number; inep?: string; ibge7?: string; geo?: string; loc?: string; dep?: string; v: Record<string, string> }
export interface IndFileRows { family: IndFamily; level: IndFileLevel; sha256: string[]; rows: IndRawRow[] }
export interface IndEntities { byIbge7: Map<number, { entityId: number; uf: number }>; byIbge6?: Map<number, { entityId: number; uf: number }>; geo: Map<string, { entityId: number; uf: number }> }
export type IndReject = 'INEP_INVALIDO' | 'FORA_DO_CADASTRO' | 'MUNICIPIO_INEXISTENTE' | 'TERRITORIO_INEXISTENTE' | 'DEP_LOC_INVALIDO' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA' | 'INEP_DUPLICADO' | 'CHAVE_DUPLICADA';
export type IndRow = Record<string, number | null>;
export interface IndCovRow { year: number; uf: number; family: number; lvl: number; rows_in: number; valid: number; rejected: number; no_value: number; cells_num: number; cells_dash: number }
export interface IndSlice { uf: number; school: IndRow[]; terr: IndRow[]; cov: IndCovRow[]; rejects: Array<{ family: string; level: string; row: number; reason: IndReject }> }
export interface IndYearBuilt { year: number; slices: Map<number, IndSlice>; rejects: Array<{ family: string; level: string; row: number; reason: IndReject }> }

/** Faixa física máxima do valor ×escala (smallint). ATU/HAD/DSU/AFD/IED em % ou unidade; ird_media e icg_nivel têm faixa própria. */
const MAX_SCALED = (code: string): number => {
  const mm = IND_BY_CODE.get(code)!;
  if (mm.family === 'ATU') return 32767;                 // até 3.276,7 alunos por turma (o arquivo oficial de 2025 tem uma escola com 634,9: dado oficial mantido)
  if (mm.family === 'HAD') return 240;                   // 24 h × 10
  if (code === 'ird_media') return 5000;
  if (code === 'icg_nivel') return 6;
  return 1000;                                           // percentuais 0–100 × 10
};
const strip = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export const parseDepLoc = (dep: string, loc: string): { dep: number; loc: number } | null => {
  const d = IND_DEP[strip(dep)], l = IND_LOC[strip(loc)];
  return d === undefined || l === undefined ? null : { dep: d, loc: l };
};
type Cell = { v: number | null; st: 'num' | 'dash' | 'empty' | 'bad' | 'range' };
export function parseCell(code: string, raw: string): Cell {
  const s = (raw ?? '').trim();
  if (s === '') return { v: null, st: 'empty' };
  if (s === '--' || s === '-' || s === '*' || s === '...') return { v: null, st: 'dash' };
  const mm = IND_BY_CODE.get(code)!; let num: number;
  if (code === 'icg_nivel') { const g = /(\d)/.exec(s); if (!g) return { v: null, st: 'bad' }; num = Number(g[1]); }
  else { if (!/^-?\d+(\.\d+)?(e-?\d+)?$/i.test(s)) return { v: null, st: 'bad' }; num = Number(s); }
  if (!Number.isFinite(num) || num < 0) return { v: null, st: 'range' };
  const scaled = code === 'icg_nivel' ? num : Math.round(num * mm.scale);
  if (scaled > MAX_SCALED(code) || (code === 'icg_nivel' && (num < 1 || num > 6))) return { v: null, st: 'range' };
  return { v: scaled, st: 'num' };
}

export function buildIndYear(year: number, files: IndFileRows[], cadastro: Map<number, number>, ent: IndEntities): IndYearBuilt {
  const slices = new Map<number, IndSlice>(); const rejects: IndYearBuilt['rejects'] = [];
  const sliceOf = (uf: number): IndSlice => { let s = slices.get(uf); if (!s) { s = { uf, school: [], terr: [], cov: [], rejects: [] }; slices.set(uf, s); } return s; };
  const covOf = (s: IndSlice, fam: IndFamily, lvl: number): IndCovRow => {
    let c = s.cov.find(x => x.family === IND_FAMILY_ID[fam] && x.lvl === lvl);
    if (!c) { c = { year, uf: s.uf, family: IND_FAMILY_ID[fam], lvl, rows_in: 0, valid: 0, rejected: 0, no_value: 0, cells_num: 0, cells_dash: 0 }; s.cov.push(c); }
    return c;
  };
  const schoolRows = new Map<number, { uf: number; r: IndRow }>(); const terrRows = new Map<string, { uf: number; r: IndRow }>(); const seenSchool = new Set<string>();
  for (const f of files) {
    const seenKey = new Set<string>();
    const cols = IND_MEASURES.filter(x => x.family === f.family && (f.level === 'escolas' ? x.level !== 'terr' : x.level !== 'school')).map(x => x.code);
    for (const r of f.rows) {
      const lvl = f.level === 'escolas' ? 1 : 2;
      let uf = 0; let entityId = 0; let dl: { dep: number; loc: number } | null = null; let inep = 0; let rej: IndReject | null = null;
      if (f.level === 'escolas') {
        const ok = /^\d{8}$/.test(r.inep ?? '') && Number(r.inep) >= 10_000_000; inep = ok ? Number(r.inep) : 0;
        if (!ok) rej = 'INEP_INVALIDO'; else if (!cadastro.has(inep)) rej = 'FORA_DO_CADASTRO'; else { uf = cadastro.get(inep)!; if (seenKey.has(String(inep))) rej = 'INEP_DUPLICADO'; seenKey.add(String(inep)); }
      } else {
        dl = parseDepLoc(r.dep ?? '', r.loc ?? '');
        if (!dl) rej = 'DEP_LOC_INVALIDO';
        else if (f.level === 'municipios') { const code = Number(r.ibge7); const e = ent.byIbge7.get(code) ?? (String(r.ibge7).length === 6 ? ent.byIbge6?.get(code) : undefined); if (!e) rej = 'MUNICIPIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; } }
        else { const e = ent.geo.get(strip(r.geo ?? '')); if (!e) rej = 'TERRITORIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; } }
        if (!rej) { const k = `${entityId}|${dl!.dep}|${dl!.loc}`; if (seenKey.has(k)) rej = 'CHAVE_DUPLICADA'; seenKey.add(k); }
      }
      const s = sliceOf(uf); const c = covOf(s, f.family, lvl); c.rows_in++;
      const vals: IndRow = {}; let any = false;
      if (!rej) {
        for (const code of cols) {
          const cell = parseCell(code, r.v[code] ?? '');
          if (cell.st === 'bad') { rej = 'VALOR_INVALIDO'; break; }
          if (cell.st === 'range') { rej = 'VALOR_FORA_DE_FAIXA'; break; }
          if (cell.st === 'num') { c.cells_num++; any = true; } else if (cell.st === 'dash') c.cells_dash++;
          vals[code] = cell.v;
        }
      }
      if (rej) { c.rejected++; rejects.push({ family: f.family, level: f.level, row: r.row, reason: rej }); s.rejects.push({ family: f.family, level: f.level, row: r.row, reason: rej }); continue; }
      if (!any) { c.no_value++; continue; }
      c.valid++;
      if (f.level === 'escolas') {
        const cur = schoolRows.get(inep) ?? { uf, r: { inep, year } as unknown as IndRow };
        Object.assign(cur.r, vals); schoolRows.set(inep, cur);
      } else {
        const k = `${entityId}|${dl!.dep}|${dl!.loc}`;
        const cur = terrRows.get(k) ?? { uf, r: { year, entity_id: entityId, dep: dl!.dep, loc: dl!.loc } as unknown as IndRow };
        Object.assign(cur.r, vals); terrRows.set(k, cur);
      }
    }
  }
  for (const { uf, r } of schoolRows.values()) { const row: IndRow = { inep: r.inep!, year }; for (const c of IND_SCHOOL_COLS) row[c] = r[c] ?? null; sliceOf(uf).school.push(row); }
  for (const { uf, r } of terrRows.values()) { const row: IndRow = { year, entity_id: r.entity_id!, dep: r.dep!, loc: r.loc! }; for (const c of IND_TERR_COLS) row[c] = r[c] ?? null; sliceOf(uf).terr.push(row); }
  void seenSchool;
  for (const s of slices.values()) {
    s.school.sort((a, b) => a.inep! - b.inep!); s.terr.sort((a, b) => a.entity_id! - b.entity_id! || a.dep! - b.dep! || a.loc! - b.loc!); s.cov.sort((a, b) => a.family - b.family || a.lvl - b.lvl);
  }
  return { year, slices, rejects };
}

export const indSliceFingerprint = (fileShas: string[], slice: IndSlice): string =>
  sha256(`${fileShas.join(',')}:${IND_VERSION.parser}:${IND_VERSION.publish}:` + JSON.stringify(slice.school.map(r => [r.inep, ...IND_SCHOOL_COLS.map(c => r[c])])) + JSON.stringify(slice.terr.map(r => [r.entity_id, r.dep, r.loc, ...IND_TERR_COLS.map(c => r[c])])) + JSON.stringify(slice.cov));
