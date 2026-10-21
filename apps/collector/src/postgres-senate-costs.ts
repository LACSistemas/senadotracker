import { createHash, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseSenateCabinetPayroll } from './cabinet.ts';
import { PostgresCollectorStore } from './postgres-collector.ts';
import { searchText } from '@senadotracker/domain';

const SOURCE = 'senado' as const;
const ARCHIVE = 'https://www.senado.leg.br/transparencia/LAI/secrh/SF_ConsultaRemuneracaoServidoresParlamentares_';

function loadProjectEnv() {
  if (process.env.DB_NAME) return;
  try {
    const envPath = ['.env', resolve(process.cwd(), '../../.env')].find(path => { try { readFileSync(path); return true; } catch { return false; } });
    if (!envPath) return;
    for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match && !process.env[match[1]!]) process.env[match[1]!] = match[2]!.trim().replace(/^['"]|['"]$/g, '');
    }
  } catch { /* the caller will receive the target-contract error */ }
}

function monthKey(value: string) {
  if (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(value)) throw new Error(`Competência inválida: ${value}`);
  return value;
}

function sourceUpdatedAt(bytes: Uint8Array) {
  const first = new TextDecoder('windows-1252').decode(bytes.slice(0, 256)).split(/\r?\n/, 1)[0] ?? '';
  const value = first.split(';', 2)[1]?.trim() ?? null;
  if (!value) return null;
  const [day, month, year, hour = '00', minute = '00'] = value.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2})/)?.slice(1) ?? [];
  return day ? `${year}-${month}-${day}T${hour}:${minute}:00-03:00` : null;
}

type CostOptions = {
  year: number;
  months?: string[];
  publish?: boolean;
  allowSourceRevision?: boolean;
  progress?: (message: string) => void;
};

