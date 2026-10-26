import { FLOW_COLS, FLOW_SCALE, LOC_CODE, TDI_COLS, TRN_COLS, TXR_COLS } from './educacao-flow-catalog.ts';
import { LEARN_FAMILY, learnKey, redeCode, type LearnCovRow, type LearnEntities } from './educacao-ideb-build.ts';
import { sha256 } from './publication.ts';

/**
 * Fluxo escolar (P10.4): rendimento (TXR), distorção idade-série (TDI) e transição (TRN) por escola, município, UF, região e Brasil. Puro (sem banco).
 * Regras (versionar FLOW_VERSION ao mudar): o valor é o PUBLICADO (×100, 1 casa no arquivo; conferido); "--" e vazio = NULL, nunca zero; nada é recalculado, ponderado nem somado entre redes ou localizações;
 * a soma aprovação+reprovação+abandono (e promoção+repetência+evasão+migração) é só conferida e contada, nunca corrigida; escola exige identidade do cadastro da P10.1.
 */
export const FLOW_VERSION = { parser: 'edu-flow-1', publish: 'edu-flow-pub-1' } as const;
export type FlowFamily = 'TXR' | 'TDI' | 'TRN';
export type FlowLevel = 'escolas' | 'municipios' | 'uf';
export interface FlowRaw { row: number; key: string; uf?: string; loc: string; dep: string; v: Record<string, string> }
export interface FlowFile { family: FlowFamily; level: FlowLevel; year: number; sha256: string[]; rows: FlowRaw[] }
export type FlowReject = 'INEP_INVALIDO' | 'SEM_IDENTIDADE_ESCOLAR' | 'MUNICIPIO_INEXISTENTE' | 'TERRITORIO_INEXISTENTE' | 'REDE_INVALIDA' | 'LOCALIZACAO_INVALIDA' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA' | 'CHAVE_DUPLICADA';
export type FlowRow = Record<string, number | null>;
export interface FlowEntities extends LearnEntities { uf: Map<number, { entityId: number; uf: number }> }
export interface FlowSlice { uf: number; year: number; school: FlowRow[]; terr: FlowRow[]; cov: LearnCovRow[]; rejects: Array<{ family: string; level: string; row: number; reason: FlowReject }>; lossy: number; sumChecked: number; sumOff: number }
const FAM_COV: Record<FlowFamily, number> = { TXR: LEARN_FAMILY.tx_rend, TDI: LEARN_FAMILY.tdi, TRN: LEARN_FAMILY.transicao };
const FAM_COLS: Record<FlowFamily, string[]> = { TXR: TXR_COLS, TDI: TDI_COLS, TRN: TRN_COLS };
/** conjuntos que devem somar ~100 (cada parcela vem arredondada a 1 casa: tolerância 0,3 ponto percentual) */
const SUM_SETS: Record<string, string[]> = { TXR: ['ap', 'rp', 'ab'], TRN: ['pro', 'rep', 'eva', 'mej'] };
const SUM_TOL = 0.3;

