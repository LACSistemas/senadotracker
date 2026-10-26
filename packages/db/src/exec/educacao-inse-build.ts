import { INSE_LEVEL_COLS, INSE_MEDIA_SCALE, INSE_SCALE, LOC_CODE } from './educacao-flow-catalog.ts';
import { LEARN_FAMILY, learnKey, type LearnCovRow, type LearnEntities } from './educacao-ideb-build.ts';
import { sha256 } from './publication.ts';

/**
 * INSE (P10.4): Indicador de Nível Socioeconômico do Inep (Saeb 2019, 2021, 2023), agregado por escola, município, UF e Brasil. Puro (sem banco).
 * Regras (versionar INSE_VERSION ao mudar): linhas idênticas repetidas (município 2023) valem uma só e são contadas em `identicalRepeats`; só agregados oficiais (nenhum dado de aluno); média ×10000 e distribuição por nível ×100 (conferido); vazio = NULL, nunca zero; linha com qtd = 0 e média 0 é o
 * marcador de "não calculado" do arquivo e vira média NULL (sem inventar nível); a escala de 2019 e a de 2021/2023 não são comparáveis; dep segue o esquema único de rede (5 = pública: federal+estadual+municipal; 6 = estadual+municipal; os códigos 5 e 6 do arquivo do Inep vêm trocados e são convertidos).
 */
export const INSE_VERSION = { parser: 'edu-inse-2', publish: 'edu-inse-pub-1' } as const;
export type InseLevel = 'brasil' | 'estados' | 'municipios' | 'escolas';
export interface InseRaw { row: number; year: number; level: InseLevel; uf_code: string; uf: string; ibge7: string; inep: string; dep: string; loc: string; cap: string; qtd: string; media: string; cls: string; nv: string[] }
export interface InseFile { level: InseLevel; sha256: string[]; rows: InseRaw[] }
export type InseReject = 'INEP_INVALIDO' | 'SEM_IDENTIDADE_ESCOLAR' | 'MUNICIPIO_INEXISTENTE' | 'TERRITORIO_INEXISTENTE' | 'REDE_INVALIDA' | 'LOCALIZACAO_INVALIDA' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA' | 'CHAVE_DUPLICADA';
export type InseRow = Record<string, number | null>;
export interface InseEntities extends LearnEntities { uf: Map<number, { entityId: number; uf: number }>; brasil: number }
export interface InseSlice { uf: number; year: number; school: InseRow[]; terr: InseRow[]; cov: LearnCovRow[]; rejects: Array<{ level: string; row: number; reason: InseReject }>; lossy: number; sumChecked: number; sumOff: number; identicalRepeats: number }
const DEPS = new Set([0, 1, 2, 3, 4, 5, 6]);
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8 };
export const inseClass = (s: string): number | null | undefined => { const t = s.trim(); if (t === '') return null; const m = /^n[ií]vel\s+([ivx]+)$/i.exec(t); return m ? ROMAN[m[1]!.toLowerCase()] : undefined; };

