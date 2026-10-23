import { execFileSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { assertVolume, freeBytes, readManifest, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';
import { openPool } from './db.ts';

/** G0 da P9.1: segurança operacional antes de qualquer escrita. Somente leitura. Uso: node --import tsx scripts/exec/seguranca-g0.ts [--hash-sim] > g0.json */
const cfg = storageConfig(); const pool = openPool(2); const GIB = 1024 ** 3;
const sha = (p: string) => new Promise<string>((ok, bad) => { const h = createHash('sha256'); createReadStream(p).on('data', d => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', bad); });
const out: Record<string, unknown> = { at: new Date().toISOString() };
try {
  const one = async (sql: string, args: unknown[] = []) => (await pool.query(sql, args)).rows;
  out.database = (await one(`SELECT current_database() AS db, current_user AS usr, version() AS v, pg_size_pretty(pg_database_size(current_database())) AS size, pg_database_size(current_database())::bigint AS bytes`))[0];
  out.execSchemaBytes = Number((await one(`SELECT coalesce(sum(pg_total_relation_size(c.oid)), 0)::bigint AS b FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'civica_exec' AND c.relkind IN ('r', 'm')`))[0].b);
  out.activeSessions = await one(`SELECT pid, state, wait_event_type, now() - query_start AS running, left(query, 80) AS q FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid() AND state <> 'idle'`);
  out.ungrantedLocks = Number((await one(`SELECT count(*)::int AS n FROM pg_locks WHERE NOT granted`))[0].n);
  out.advisoryLocks = Number((await one(`SELECT count(*)::int AS n FROM pg_locks WHERE locktype = 'advisory'`))[0].n);
  out.runsRunning = Number((await one(`SELECT count(*)::int AS n FROM civica_exec.exec_ingestion_run WHERE status = 1 AND started_at > now() - interval '2 hours'`))[0].n);
  out.walBytes = (await one(`SELECT wal_bytes::text AS b, wal_records::text AS r FROM pg_stat_wal`))[0];
  out.settings = Object.fromEntries((await one(`SELECT name, setting, unit FROM pg_settings WHERE name IN ('max_wal_size', 'checkpoint_timeout', 'shared_buffers', 'work_mem', 'maintenance_work_mem')`)).map(r => [r.name, `${r.setting}${r.unit ?? ''}`]));
  out.checkpoints = (await one(`SELECT num_timed, num_requested FROM pg_stat_checkpointer`))[0];
  out.publicationsByDataset = await one(`SELECT dataset_id, count(*)::int AS slices, max(activated_at) AS last FROM civica_exec.exec_publication GROUP BY 1 ORDER BY 1`);
  out.runsByStatus = await one(`SELECT status, count(*)::int AS n FROM civica_exec.exec_ingestion_run GROUP BY 1 ORDER BY 1`);
  out.migrations = await one(`SELECT version, name FROM civica_exec.schema_migrations ORDER BY version`);
  out.fingerprints = {
    saudeDefs: (await one(`SELECT md5(string_agg(t::text, ',' ORDER BY indicator_id)) AS h FROM civica_exec.exec_ind_def t WHERE domain = 1`))[0].h,
    saudePublications: (await one(`SELECT md5(string_agg(dataset_id || ':' || uf || ':' || competence || ':' || run_id || ':' || state, ',' ORDER BY dataset_id, uf, competence)) AS h FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 3 AND 11`))[0].h,
    saudeIndValues: (await one(`SELECT md5(string_agg(indicator_id || ':' || entity_id || ':' || period_start || ':' || coalesce(value::text, 'n'), ',' ORDER BY indicator_id, entity_id, period_start)) AS h FROM civica_exec.exec_ind_value WHERE indicator_id < 1000`))[0].h,
    saudeIndCount: Number((await one(`SELECT count(*)::int AS n FROM civica_exec.exec_ind_value WHERE indicator_id < 1000`))[0].n),
    p91IndValues: (await one(`SELECT md5(string_agg(indicator_id || ':' || entity_id || ':' || period_start || ':' || coalesce(value::text, 'n'), ',' ORDER BY indicator_id, entity_id, period_start)) AS h, count(*)::int AS n FROM civica_exec.exec_ind_value WHERE indicator_id BETWEEN 3001 AND 3299`))[0],
    p91Cov: (await one(`SELECT md5(string_agg(t::text, ',' ORDER BY uf, indicator_id, competence)) AS h, count(*)::int AS n FROM civica_exec.exec_seg_cov t`))[0],
    p91Publications: (await one(`SELECT md5(string_agg(dataset_id || ':' || uf || ':' || competence || ':' || run_id, ',' ORDER BY dataset_id, uf, competence)) AS h, count(*)::int AS n FROM civica_exec.exec_publication WHERE dataset_id BETWEEN 15 AND 17`))[0],
    entities: (await one(`SELECT md5(string_agg(entity_id || ':' || kind || ':' || ibge7 || ':' || name, ',' ORDER BY entity_id)) AS h, count(*)::int AS n FROM civica_exec.exec_entity`))[0],
    sharedContracts: (await one(`SELECT md5(string_agg(table_name || '.' || column_name || ':' || data_type, ',' ORDER BY table_name, ordinal_position)) AS h FROM information_schema.columns WHERE table_schema = 'civica_exec' AND table_name IN ('exec_ind_def', 'exec_ind_value', 'exec_ind_latest', 'exec_entity', 'exec_publication', 'exec_ingestion_run', 'exec_change_log', 'exec_raw_manifest', 'exec_territory_population')`))[0].h,
    legislativeSchema: (await one(`SELECT count(*)::int AS tables, coalesce(sum(n_live_tup), 0)::bigint AS live_rows FROM pg_stat_user_tables WHERE schemaname = 'civica'`))[0],
  };
  const pop = await one(`SELECT year, count(*)::int AS n FROM civica_exec.exec_territory_population WHERE source = 1 AND entity_id > 100 GROUP BY 1 ORDER BY 1`);
  out.populationYears = pop.map(r => r.year);
  out.pgFreeGiB = Number((await freeBytes(cfg.pgProbeDir) / GIB).toFixed(1));
  // SSD
  const guid = await volumeGuidOf(cfg.rawDir);
  out.ssd = { rawDir: cfg.rawDir, expectedGuid: cfg.volumeGuid, volumeGuid: guid, match: guid === cfg.volumeGuid, freeGiB: Number((await freeBytes(cfg.rawDir) / GIB).toFixed(1)), marker: existsSync(join(cfg.rootDir ?? '', '.civica-volume.json')) };
  try { await assertVolume(cfg); out.ssd = { ...(out.ssd as object), assertVolume: 'PASS' }; } catch (e) { out.ssd = { ...(out.ssd as object), assertVolume: String(e) }; }
  // backups
  const bdir = join(cfg.rootDir ?? '.', 'backups');
  out.backups = ['pre-nacional-p1-20261020.dump', 'pre-seguranca-p91-20261021.dump'].map(f => { const p = join(bdir, f); return existsSync(p) ? { file: f, bytes: statSync(p).size, mtime: statSync(p).mtime.toISOString() } : { file: f, missing: true }; });
  // RAW SIM: manifesto × disco (tamanho sempre; SHA-256 com --hash-sim)
  const man = [...(await readManifest(cfg)).values()].filter(e => e.dataset === 'sim');
  let sizeBad = 0, missing = 0, hashBad = 0, hashed = 0;
  for (const e of man) {
    const p = join(cfg.rawDir, e.relPath);
    if (!existsSync(p)) { missing++; continue; }
    if (statSync(p).size !== e.bytes) sizeBad++;
    if (process.argv.includes('--hash-sim')) { hashed++; if (await sha(p) !== e.sha256) hashBad++; }
  }
  out.rawSim = { manifestEntries: man.length, definitivo: man.filter(e => e.relPath.includes('/definitivo/')).length, prelim: man.filter(e => e.relPath.includes('/prelim/')).length, missing, sizeMismatch: sizeBad, hashed, hashMismatch: hashBad };
  // processos concorrentes (collector, scheduler, python)
  try { out.processes = execFileSync('tasklist', ['/FO', 'CSV', '/NH'], { encoding: 'utf8' }).split('\n').filter(l => /"(node|python|pg_dump|pg_restore)\.exe"/i.test(l)).map(l => l.split('","').slice(0, 2).join(' ').replace(/"/g, '')); } catch { out.processes = 'indisponível'; }
  console.log(JSON.stringify(out, null, 1));
} finally { await pool.end(); }
