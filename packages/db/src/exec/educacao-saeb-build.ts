import { SAEB_LEVEL_COLS, SAEB_SCALE, SAEB_SUBJECTS } from './educacao-learn-catalog.ts';
import { LEARN_FAMILY, learnKey, redeCode, type LearnCovRow, type LearnEntities } from './educacao-ideb-build.ts';
import { sha256 } from './publication.ts';

/**
 * Saeb (P10.4): resultados AGREGADOS oficiais (Brasil, regiões, UF, município) por dependência × localização × capital × série × disciplina. Puro (sem banco).
 * Regras (versionar SAEB_VERSION ao mudar): nenhum microdado de aluno; proficiência média e distribuição por nível como publicadas (×100, 2 casas, conferido); vazio/"-" = NULL, nunca zero;
 * nada é ponderado, somado ou recalculado (a média de uma rede não é a média das escolas); escalas de edições/séries/disciplinas diferentes não são comparáveis entre si;
 * alfabetização (TX_ALFABETIZADO em 2021, PC_ALFABETIZADO em 2023) é outro conceito que a média do 2º ano e só existe onde o INEP a publicou.
 */
export const SAEB_VERSION = { parser: 'edu-saeb-2', publish: 'edu-saeb-pub-1' } as const;
export type SaebLevel = 'brasil' | 'regioes' | 'estados' | 'municipios';
export interface SaebRaw { row: number; year: number; level: SaebLevel; uf: string; ibge7: string; name: string; dep: string; loc: string; cap: string; grade: number; subj: string; media: string; tx_alf: string; nv: string[] }
export interface SaebFile { level: SaebLevel; sha256: string[]; rows: SaebRaw[] }
export type SaebReject = 'TERRITORIO_INEXISTENTE' | 'REDE_INVALIDA' | 'DISCIPLINA_INVALIDA' | 'VALOR_INVALIDO' | 'VALOR_FORA_DE_FAIXA' | 'CHAVE_DUPLICADA';
export type SaebRow = Record<string, number | null>;
export interface SaebSlice { uf: number; year: number; rows: SaebRow[]; cov: LearnCovRow; rejects: Array<{ row: number; reason: SaebReject }>; lossy: number; emptyStrata: number }
const LOC: Record<string, number> = { total: 0, urbana: 1, rural: 2 }, CAP: Record<string, number> = { total: 0, capital: 1, interior: 2 };
const scaled = (s: string): { v: number | null; lossy: boolean; bad: boolean } => {
  const t = s.trim(); if (t === '') return { v: null, lossy: false, bad: false };
  if (!/^-?\d+(\.\d+)?$/.test(t)) return { v: null, lossy: false, bad: true };
  const x = Number(t) * SAEB_SCALE; const r = Math.round(x); return { v: r, lossy: Math.abs(x - r) > 1e-6, bad: false };
};