export function buildInseYear(files: InseFile[], ent: InseEntities): Map<string, InseSlice> {
  const slices = new Map<string, InseSlice>(); const seen = new Map<string, string>();
  const sliceOf = (uf: number, year: number): InseSlice => { const k = `${year}:${uf}`; let s = slices.get(k); if (!s) { s = { uf, year, school: [], terr: [], cov: [], rejects: [], lossy: 0, sumChecked: 0, sumOff: 0, identicalRepeats: 0 }; slices.set(k, s); } return s; };
  const covOf = (s: InseSlice, lvl: number): LearnCovRow => { let c = s.cov.find(x => x.lvl === lvl); if (!c) { c = { year: s.year, uf: s.uf, family: LEARN_FAMILY.inse, lvl, rows_in: 0, valid: 0, rejected: 0, no_identity: 0, cells_num: 0, cells_supp: 0 }; s.cov.push(c); } return c; };
  for (const f of files) for (const r of f.rows) {
    const school = f.level === 'escolas'; let uf = 0, entityId = 0, inep = 0; let rej: InseReject | null = null; let noIdentity = false;
    // Inep: 5 = estadual+municipal, 6 = federal+estadual+municipal; aqui 5 = pública (como no Ideb) e 6 = estadual+municipal
    const depRaw = r.dep === '' ? undefined : Number(r.dep); const dep = depRaw === 5 ? 6 : depRaw === 6 ? 5 : depRaw;
    const loc = r.loc === '' ? 0 : LOC_CODE[learnKey(r.loc)] ?? (/^[0-2]$/.test(r.loc) ? Number(r.loc) : undefined); const cap = r.cap === '' ? 0 : /^[0-2]$/.test(r.cap) ? Number(r.cap) : undefined;
    const ufRow = ent.uf.get(Number(r.uf_code));
    if (school) {
      const ok = /^\d{8}$/.test(r.inep) && Number(r.inep) >= 10_000_000; inep = ok ? Number(r.inep) : 0; uf = ufRow?.uf ?? 0;
      if (!ok) rej = 'INEP_INVALIDO'; else if (!ufRow) rej = 'TERRITORIO_INEXISTENTE'; else if (!ent.schools.has(inep)) { rej = 'SEM_IDENTIDADE_ESCOLAR'; noIdentity = true; }
    } else if (f.level === 'municipios') {
      const e = ent.byIbge7.get(Number(r.ibge7)); if (!e) rej = 'MUNICIPIO_INEXISTENTE'; else { uf = e.uf; entityId = e.entityId; }
    } else if (f.level === 'estados') { if (!ufRow) rej = 'TERRITORIO_INEXISTENTE'; else { uf = ufRow.uf; entityId = ufRow.entityId; } }
    else { uf = 0; entityId = ent.brasil; }
    if (!rej && (dep === undefined || !DEPS.has(dep) || (school && (dep < 1 || dep > 3)))) rej = 'REDE_INVALIDA';
    if (!rej && (loc === undefined || (school && loc === 0))) rej = 'LOCALIZACAO_INVALIDA';
    if (!rej && cap === undefined) rej = 'LOCALIZACAO_INVALIDA';
    const s = sliceOf(uf, r.year); const c = covOf(s, school ? 1 : 2); c.rows_in++;
    const vals: InseRow = {}; let n = 0; let bad = false, range = false;
    if (!rej) {
      const put = (k: string, raw: string, scale: number, max: number, int = false): void => {
        const t = raw.trim(); if (t === '') { vals[k] = null; return; }
        if (!/^\d+(\.\d+)?$/.test(t)) { bad = true; return; }
        const x = Number(t); if (x > max) { range = true; return; }
        const sc = x * scale; const q = Math.round(sc); if (!int && Math.abs(sc - q) > 1e-6) s.lossy++;
        vals[k] = q; n++;
      };
      put('qtd', r.qtd, 1, 1e9, true); put('media', r.media, INSE_MEDIA_SCALE, 10);
      INSE_LEVEL_COLS.forEach((col, i) => put(col, r.nv[i] ?? '', INSE_SCALE, 100));
      const cls = school ? inseClass(r.cls) : null; if (cls === undefined) bad = true;
      if (!bad && !range) {
        if (vals.qtd === 0 && vals.media === 0) { vals.media = null; n--; }
        if (school) vals.cls = cls ?? null;
        const lv = INSE_LEVEL_COLS.map(k => vals[k]); if (lv.every(x => x != null)) { s.sumChecked++; if (Math.abs((lv as number[]).reduce((a, b) => a + b, 0) / INSE_SCALE - 100) > 0.1) s.sumOff++; }
      }
      if (bad) rej = 'VALOR_INVALIDO'; else if (range) rej = 'VALOR_FORA_DE_FAIXA';
    }
    const key = school ? `${r.year}|${inep}` : `${r.year}|${entityId}|${dep}|${loc}|${cap}`;
    // o arquivo municipal de 2023 repete linhas idênticas (defeito da fonte): a repetição idêntica é contada e descartada; valor diferente na mesma chave é duplicidade
    const sig = JSON.stringify([r.qtd, r.media, r.cls, r.nv]);
    if (!rej) { const prev = seen.get(key); if (prev === sig) { s.identicalRepeats++; c.rows_in--; continue; } if (prev !== undefined) rej = 'CHAVE_DUPLICADA'; else seen.set(key, sig); }
    if (rej) { c.rejected++; if (noIdentity) c.no_identity++; s.rejects.push({ level: f.level, row: r.row, reason: rej }); continue; }
    if (n === 0 && vals.qtd == null) continue;
    c.valid++; c.cells_num += n;
    if (school) s.school.push({ inep, year: r.year, uf, dep: dep!, loc: loc!, qtd: vals.qtd ?? null, media: vals.media ?? null, cls: vals.cls ?? null, ...Object.fromEntries(INSE_LEVEL_COLS.map(k => [k, vals[k] ?? null])) });
    else s.terr.push({ year: r.year, entity_id: entityId, dep: dep!, loc: loc!, cap: cap!, qtd: vals.qtd ?? null, media: vals.media ?? null, ...Object.fromEntries(INSE_LEVEL_COLS.map(k => [k, vals[k] ?? null])) });
  }
  for (const s of slices.values()) { s.school.sort((a, b) => a.inep! - b.inep!); s.terr.sort((a, b) => a.entity_id! - b.entity_id! || a.dep! - b.dep! || a.loc! - b.loc! || a.cap! - b.cap!); s.cov.sort((a, b) => a.lvl - b.lvl); }
  return slices;
}
export const inseSliceFingerprint = (fileShas: string[], slice: InseSlice): string =>
  sha256(`${fileShas.join(',')}:${INSE_VERSION.parser}:${INSE_VERSION.publish}:` + JSON.stringify(slice.school.map(r => [r.inep, r.dep, r.loc, r.qtd, r.media, r.cls, ...INSE_LEVEL_COLS.map(k => r[k])])) + JSON.stringify(slice.terr.map(r => [r.entity_id, r.dep, r.loc, r.cap, r.qtd, r.media, ...INSE_LEVEL_COLS.map(k => r[k])])) + JSON.stringify(slice.cov));