export function buildFlowYear(files: FlowFile[], ent: FlowEntities, mode: 'flow' | 'trn' = 'flow'): Map<string, FlowSlice> {
  const slices = new Map<string, FlowSlice>(); const seen = new Set<string>();
  const sliceOf = (uf: number, year: number): FlowSlice => { const k = `${year}:${uf}`; let s = slices.get(k); if (!s) { s = { uf, year, school: [], terr: [], cov: [], rejects: [], lossy: 0, sumChecked: 0, sumOff: 0 }; slices.set(k, s); } return s; };
  const covOf = (s: FlowSlice, family: number, lvl: number): LearnCovRow => { let c = s.cov.find(x => x.family === family && x.lvl === lvl); if (!c) { c = { year: s.year, uf: s.uf, family, lvl, rows_in: 0, valid: 0, rejected: 0, no_identity: 0, cells_num: 0, cells_supp: 0 }; s.cov.push(c); } return c; };
  const rows = new Map<string, { slice: FlowSlice; r: FlowRow }>();
  for (const f of files) {
    if ((mode === 'trn') !== (f.family === 'TRN')) continue;
    const cols = FAM_COLS[f.family]; const school = f.level === 'escolas';
    for (const r of f.rows) {
      let uf = 0, entityId = 0, inep = 0; let rej: FlowReject | null = null; let noIdentity = false;
      const dep = redeCode(r.dep); const loc = r.loc === '' ? 0 : LOC_CODE[learnKey(r.loc)];
      if (school) {
        const ok = /^\d{8}$/.test(r.key) && Number(r.key) >= 10_000_000; inep = ok ? Number(r.key) : 0;
        // UF do arquivo; as planilhas de distorção de 2013–2014 não trazem a coluna, e os dois primeiros dígitos do código da escola são o código IBGE da UF
        const prefix = ok ? Math.floor(inep / 1_000_000) : 0; const u = ent.ufBySigla.get((r.uf ?? '').trim().toUpperCase()) ?? (r.uf ? undefined : ent.uf.get(prefix)?.uf); uf = u ?? 0;
        if (!ok) rej = 'INEP_INVALIDO'; else if (u == null) rej = 'TERRITORIO_INEXISTENTE'; else if (!ent.schools.has(inep)) { rej = 'SEM_IDENTIDADE_ESCOLAR'; noIdentity = true; }
      } else if (f.level === 'municipios') {
        const e = ent.byIbge7.get(Number(r.key)) ?? (r.key.length === 6 ? ent.byIbge6?.get(Number(r.key)) : undefined);
        if (!e) rej = 'MUNICIPIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; }
      } else {
        const u = ent.ufBySigla.get(r.key.trim().toUpperCase()); const e = ent.geo.get(learnKey(r.key)) ?? (u != null ? ent.uf.get(u) : undefined);
        if (!e) rej = 'TERRITORIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; }
      }
      if (!rej && dep === undefined) rej = 'REDE_INVALIDA';
      if (!rej && loc === undefined) rej = 'LOCALIZACAO_INVALIDA';
      const s = sliceOf(uf, f.year); const c = covOf(s, FAM_COV[f.family], school ? 1 : 2); c.rows_in++;
      const vals: FlowRow = {}; let n = 0; let lossy = 0; let supp = 0;
      if (!rej) for (const m of cols) {
        const raw = (r.v[m] ?? '').trim();
        if (raw === '***' || raw === '*') { vals[m] = null; supp++; continue; }   // sigilo estatístico do Inep: preservado como ausente, nunca reconstruído; contado em cells_supp
        if (raw === '' || raw === '--' || raw === '-' || raw === '...') { vals[m] = null; continue; }
        if (!/^\d+(\.\d+)?$/.test(raw)) { rej = 'VALOR_INVALIDO'; break; }
        const x = Number(raw); if (x < 0 || x > 100.0001) { rej = 'VALOR_FORA_DE_FAIXA'; break; }
        const sc = x * FLOW_SCALE; const q = Math.round(sc); if (Math.abs(sc - q) > 1e-6) lossy++;
        vals[m] = q; n++;
      }
      const key = school ? `${f.level}|${inep}` : `${f.level}|${entityId}|${loc}|${dep}`;
      const dupKey = `${f.family}|${key}`;
      if (!rej) { if (seen.has(dupKey)) rej = 'CHAVE_DUPLICADA'; seen.add(dupKey); }
      if (rej) { c.rejected++; if (noIdentity) c.no_identity++; s.rejects.push({ family: f.family, level: f.level, row: r.row, reason: rej }); continue; }
      c.cells_supp += supp;
      if (n === 0) continue;
      c.valid++; c.cells_num += n; s.lossy += lossy;
      const set = SUM_SETS[f.family];
      if (set) {
        for (const seg of new Set(cols.map(x => x.slice(x.indexOf('_') + 1)))) {
          const parts = set.map(m => vals[`${m}_${seg}`]); if (parts.some(p => p == null || p === undefined)) continue;
          s.sumChecked++; const tot = (parts as number[]).reduce((a, b) => a + b, 0) / FLOW_SCALE; if (Math.abs(tot - 100) > SUM_TOL) s.sumOff++;
        }
      }
      const rk = `${f.year}|${key}`; const prior = rows.get(rk);
      if (prior) Object.assign(prior.r, vals);                 // rendimento e distorção da mesma escola/território/rede/localização andam juntos
      else rows.set(rk, { slice: s, r: school ? { inep, year: f.year, uf, dep: dep!, loc: loc!, ...vals } : { year: f.year, entity_id: entityId, loc: loc!, dep: dep!, ...vals } });
    }
  }
  const all = mode === 'trn' ? TRN_COLS : FLOW_COLS;
  for (const { slice, r } of rows.values()) { for (const m of all) if (r[m] === undefined) r[m] = null; (r.inep !== undefined ? slice.school : slice.terr).push(r); }
  for (const s of slices.values()) { s.school.sort((a, b) => a.inep! - b.inep!); s.terr.sort((a, b) => a.entity_id! - b.entity_id! || a.loc! - b.loc! || a.dep! - b.dep!); s.cov.sort((a, b) => a.family - b.family || a.lvl - b.lvl); }
  return slices;
}

export const flowSliceFingerprint = (fileShas: string[], slice: FlowSlice, mode: 'flow' | 'trn'): string => {
  const cols = mode === 'trn' ? TRN_COLS : FLOW_COLS;
  return sha256(`${fileShas.join(',')}:${FLOW_VERSION.parser}:${FLOW_VERSION.publish}:` + JSON.stringify(slice.school.map(r => [r.inep, r.dep, r.loc, ...cols.map(m => r[m])])) + JSON.stringify(slice.terr.map(r => [r.entity_id, r.loc, r.dep, ...cols.map(m => r[m])])) + JSON.stringify(slice.cov));
};
