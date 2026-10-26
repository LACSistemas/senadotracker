import { sha256 } from './publication.ts';
import { DOC_COLS } from './educacao-doc-catalog.ts';

/**
 * Docentes OFICIAIS (P10.3): contagens da Sinopse Estatística da Educação Básica, tabelas 2.1 (por etapa) e 2.2 (por localização e dependência), para Brasil, UF e município. Puro (sem banco).
 * Unidade: DOCENTE (pessoa contada uma vez em cada nível de agregação e em cada coluna da tabela). Regras (versionar DOC_VERSION ao mudar):
 *  - O total de um município (ou UF, ou Brasil) NÃO é a soma das escolas, nem das etapas, nem das redes: quem leciona em duas escolas, etapas ou redes conta em cada uma. Exemplo 2025, Brasil:
 *    rede pública 1.908.735 + rede privada 573.953 = 2.482.688 > total 2.407.049 docentes distintos.
 *  - Colunas ausentes da edição ficam NULL; zero é zero publicado.
 *  - O cálculo por escola (QT_DOC_BAS) não é publicado aqui: somar escolas superconta (~22%). Para a escola o Cívica usa os indicadores oficiais do INEP.
 */
export const DOC_VERSION = { parser: 'edu-doc-1', publish: 'edu-doc-pub-1' } as const;
export const docCompetence = (year: number): number => year * 100 + 5;
export interface DocRaw { row: number; key: string; kind: string; v: Record<string, string> }
export interface DocEntities { brasil: number; uf: Map<string, { entityId: number; uf: number }>; mun: Map<number, { entityId: number; uf: number }> }
export type DocReject = 'TERRITORIO_INEXISTENTE' | 'VALOR_INVALIDO' | 'CHAVE_DUPLICADA';
export type DocRow = Record<string, number | null>;
export interface DocSlice { uf: number; rows: DocRow[]; rejects: Array<{ row: number; reason: DocReject }> }
const strip = (s: string): string => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
export const docKey = strip;

export function buildDocYear(year: number, rows: DocRaw[], ent: DocEntities): { slices: Map<number, DocSlice>; rejects: Array<{ row: number; reason: DocReject }> } {
  const slices = new Map<number, DocSlice>(); const rejects: Array<{ row: number; reason: DocReject }> = []; const seen = new Set<number>();
  const sliceOf = (uf: number) => { let s = slices.get(uf); if (!s) { s = { uf, rows: [], rejects: [] }; slices.set(uf, s); } return s; };
  for (const r of rows) {
    let target: { entityId: number; uf: number } | undefined;
    if (r.kind === 'brasil') target = { entityId: ent.brasil, uf: 0 };
    else if (r.kind === 'uf') target = ent.uf.get(strip(r.key));
    else if (r.kind === 'mun') target = ent.mun.get(Number(r.key));
    const rej = (reason: DocReject) => { rejects.push({ row: r.row, reason }); sliceOf(target?.uf ?? 0).rejects.push({ row: r.row, reason }); };
    if (!target) { rej('TERRITORIO_INEXISTENTE'); continue; }
    if (seen.has(target.entityId)) { rej('CHAVE_DUPLICADA'); continue; }
    seen.add(target.entityId);
    const row: DocRow = { year, entity_id: target.entityId }; let bad = false;
    for (const c of DOC_COLS) { const raw = (r.v[c] ?? '').trim(); if (raw === '') { row[c] = null; continue; } if (!/^\d+$/.test(raw)) { bad = true; break; } row[c] = Number(raw); }
    if (bad) { rej('VALOR_INVALIDO'); continue; }
    sliceOf(target.uf).rows.push(row);
  }
  for (const s of slices.values()) s.rows.sort((a, b) => a.entity_id! - b.entity_id!);
  return { slices, rejects };
}
export const docSliceFingerprint = (fileShas: string[], slice: DocSlice): string =>
  sha256(`${fileShas.join(',')}:${DOC_VERSION.parser}:${DOC_VERSION.publish}:` + JSON.stringify(slice.rows.map(r => [r.entity_id, ...DOC_COLS.map(c => r[c])])));