export function buildSaebYear(files: SaebFile[], ent: LearnEntities & { uf: Map<number, { entityId: number; uf: number }>; brasil: number }): Map<string, SaebSlice> {
  const slices = new Map<string, SaebSlice>(); const seen = new Set<string>();
  const sliceOf = (uf: number, year: number): SaebSlice => { const k = `${year}:${uf}`; let s = slices.get(k); if (!s) { s = { uf, year, rows: [], cov: { year, uf, family: LEARN_FAMILY.saeb, lvl: 2, rows_in: 0, valid: 0, rejected: 0, no_identity: 0, cells_num: 0, cells_supp: 0 }, rejects: [], lossy: 0, emptyStrata: 0 }; slices.set(k, s); } return s; };
  for (const f of files) for (const r of f.rows) {
    let t: { entityId: number; uf: number } | undefined;
    if (f.level === 'brasil') t = { entityId: ent.brasil, uf: 0 };
    else if (f.level === 'regioes') t = ent.geo.get(learnKey(r.name));
    else if (f.level === 'estados') t = ent.uf.get(Number(r.uf)) ?? ent.geo.get(learnKey(r.name));
    else t = ent.byIbge7.get(Number(r.ibge7)) ?? (r.ibge7.length === 6 ? ent.byIbge6?.get(Number(r.ibge7)) : undefined);
    const s = sliceOf(t?.uf ?? 0, r.year); s.cov.rows_in++;
    const rej = (reason: SaebReject) => { s.cov.rejected++; s.rejects.push({ row: r.row, reason }); };
    if (!t) { rej('TERRITORIO_INEXISTENTE'); continue; }
    // dependência: "Total - … e Privada" = 0; "Total - Federal, Estadual e Municipal" = 5 (pública); "Total - Estadual e Municipal" = 6
    const dep = /^total/i.test(r.dep.trim()) ? (/privada/i.test(r.dep) ? 0 : /federal/i.test(r.dep) ? 5 : 6) : redeCode(r.dep);  const loc = LOC[learnKey(r.loc)] ?? (r.loc === '' ? 0 : undefined); const cap = r.cap === '' ? 0 : CAP[learnKey(r.cap)];
    const subj = SAEB_SUBJECTS[r.subj.toUpperCase()];
    if (dep === undefined || loc === undefined || cap === undefined) { rej('REDE_INVALIDA'); continue; }
    if (subj === undefined) { rej('DISCIPLINA_INVALIDA'); continue; }
    const row: SaebRow = { year: r.year, entity_id: t.entityId, dep, loc, cap, grade: r.grade, subj };
    let bad = false, range = false, n = 0;
    const put = (k: string, raw: string, max: number) => { const x = scaled(raw); if (x.bad) { bad = true; return; } if (x.v != null && (x.v < 0 || x.v > max * SAEB_SCALE)) { range = true; return; } if (x.lossy) s.lossy++; row[k] = x.v; if (x.v != null) n++; };
    put('media', r.media, 1000); put('tx_alf', r.tx_alf, 100);
    SAEB_LEVEL_COLS.forEach((c, i) => put(c, r.nv[i] ?? '', 100));
    if (bad) { rej('VALOR_INVALIDO'); continue; } if (range) { rej('VALOR_FORA_DE_FAIXA'); continue; }
    // estrato sem alunos: nos arquivos de UF e Brasil de 2017 o INEP grava média 0 e distribuição toda 0 (marcador, não resultado; a proficiência real nunca é 0) — fica ausente, contado em emptyStrata
    if (row.media === 0 && SAEB_LEVEL_COLS.every(c => row[c] == null || row[c] === 0) && row.tx_alf == null) { s.emptyStrata++; s.cov.rows_in--; continue; }
    if (n === 0) continue;
    const key = `${r.year}|${t.entityId}|${dep}|${loc}|${cap}|${r.grade}|${subj}`;
    const prior = slices.get(`${r.year}:${t.uf}`)!.rows.find(x => x.entity_id === t.entityId && x.dep === dep && x.loc === loc && x.cap === cap && x.grade === r.grade && x.subj === subj);
    if (seen.has(key)) {
      // o arquivo de alfabetização de 2021 repete a média do 2º ano: a repetição idêntica é aceita e só acrescenta a taxa; conflito de valor é duplicidade
      if (prior && (prior.media == null || row.media == null || prior.media === row.media)) { if (row.tx_alf != null) { prior.tx_alf = row.tx_alf; s.cov.cells_num++; } s.cov.rows_in--; continue; }
      rej('CHAVE_DUPLICADA'); continue;
    }
    seen.add(key); for (const c of SAEB_LEVEL_COLS) if (row[c] === undefined) row[c] = null; if (row.tx_alf === undefined) row.tx_alf = null; if (row.media === undefined) row.media = null;
    s.rows.push(row); s.cov.valid++; s.cov.cells_num += n;
  }
  for (const s of slices.values()) s.rows.sort((a, b) => a.entity_id! - b.entity_id! || a.dep! - b.dep! || a.loc! - b.loc! || a.cap! - b.cap! || a.grade! - b.grade! || a.subj! - b.subj!);
  return slices;
}
export const saebSliceFingerprint = (fileShas: string[], slice: SaebSlice): string =>
  sha256(`${fileShas.join(',')}:${SAEB_VERSION.parser}:${SAEB_VERSION.publish}:` + JSON.stringify(slice.rows.map(r => [r.entity_id, r.dep, r.loc, r.cap, r.grade, r.subj, r.media, r.tx_alf, ...SAEB_LEVEL_COLS.map(c => r[c])])) + JSON.stringify(slice.cov));