export async function collectSenateCabinetCostsPostgres(options: CostOptions) {
  loadProjectEnv();
  if (options.year !== 2026) throw new Error('P0.2 está limitado ao exercício 2026');
  const months = (options.months ?? [...Array(9)].map((_, index) => `${options.year}-${String(index + 1).padStart(2, '0')}`)).map(monthKey);
  const store = new PostgresCollectorStore();
  const target = await store.assertTarget();
  const roster = await store.query<any>(`SELECT p.external_id,p.name,p.payload
    FROM civica.profiles p JOIN civica.active_publications a ON a.source=$1 AND a.batch_id=p.batch_id
    WHERE a.source=$1 ORDER BY p.external_id`, [SOURCE]);
  const names = new Map<string, string>();
  for (const row of roster.rows) {
    const payload = row.payload ?? {};
    for (const name of [row.name, payload.fullName].filter(Boolean)) {
      const key = searchText(String(name));
      if (names.has(key) && names.get(key) !== String(row.external_id)) names.delete(key);
      else names.set(key, String(row.external_id));
    }
  }
  const runId = options.publish ? `pg:senado-costs:${options.year}:${randomUUID()}` : null;
  if (runId) await store.startRun(SOURCE, runId);
  const allCosts: any[] = [];
  const sourceRows: any[] = [];
  try {
    for (const competence of months) {
      const token = competence.replace('-', '');
      const url = `${ARCHIVE}${token}.csv`;
      options.progress?.(`senado remuneration ${competence}`);
      const response = await fetch(url, { headers: { 'User-Agent': 'Civica/0.2 (official-data-collection)', Accept: 'text/csv, application/octet-stream' } });
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (response.status !== 200) throw new Error(`HTTP ${response.status} em ${url}`);
      const sha256 = createHash('sha256').update(bytes).digest('hex');
      const rawId = runId ? await store.saveRaw(runId, { url, fetchedAt: new Date().toISOString(), status: response.status, contentType: response.headers.get('content-type') ?? 'application/octet-stream', bytes }) : `dry:${sha256}`;
      const parsed = parseSenateCabinetPayroll(bytes, rawId, competence, names);
      const update = sourceUpdatedAt(bytes);
      for (const cost of parsed.costs) allCosts.push({ ...cost, payload: { ...cost, sourceUpdatedAt: update, sourceToken: token, snapshotSha256: sha256 } });
      sourceRows.push({ competence, token, url, status: response.status, contentType: response.headers.get('content-type'), bytes: bytes.byteLength, sha256, etag: response.headers.get('etag'), lastModified: response.headers.get('last-modified'), sourceUpdatedAt: update, ...parsed.report, matchedOffices: parsed.matchedOffices, unmatched: parsed.unmatched, costRecords: parsed.costs.length });
    }
    const seen = new Set<string>();
    for (const cost of allCosts) {
      const key = `${cost.externalId}|${cost.competence}|${cost.rubric}`;
      if (seen.has(key)) throw new Error(`Custo ampliado duplicado: ${key}`);
      seen.add(key);
    }
    const activeBatch = (await store.query<any>(`SELECT a.batch_id FROM civica.active_expanded_cost_publications a WHERE a.source=$1 AND a.year=$2`, [SOURCE, options.year])).rows[0]?.batch_id;
    if (activeBatch) {
      const existing = (await store.query<any>(`SELECT external_id,competence,rubric,value_cents FROM civica.expanded_costs WHERE batch_id=$1`, [activeBatch])).rows;
      const current = new Map(allCosts.map(cost => [`${cost.externalId}|${cost.competence}|${cost.rubric}`, cost.valueCents == null ? null : Number(cost.valueCents)]));
      const same = existing.length === allCosts.length && existing.every(row => current.get(`${row.external_id}|${row.competence}|${row.rubric}`) === (row.value_cents == null ? null : Number(row.value_cents)));
      if (same) {
        if (runId) await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='skipped',expected_count=$2,roster_complete=1,reconciliation_json=$3 WHERE id=$4`, [new Date().toISOString(), allCosts.length, JSON.stringify({ year: options.year, months, idempotentReplay: true, activeBatch }), runId]);
        return { target, runId, year: options.year, months, roster: roster.rowCount ?? 0, sourceRows, costRecords: allCosts.length, augustDiffs: [], published: false, idempotentReplay: true, activeBatch };
      }
    }
    const activeAug = (await store.query<any>(`SELECT c.external_id,c.rubric,c.value_cents,c.payload
      FROM civica.expanded_costs c JOIN civica.active_expanded_cost_publications a ON a.batch_id=c.batch_id
      WHERE a.source=$1 AND a.year=$2 AND c.competence=$3`, [SOURCE, options.year, `${options.year}-08`])).rows;
    const currentAug = new Map(allCosts.filter(cost => cost.competence === `${options.year}-08`).map(cost => [`${cost.externalId}|${cost.rubric}`, cost.valueCents]));
    const augustDiffs = activeAug.map(row => ({ key: `${row.external_id}|${row.rubric}`, previous: row.value_cents == null ? null : Number(row.value_cents), current: currentAug.get(`${row.external_id}|${row.rubric}`) ?? null })).filter(row => row.previous !== row.current);
    if (augustDiffs.length && options.publish && !options.allowSourceRevision) throw new Error(`Fonte de agosto mudou; use --allow-source-revision após auditar (${augustDiffs.length} diferenças)`);
    if (runId) {
      const now = new Date().toISOString();
      const note = `P0.2 histórico Senado ${options.year}; competências ${months.join(', ')}; fonte mensal oficial; RAW preservado; agosto retificado=${augustDiffs.length > 0}; sem encargos patronais; ausência não é zero.`;
      await store.transaction(async client => {
        await client.query(`INSERT INTO civica.expanded_cost_batches(id,source,year,published_at,availability,note,record_count) VALUES($1,$2,$3,$4,'partial',$5,$6)`, [runId, SOURCE, options.year, now, note, allCosts.length]);
        for (const cost of allCosts) await client.query(`INSERT INTO civica.expanded_costs(batch_id,source,external_id,competence,rubric,nature,value_cents,overlap_group,raw_id,payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`, [runId, cost.source, cost.externalId, cost.competence, cost.rubric, cost.nature, cost.valueCents, cost.overlapGroup, cost.rawId, JSON.stringify(cost.payload)]);
        await client.query(`INSERT INTO civica.active_expanded_cost_publications(source,year,batch_id) VALUES($1,$2,$3) ON CONFLICT(source,year) DO UPDATE SET batch_id=excluded.batch_id`, [SOURCE, options.year, runId]);
        await client.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',expected_count=$2,roster_complete=1,reconciliation_json=$3 WHERE id=$4`, [now, allCosts.length, JSON.stringify({ year: options.year, months, sourceRows, augustDiffs, snapshotStartHashes: sourceRows.map(row => [row.competence, row.sha256]), snapshotEndHashes: sourceRows.map(row => [row.competence, row.sha256]), targetDatabase: target.current_database }), runId]);
      });
    }
    return { target, runId, year: options.year, months, roster: roster.rowCount ?? 0, sourceRows, costRecords: allCosts.length, augustDiffs, published: Boolean(runId) };
  } catch (error) {
    if (runId) await store.query(`UPDATE civica.ingestion_runs SET status='failed',finished_at=$1,error=$2 WHERE id=$3`, [new Date().toISOString(), error instanceof Error ? error.message : String(error), runId]).catch(() => undefined);
    throw error;
  } finally { await store.pool.end(); }
}
