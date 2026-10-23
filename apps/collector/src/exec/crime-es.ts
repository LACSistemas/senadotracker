import type { Pool } from 'pg';
import type { CrimeRecord } from '@senadotracker/db';
import { fetchSnapshot, isText, readRaw, type CrimeLoaded, type Log } from './crime.ts';
import type { StorageConfig } from './storage.ts';

const URL_OCC = 'https://one.s3.es.gov.br/pr-dl-sesp/publico/MICRODADOS_OCORRENCIAS.csv';
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
/** Tipo de incidente (acentos perdidos no arquivo) → código do contrato. */
const TYPE_RULES: Array<[RegExp, string]> = [
  [/^ESTELIONATO/, 'ESTELIONATO_FRAUDE'], [/^CRIMES INFORM/, 'CRIMES_INFORMATICOS'],
  [/^ROUBO A PESSOA/, 'ROUBO_PESSOA_VIA_PUBLICA'], [/^ROUBO EM TRANSPORTE/, 'ROUBO_TRANSPORTE_COLETIVO'], [/^ROUBO EM ESTABELECIMENTO/, 'ROUBO_ESTABELECIMENTO_COMERCIAL'], [/^ROUBO EM RESID/, 'ROUBO_RESIDENCIA_CONDOMINIO'],
  [/^FURTO A PESSOA/, 'FURTO_PESSOA_VIA_PUBLICA'], [/^FURTO EM TRANSPORTE/, 'FURTO_TRANSPORTE_COLETIVO'], [/^FURTO EM ESTABELECIMENTO/, 'FURTO_ESTABELECIMENTO_COMERCIAL'], [/^FURTO EM RESID/, 'FURTO_RESIDENCIA_CONDOMINIO'],
];
export function classifyEsType(t: string): string | null { const n = norm(t); return TYPE_RULES.find(([re]) => re.test(n))?.[1] ?? null; }

/**
 * SESP-ES: processa o CSV em memória e agrega município × mês × tipo. NÃO guarda hora, bairro, local nem qualquer atributo individual. O arquivo é atualizado diariamente:
 * o mês da última data é parcial (preliminar). Tipo desconhecido = contrato desatualizado (erro, nunca ignorado em silêncio).
 */
export async function loadEs(pool: Pool, cfg: StorageConfig, log?: Log): Promise<CrimeLoaded> {
  const f = await fetchSnapshot(pool, cfg, { url: URL_OCC, dir: 'es', name: 'MICRODADOS_OCORRENCIAS.csv', dataset: 'sesp_es_ocorrencias', uf: 32, ...(log ? { log } : {}), accept: isText });
  const text = (await readRaw(cfg, f.relPath)).toString('latin1'); const lines = text.split('\n'); const head = lines[0]!.replace(/\r$/, '').trim().split(';');
  const want = ['Data', 'Hora', 'TipoIncidente', 'TipoLocal', 'Municipio', 'Bairro']; if (want.some((c, i) => head[i] !== c)) throw new Error(`SESP-ES: layout mudou (${head.join(';')})`);
  const agg = new Map<string, number>(); const unknownTypes = new Map<string, number>(); const monthRows = new Map<number, number>(); let rows = 0, bad = 0, maxDate = '';
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i]!; if (!l.trim()) continue; const c = l.replace(/\r$/, '').split(';'); const d = c[0]!;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { bad++; continue; }
    const code = classifyEsType(c[2] ?? ''); if (!code) { unknownTypes.set(c[2] ?? '', (unknownTypes.get(c[2] ?? '') ?? 0) + 1); continue; }
    const ym = Number(d.slice(0, 4)) * 100 + Number(d.slice(5, 7)); rows++; if (d > maxDate) maxDate = d;
    const k = `${ym}|${code}|${(c[4] ?? '').trim()}`; agg.set(k, (agg.get(k) ?? 0) + 1); monthRows.set(ym, (monthRows.get(ym) ?? 0) + 1);
  }
  if (unknownTypes.size) throw new Error(`SESP-ES: tipos de incidente sem contrato: ${[...unknownTypes.keys()].join(' | ')}`);
  const records: CrimeRecord[] = []; const lastYm = Number(maxDate.slice(0, 4)) * 100 + Number(maxDate.slice(5, 7));
  for (const [k, v] of agg) { const [ym, code, mun] = k.split('|') as [string, string, string]; records.push({ ym: Number(ym), name: mun, code, value: v, prelim: Number(ym) === lastYm }); }
  return { files: [{ relPath: f.relPath, sha256: f.sha256 }], records, months: new Set(monthRows.keys()), explicitZeros: false, duplicates: 'sum',
    notes: { occurrencesCounted: rows, badDateLines: bad, maxDate, partialLastMonth: lastYm, personalAttributesPersisted: false, identicalLinesNotDeduplicated: true } };
}
