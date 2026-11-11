import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';

const RAW = 'D:/Civica/judiciario/justica_em_numeros/extracted-17-set-2026';
const MAIN = path.join(RAW, 'JN_23-Jun-2026.csv');
const DICT = fs.readdirSync(RAW).find((x) => x.toLowerCase().startsWith('vari') && x.endsWith('.csv')) ? path.join(RAW, fs.readdirSync(RAW).find((x) => x.toLowerCase().startsWith('vari') && x.endsWith('.csv'))!) : '';
const REVISION = 'p146-jn-themes-20261105';
const METHOD = 'P146-JN-THEMES-v1';
const SOURCE = 'p142-jn-main-2026';

type Def = { theme: string; suffix: string; publicName: string; unit: string; aggregation: string; comparison: boolean; description: string; numerator?: string; denominator?: string };

const DEFINITIONS: Record<string, Def> = {
  cnextfisc1: { theme: 'TAX_EXECUTION', suffix: 'NEW_CASES', publicName: 'Execução fiscal — casos novos', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos novos de execução fiscal no 1º grau.' },
  cpextfisc1: { theme: 'TAX_EXECUTION', suffix: 'PENDING', publicName: 'Execução fiscal — casos pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos pendentes de execução fiscal no 1º grau.' },
  tbaixextfisc1: { theme: 'TAX_EXECUTION', suffix: 'DISPOSED', publicName: 'Execução fiscal — processos baixados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Processos baixados de execução fiscal no 1º grau.' },
  tcextfisc1: { theme: 'TAX_EXECUTION', suffix: 'CONGESTION_RATE', publicName: 'Execução fiscal — taxa de congestionamento', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Taxa de congestionamento na execução fiscal no 1º grau.' },
  iadextfisc1: { theme: 'TAX_EXECUTION', suffix: 'CLEARANCE_INDEX', publicName: 'Execução fiscal — índice de atendimento à demanda', unit: 'ratio', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Processos baixados por caso novo na execução fiscal.' },
  pexsfisc1: { theme: 'TAX_EXECUTION', suffix: 'SUSPENDED_SHARE', publicName: 'Execução fiscal — percentual suspenso', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Percentual de processos de execução fiscal suspensos, sobrestados ou em arquivo provisório.' },
  susexfisc1: { theme: 'TAX_EXECUTION', suffix: 'SUSPENDED', publicName: 'Execução fiscal — suspensos ou sobrestados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções fiscais suspensas, sobrestadas ou em arquivo provisório.' },
  sentextfisc1: { theme: 'TAX_EXECUTION', suffix: 'SENTENCES', publicName: 'Execução fiscal — sentenças', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Sentenças em execução fiscal no 1º grau.' },
  incexpfisc1: { theme: 'TAX_EXECUTION', suffix: 'PENDING_INCIDENTS', publicName: 'Execução fiscal — incidentes pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Incidentes de execução fiscal pendentes no 1º grau.' },
  cnex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_NEW_CASES', publicName: 'Execução — casos novos', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos novos de execução no 1º grau.' },
  cpex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_PENDING', publicName: 'Execução — casos pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos pendentes de execução no 1º grau.' },
  tbaixex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_DISPOSED', publicName: 'Execução — processos baixados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Processos baixados de execução no 1º grau.' },
  tcex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_CONGESTION_RATE', publicName: 'Execução — taxa de congestionamento', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Taxa de congestionamento na fase de execução no 1º grau.' },
  iadex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_CLEARANCE_INDEX', publicName: 'Execução — índice de atendimento à demanda', unit: 'ratio', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Processos baixados por caso novo na fase de execução.' },
  susex1: { theme: 'TAX_EXECUTION', suffix: 'ALL_SUSPENDED', publicName: 'Execução — suspensos ou sobrestados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções suspensas, sobrestadas ou em arquivo provisório.' },
  cncrim: { theme: 'CRIMINAL', suffix: 'NEW_CASES', publicName: 'Justiça criminal — casos novos', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos novos criminais no universo JN.' },
  cpcrim: { theme: 'CRIMINAL', suffix: 'PENDING', publicName: 'Justiça criminal — casos pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos pendentes criminais no universo JN.' },
  tbaixcrim: { theme: 'CRIMINAL', suffix: 'DISPOSED', publicName: 'Justiça criminal — processos baixados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Processos criminais baixados no universo JN.' },
  cncfem: { theme: 'DOMESTIC_VIOLENCE', suffix: 'FEMINICIDE_NEW', publicName: 'Feminicídio — casos novos', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos novos de conhecimento em feminicídio.' },
  cpcfem: { theme: 'DOMESTIC_VIOLENCE', suffix: 'FEMINICIDE_PENDING', publicName: 'Feminicídio — casos pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos pendentes de conhecimento em feminicídio.' },
  tbaixcfem: { theme: 'DOMESTIC_VIOLENCE', suffix: 'FEMINICIDE_DISPOSED', publicName: 'Feminicídio — processos baixados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Processos baixados de conhecimento em feminicídio.' },
  sentjudcrimfem: { theme: 'DOMESTIC_VIOLENCE', suffix: 'FEMINICIDE_SENTENCES', publicName: 'Feminicídio — execuções sentenciadas', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções judiciais sentenciadas de feminicídio.' },
  cncvd: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_NEW', publicName: 'Violência doméstica — casos novos', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos novos de conhecimento em violência doméstica.' },
  cpcvd: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_PENDING', publicName: 'Violência doméstica — casos pendentes', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Casos pendentes de conhecimento em violência doméstica.' },
  tbaixcvd: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_DISPOSED', publicName: 'Violência doméstica — processos baixados', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Processos baixados de conhecimento em violência doméstica.' },
  exejudcrimvdf: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_EXEC_NEW', publicName: 'Violência doméstica — execuções novas', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções judiciais novas de violência doméstica.' },
  sentjudcrimvdf: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_EXEC_SENTENCES', publicName: 'Violência doméstica — execuções sentenciadas', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções judiciais sentenciadas de violência doméstica.' },
  tbaixjudcrimvdf: { theme: 'DOMESTIC_VIOLENCE', suffix: 'DOMESTIC_EXEC_DISPOSED', publicName: 'Violência doméstica — execuções baixadas', unit: 'processos', aggregation: 'SUM', comparison: true, description: 'Execuções judiciais baixadas de violência doméstica.' },
  ic: { theme: 'CONCILIATION', suffix: 'ALL', publicName: 'Conciliação — índice geral', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Índice oficial de conciliação.' },
  ic1: { theme: 'CONCILIATION', suffix: 'FIRST_DEGREE', publicName: 'Conciliação — 1º grau', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Índice oficial de conciliação do 1º grau.' },
  ic2: { theme: 'CONCILIATION', suffix: 'SECOND_DEGREE', publicName: 'Conciliação — 2º grau', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Índice oficial de conciliação do 2º grau.' },
  icc1: { theme: 'CONCILIATION', suffix: 'KNOWLEDGE_FIRST_DEGREE', publicName: 'Conciliação — conhecimento no 1º grau', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Índice de conciliação na fase de conhecimento do 1º grau.' },
  icex1: { theme: 'CONCILIATION', suffix: 'EXECUTION_FIRST_DEGREE', publicName: 'Conciliação — execução no 1º grau', unit: 'proportion', aggregation: 'NONE_RATE_OFFICIAL', comparison: true, description: 'Índice de conciliação na fase de execução do 1º grau.' },
};

const toNumber = (raw: unknown): number | null => { const s = String(raw ?? '').trim().toLowerCase().replace(',', '.'); if (!s || ['nd', 'na', 'n/d', '-', 'null'].includes(s)) return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const hash = (value: unknown) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clean = (s: string) => s.replace(/[\u0000-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
const parseDelimited = (input: string) => input.replace(/^\uFEFF/, '').split(/\r?\n/).filter(Boolean).map((line) => line.split(';'));
const parseObjects = (input: Buffer) => { const rows = parseDelimited(input.toString('latin1')); const headers = rows.shift() ?? []; return rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? '']))); };

async function main() {
  const dictRows = parseObjects(fs.readFileSync(DICT)) as { sigla: string; dsc_sigla: string }[];
  const descriptions = new Map(dictRows.map((r) => [r.sigla.toLowerCase(), clean(r.dsc_sigla.replace(/\u0096/g, '–'))]));
  const rows = parseObjects(fs.readFileSync(MAIN)) as Record<string, string>[];
  const grouped = new Map<string, Record<string, string>[]>();
  for (const row of rows) { const key = `${row.sigla}|${row.ano}`; const bucket = grouped.get(key) ?? []; bucket.push(row); grouped.set(key, bucket); }
  const normalizedRows: Record<string, string>[] = [];
  const mergedSourceKeys: string[] = [];
  for (const [key, bucket] of grouped) {
    const merged = { ...bucket[0] };
    if (bucket.length > 1) mergedSourceKeys.push(key);
    for (const column of Object.keys(merged)) {
      const values = bucket.map((r) => String(r[column] ?? '').trim()).filter((v) => v && !['nd', 'na', 'n/d', '-'].includes(v.toLowerCase()));
      const unique = [...new Set(values)];
      if (unique.length === 1) merged[column] = unique[0];
      else if (unique.length > 1) {
        const numeric = unique.map((v) => Number(v.replace(',', '.')));
        merged[column] = numeric.every(Number.isFinite) && new Set(numeric).size === 1 ? unique[0] : 'nd';
      }
    }
    normalizedRows.push(merged);
  }
  const pool = openPool(4); const client = await pool.connect();
  try {
    const crosswalk = (await client.query(`SELECT c.jn_identifier,c.canonical_tribunal_id,t.sigla FROM civica_jud.jud_jn_crosswalk c JOIN civica_jud.jud_tribunal t ON t.tribunal_id=c.canonical_tribunal_id WHERE c.canonical_tribunal_id IS NOT NULL`)).rows as { jn_identifier: string; canonical_tribunal_id: string; sigla: string }[];
    const map = new Map(crosswalk.map((x) => [x.jn_identifier, x]));
    const facts: { indicatorId: string; tribunalId: string; year: number; value: number | null; rawHash: string; variable: string }[] = [];
    const definitions: { indicatorId: string; def: Def; official: string; availableYears: string }[] = [];
    for (const [variable, def] of Object.entries(DEFINITIONS)) {
      if (!Object.prototype.hasOwnProperty.call(normalizedRows[0] ?? {}, variable)) continue;
      const indicatorId = `P146_${def.theme}_${def.suffix}`;
      const vals = normalizedRows.filter((r) => map.has(r.sigla)).map((r) => toNumber(r[variable])).filter((x): x is number => x !== null);
      definitions.push({ indicatorId, def, official: descriptions.get(variable) ?? variable, availableYears: vals.length ? '2009-2025' : '' });
      for (const r of normalizedRows) {
        const cw = map.get(r.sigla); if (!cw) continue;
        facts.push({ indicatorId, tribunalId: cw.canonical_tribunal_id, year: Number(r.ano), value: toNumber(r[variable]), rawHash: hash([variable, r]), variable });
      }
    }
    const semanticHash = hash({ definitions, facts, mergedSourceKeys });
    await client.query('BEGIN');
    const existing = (await client.query(`SELECT revision_id,row_count FROM civica_jud.jud_publication_revision WHERE scope='JN_THEMATIC' AND semantic_hash=$1`, [semanticHash])).rows[0];
    if (existing) { await client.query('COMMIT'); console.log(JSON.stringify({ status: 'UNCHANGED_REPLAY', revisionId: existing.revision_id, definitions: definitions.length, facts: facts.length, duplicateAmendmentInsertions: 0, duplicateExecutionInsertions: 0 })); return; }
    await client.query(`UPDATE civica_jud.jud_publication_revision SET is_active=false WHERE scope='JN_THEMATIC'`);
    await client.query(`INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,created_at,activated_at,provenance) VALUES($1,'JN_THEMATIC',$2::jsonb,$3,$4,'ACTIVE',true,true,now(),now(),$5::jsonb)`, [REVISION, JSON.stringify([SOURCE, 'p142-jn-dictionary-2026']), semanticHash, facts.length, JSON.stringify({ phase: 'P14.6', source: 'CNJ Justiça em Números 2026', parser: METHOD, noDataJud: true, sourceRows: rows.length, normalizedRows: normalizedRows.length, mergedSourceKeys })]);
    for (const { indicatorId, def, official, availableYears } of definitions) {
      await client.query(`INSERT INTO civica_jud.jud_jn_indicator(indicator_id,official_name,public_name,description,source_variable,source_formula,numerator,denominator,unit,statistical_universe,institutional_grain,time_grain,available_years,aggregation_allowed,comparison_eligible,source_edition,method_breaks,publication_status,missing_data_rule,methodology_reference,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,'institutional tribunal-year','tribunal','annual',$10,$11,$12,2026,$13,'PUBLISHED_THEMATIC','nd/blank remains NULL',$14,$15) ON CONFLICT(indicator_id) DO UPDATE SET official_name=EXCLUDED.official_name,description=EXCLUDED.description,available_years=EXCLUDED.available_years,provenance=EXCLUDED.provenance`, [indicatorId, official, def.publicName, def.description, Object.entries(DEFINITIONS).find(([, x]) => x === def)?.[0] ?? '', null, def.numerator ?? null, def.denominator ?? null, def.unit, availableYears, def.aggregation, def.comparison, 'P146 official JN variable copied without recomputation', JSON.stringify({ sourceVariable: Object.entries(DEFINITIONS).find(([, x]) => x === def)?.[0], theme: def.theme }), JSON.stringify({ sourceSnapshot: SOURCE, dictionarySnapshot: 'p142-jn-dictionary-2026', parser: METHOD })]);
    }
    for (const f of facts) {
      const jnIdentifier = crosswalk.find((x) => x.canonical_tribunal_id === f.tribunalId)?.jn_identifier ?? f.tribunalId;
      await client.query(`INSERT INTO civica_jud.jud_jn_observation(indicator_id,canonical_tribunal_id,jn_identifier,reference_year,report_edition,degree_code,value_numeric,numerator,denominator,unit,coverage_status,method_version,comparability,source_snapshot_id,publication_revision_id,raw_row_hash,provenance) VALUES($1,$2,$3,$4,2026,'INSTITUTIONAL',$5::numeric,NULL,NULL,(SELECT unit FROM civica_jud.jud_jn_indicator WHERE indicator_id=$1),CASE WHEN $5::numeric IS NULL THEN 'MISSING_SOURCE_VALUE' ELSE 'OBSERVED' END,$6,CASE WHEN $5::numeric IS NULL THEN 'NOT_COMPARABLE_MISSING' ELSE 'WITHIN_SOURCE_UNIVERSE' END,$7,$8,$9,$10) ON CONFLICT(indicator_id,canonical_tribunal_id,reference_year,degree_code,publication_revision_id) DO UPDATE SET value_numeric=EXCLUDED.value_numeric,coverage_status=EXCLUDED.coverage_status,raw_row_hash=EXCLUDED.raw_row_hash,provenance=EXCLUDED.provenance`, [f.indicatorId, f.tribunalId, jnIdentifier, f.year, f.value, METHOD, SOURCE, REVISION, f.rawHash, JSON.stringify({ sourceVariable: f.variable, thematic: true })]);
    }
    await client.query('COMMIT'); console.log(JSON.stringify({ status: 'PUBLISHED', revisionId: REVISION, definitions: definitions.length, facts: facts.length, observed: facts.filter((x) => x.value !== null).length, missing: facts.filter((x) => x.value === null).length, sourceRows: rows.length, normalizedRows: normalizedRows.length, mergedRows: mergedSourceKeys.length, dictionaryRows: dictRows.length, dataJudCalls: 0 }));
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); await pool.end(); }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
