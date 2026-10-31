import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { publishSlice } from '../../packages/db/src/exec/publication.ts';
import { replaceIndicatorsBulk, type IndicatorRow } from '../../packages/db/src/exec/seguranca.ts';

const DATASET = 140;
const DOMAIN = 6;
const PARSER = 'aneel-p132-indger-1';
const RAW = String.raw`D:\Civica\raw\infraestrutura\energia\aneel`;
const STG = String.raw`D:\Civica\staging\infraestrutura\energia\aneel\indger`;
const SOURCE_SHA = '33d1377b69a2564d793bb4b44268c6ac6bbb0a15d0dd30f994de528e15d8743e';
const SOURCE_URL = 'https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/fd10c9d4-cb76-4020-a322-e79afb13eaf7/download/indger-dados-comerciais.csv';
const IDS = {
  QtdUCAtiva: 10501, QtdUCAtivaFat: 10502, QtdFatura: 10503,
  QtdFaturaSemLeitura: 10504, QtdUCSuspInadimplemento: 10505,
  QtdSolicRessarcimentoDano: 10506, VlrPagoRessarcDano: 10507,
} as const;
const DEFS = [
  ['QtdUCAtiva', 'energy_indger_uc_active', 'Unidades consumidoras ativas', 'unidades', 'QtdUCAtiva: contratos ativos no município no mês; não equivale a domicílios ou população.', false],
  ['QtdUCAtivaFat', 'energy_indger_uc_active_billed', 'Unidades consumidoras ativas com fatura regular', 'unidades', 'QtdUCAtivaFat: unidades ativas com fatura regular emitida no mês.', false],
  ['QtdFatura', 'energy_indger_invoices', 'Faturas de cobrança regular', 'faturas', 'QtdFatura: quantidade de faturas de cobrança regular no mês.', false],
  ['QtdFaturaSemLeitura', 'energy_indger_invoices_without_reading', 'Faturas regulares sem leitura', 'faturas', 'QtdFaturaSemLeitura: faturas regulares calculadas sem leitura; não é taxa de qualidade.', false],
  ['QtdUCSuspInadimplemento', 'energy_indger_suspensions_nonpayment', 'Suspensões por inadimplemento', 'eventos', 'QtdUCSuspInadimplemento: unidades suspensas por inadimplemento no mês; não representa famílias sem energia.', false],
  ['QtdSolicRessarcimentoDano', 'energy_indger_damage_requests', 'Solicitações de ressarcimento por dano elétrico', 'solicitações', 'QtdSolicRessarcimentoDano: solicitações no mês.', false],
  ['VlrPagoRessarcDano', 'energy_indger_damage_paid_brl', 'Valor pago por ressarcimento de dano elétrico', 'BRL', 'VlrPagoRessarcDano: total pago a consumidores no mês, em reais.', false],
] as const;
type Rec = { competence: string; ibge7: string; cnpj: string; agent: string; values: Record<string, number | null> };

const q = (n: string) => `civica_exec.${n}`;
const hash = (s: string) => crypto.createHash('sha256').update(s).digest('hex');
const ym = (s: string) => Number(s.slice(0, 4) + s.slice(5, 7));
const isoEnd = (s: string) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCMonth(d.getUTCMonth() + 1); return d.toISOString().slice(0, 10); };

async function seedDefs(pool: any) {
  for (let i = 0; i < DEFS.length; i++) {
    const [source, code, label, unit, note] = DEFS[i]!;
    await pool.query(`INSERT INTO ${q('exec_ind_def')} (indicator_id, code, method_version, domain, sort_order, label, unit, grain, numerator_desc, denominator_desc, ranking_allowed, aggregation_allowed, null_semantics, methodology_note)
      VALUES ($1,$2,1,$3,$4,$5,$6,'M',NULL,NULL,false,$7,'linha ausente = cobertura não observada; NULL source-native nunca vira zero',$8)
      ON CONFLICT (indicator_id) DO UPDATE SET code=EXCLUDED.code, domain=EXCLUDED.domain, sort_order=EXCLUDED.sort_order, label=EXCLUDED.label, unit=EXCLUDED.unit, aggregation_allowed=EXCLUDED.aggregation_allowed, null_semantics=EXCLUDED.null_semantics, methodology_note=EXCLUDED.methodology_note`,
      [IDS[source], code, DOMAIN, i + 1, label, unit, false, note]);
  }
}

async function manifests(pool: any, runId: number) {
  const files: Array<[string, string, string]> = [
    ['indger-dados-comerciais.csv', SOURCE_URL, SOURCE_SHA],
    ['dm-indger-dados-comerciais.pdf', 'https://dadosabertos.aneel.gov.br/dataset/7cacb2c4-b165-4591-a793-9ed20d1f167d/resource/756794aa-0828-4a3f-83f5-d36f863dd802/download/dm-indger-dados-comerciais.pdf', ''],
    ['indqual-municipio.csv', 'https://dadosabertos.aneel.gov.br/dataset/db9c9f60-b3b5-4504-9dfe-2637922d53ce/resource/3f841488-80a8-42f2-a6ca-e0c593b228de/download/indqual-municipio.csv', 'ec1dac38d3868433d1b3ae8ebcd69a2df44e1cffd689c9a496cc19021f0849a4'],
    ['dec-fec.zip', 'https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/4493985c-baea-429c-9df5-3030422c71d7/download/indicadores-continuidade-coletivos-2020-2029.zip', ''],
    ['dm-indicadores-continuidade.pdf', 'https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/5d91171a-eb4e-4f66-8418-2833567123ae/download/dm-indicadores-continuidade.pdf', '1d024457693b04ab9e17e860b31a689ddc5fa968e6b9eea5d78f586ec2b10c'],
    ['dec-fec-limites.csv', 'https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/fd69e1dd-fd66-4269-b60c-cc0b7eb221b4/download/indicadores-continuidade-coletivos-limite.csv', '6cf409fc39aed93553293209ad662c8462036362feafc6337ea9c414ee0d9e92'],
    ['dec-fec-atributos.csv', 'https://dadosabertos.aneel.gov.br/dataset/d5f0712e-62f6-4736-8dff-9991f10758a7/resource/3c780aca-38cf-406d-9d45-f07a9216eef2/download/indicadores-continuidade-coletivos-atributos.csv', '9a8b5c32639594b0c9e8b31f814df06a626cc8271f2bb533f6e246cd345cfe47'],
  ];
  for (const [name, url, known] of files) {
    const p = path.join(RAW, name);
    if (!fs.existsSync(p)) continue;
    const sha = known || crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    await pool.query(`INSERT INTO ${q('exec_raw_manifest')} (run_id, source_url, rel_path, sha256, bytes, fetched_at, state, retention_class) VALUES ($1,$2,$3,decode($4,'hex'),$5,now(),1,2) ON CONFLICT (sha256) DO NOTHING`, [runId, url, path.relative(String.raw`D:\Civica`, p).replaceAll('\\', '/'), sha, fs.statSync(p).size]);
  }
}

