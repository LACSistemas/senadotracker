import type { Pool } from 'pg';
import { RJ_DEFS, type CrimeRecord } from '@senadotracker/db';
import { fetchSnapshot, isText, readRaw, type CrimeLoaded, type Log } from './crime.ts';
import type { StorageConfig } from './storage.ts';

/** CSV com ';' e campos entre aspas (ISPdados). Latin-1. */
export function parseCsv(text: string, sep = ';'): string[][] {
  const out: string[][] = []; let row: string[] = []; let cur = ''; let q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += ch; }
    else if (ch === '"') q = true; else if (ch === sep) { row.push(cur); cur = ''; } else if (ch === '\n') { row.push(cur.replace(/\r$/, '')); out.push(row); row = []; cur = ''; } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur.replace(/\r$/, '')); out.push(row); }
  return out.filter(r => r.length > 1 || (r[0] ?? '') !== '');
}
const BASE = 'https://www.ispdados.rj.gov.br/Arquivos';
const num = (s: string | undefined): number | null => { const t = (s ?? '').trim(); if (t === '') return null; const n = Number(t.replace(',', '.')); return Number.isFinite(n) ? n : null; };
const CODES = RJ_DEFS.map(d => d.code);

export async function fetchRj(pool: Pool, cfg: StorageConfig, log?: Log) {
  const mun = await fetchSnapshot(pool, cfg, { url: `${BASE}/BaseMunicipioMensal.csv`, dir: 'rj', name: 'BaseMunicipioMensal.csv', dataset: 'isp_rj_municipio_mensal', uf: 33, ...(log ? { log } : {}), accept: isText });
  const st = await fetchSnapshot(pool, cfg, { url: `${BASE}/DOMensalEstadoDesde1991.csv`, dir: 'rj', name: 'DOMensalEstadoDesde1991.csv', dataset: 'isp_rj_estado_mensal', uf: 33, ...(log ? { log } : {}), accept: isText });
  return { mun, st };
}
/**
 * ISP-RJ: município × mês × variável (dicionário oficial). Zero declarado (grade completa dos 92 municípios); célula vazia = ausência. Fase 2 (consolidado SEM errata) é preliminar.
 * Mês em que TODAS as células de TODOS os municípios são zero/vazias não foi publicado pela fonte e fica de fora. Controle independente: série estadual mensal (DOMensalEstadoDesde1991.csv).
 */
export async function loadRj(pool: Pool, cfg: StorageConfig, log?: Log): Promise<CrimeLoaded> {
  const { mun, st } = await fetchRj(pool, cfg, log);
  const m = parseCsv((await readRaw(cfg, mun.relPath)).toString('latin1')); const h = m[0]!.map(x => x.trim()); const ix = new Map(h.map((c, i) => [c, i])); const missing = CODES.filter(c => !ix.has(c));
  if (missing.length) throw new Error(`ISP-RJ: colunas esperadas ausentes: ${missing.join(', ')}`);
  const unknown = h.filter(c => !CODES.includes(c) && !['fmun_cod', 'fmun', 'ano', 'mes', 'mes_ano', 'regiao', 'fase'].includes(c)); if (unknown.length) throw new Error(`ISP-RJ: colunas novas sem contrato: ${unknown.join(', ')}`);
  const records: CrimeRecord[] = []; const monthActivity = new Map<number, number>(); const phases = new Map<string, number>(); const rowsByMonth = new Map<number, number>();
  for (const r of m.slice(1)) {
    const ym = Number(r[ix.get('ano')!]) * 100 + Number(r[ix.get('mes')!]); const fase = (r[ix.get('fase')!] ?? '').trim(); const ibge7 = Number(r[ix.get('fmun_cod')!]);
    phases.set(fase, (phases.get(fase) ?? 0) + 1); rowsByMonth.set(ym, (rowsByMonth.get(ym) ?? 0) + 1);
    for (const code of CODES) { const v = num(r[ix.get(code)!]); if (v != null) monthActivity.set(ym, (monthActivity.get(ym) ?? 0) + Math.abs(v)); records.push({ ym, ibge7, name: r[ix.get('fmun')!] ?? '', code, value: v, prelim: fase === '2' }); }
  }
  const months = new Set([...rowsByMonth.keys()].filter(ym => (monthActivity.get(ym) ?? 0) > 0));
  const s = parseCsv((await readRaw(cfg, st.relPath)).toString('latin1')); const sh = s[0]!.map(x => x.trim()); const sx = new Map(sh.map((c, i) => [c, i])); const ufTotals = new Map<string, number>();
  for (const r of s.slice(1)) { const ym = Number(r[sx.get('ano')!]) * 100 + Number(r[sx.get('mes')!]); if (!months.has(ym)) continue; for (const code of CODES) { const i = sx.get(code); if (i == null) continue; const v = num(r[i]); if (v != null) ufTotals.set(`${code}|${ym}`, v); } }
  return { files: [{ relPath: mun.relPath, sha256: mun.sha256 }, { relPath: st.relPath, sha256: st.sha256 }], records, months, explicitZeros: true, duplicates: 'error', ufTotals,
    notes: { rowsFile: m.length - 1, phases: Object.fromEntries(phases), monthsDroppedEmpty: [...rowsByMonth.keys()].filter(ym => !months.has(ym)), firstMonth: Math.min(...months), lastMonth: Math.max(...months), controle: 'DOMensalEstadoDesde1991.csv (totais estaduais mensais)' } };
}