async function main() {
  const records: Rec[] = fs.readFileSync(path.join(STG, 'indger_selected.jsonl'), 'utf8').trim().split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const summary = JSON.parse(fs.readFileSync(path.join(STG, 'indger_selected_summary.json'), 'utf8'));
  const byMonth = new Map<string, Rec[]>();
  for (const r of records) { const a = byMonth.get(r.competence) ?? []; a.push(r); byMonth.set(r.competence, a); }
  const pool = openPool(3);
  try {
    await seedDefs(pool);
    const entities = (await pool.query(`SELECT entity_id, ibge7 FROM ${q('exec_entity')} WHERE kind IN (4,5)`)).rows;
    const byIbge = new Map(entities.map((e: any) => [String(e.ibge7), Number(e.entity_id)]));
    const results: any[] = [];
    for (const competence of [...byMonth.keys()].sort()) {
      const from = competence; const to = isoEnd(competence); const comp = ym(competence);
      const rows: IndicatorRow[] = []; let unresolved = 0; let nulls = 0;
      for (const rec of byMonth.get(competence)!) {
        const entity = byIbge.get(rec.ibge7);
        if (!entity) { unresolved++; continue; }
        for (const source of Object.keys(IDS)) {
          const value = rec.values[source] ?? null;
          if (value === null) nulls++;
          rows.push({ indicator_id: IDS[source as keyof typeof IDS], entity_id: entity, period_start: from, period_end: to, status: 2, numerator: null, denominator: null, value, flags: (value === null ? 512 : 0) | 4 });
        }
      }
      const sourceHash = hash(`${SOURCE_SHA}:${competence}:${PARSER}`);
      const result = await publishSlice(pool, { datasetId: DATASET, uf: 0, competence: comp, stage: 2, sourceHash, parserVersion: PARSER, bootstrap: true, contiguity: false,
        tables: [], inputs: { sourceUrl: SOURCE_URL, rawPath: path.join(RAW, 'indger-dados-comerciais.csv'), rawSha256: SOURCE_SHA, staging: path.join(STG, 'indger_selected.jsonl'), selection: competence, exclusionRule: 'multiple distributors excluded' },
        quality: { sourceRows: summary.months[competence].sourceRows, deduplicatedRows: summary.months[competence].deduplicatedRows, indicatorRows: rows.length, unresolvedEntities: unresolved, nullValues: nulls, excludedMultipleDistributors: summary.months[competence].excludedRowsMultipleDistributors, coverageRule: 'single distributor only' },
        derive: async (c, runId) => { await replaceIndicatorsBulk(c, runId, { indicatorIds: Object.values(IDS), ufCode: 0, from, to }, rows, true); },
        verify: async (c) => { const got = await c.query(`SELECT count(*)::int AS n FROM ${q('exec_ind_value')} WHERE indicator_id = ANY($1::smallint[]) AND period_start=$2::date`, [Object.values(IDS), from]); if (Number(got.rows[0].n) !== rows.length) throw new Error(`INDGER ${competence}: persistiu ${got.rows[0].n}, esperado ${rows.length}`); },
      });
      if (result.status === 'PUBLISHED') await manifests(pool, result.runId);
      await pool.query(`UPDATE ${q('exec_ingestion_run')} SET rows_in=$2, rows_out=$2 WHERE run_id=$1`, [result.runId, rows.length]);
      await pool.query(`UPDATE ${q('exec_publication')} SET row_count=$2 WHERE run_id=$1`, [result.runId, rows.length]);
      results.push({ competence, result, indicatorRows: rows.length, unresolved, nulls });
    }
    const audit = await pool.query(`SELECT r.dataset_id,r.competence,r.run_id,r.status,r.rows_in,r.rows_out,r.quality,p.state,p.row_count FROM ${q('exec_ingestion_run')} r LEFT JOIN ${q('exec_publication')} p ON p.run_id=r.run_id WHERE r.dataset_id=$1 ORDER BY r.competence`, [DATASET]);
    const out = { dataset: DATASET, indicators: DEFS.map(d => ({ id: IDS[d[0]], code: d[1], source: d[0] })), results, audit: audit.rows };
    fs.writeFileSync(path.join(process.cwd(), 'docs', 'executivo-collector-plan', 'infraestrutura-p13-2-aneel', 'p132_publish_results.json'), JSON.stringify(out, null, 2));
    console.log(JSON.stringify(out, null, 2));
  } finally { await pool.end(); }
}
main().catch(e => { console.error(e); process.exitCode = 1; });
