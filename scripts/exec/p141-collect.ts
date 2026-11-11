import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { openPool } from './db.ts';

const RAW = 'D:\\Civica\\judiciario';
const DATE = '2026-11-04';
const OBSERVED_AT = `${DATE}T23:00:00Z`;
const MAX_GROWTH = 75_000_000;
const pool = openPool(6);

type AnyRow = Record<string, unknown>;
const branches = [
  ['ESTADUAL', 'Justiça Estadual', 'COURT_BRANCH'], ['FEDERAL', 'Justiça Federal', 'COURT_BRANCH'],
  ['TRABALHO', 'Justiça do Trabalho', 'COURT_BRANCH'], ['ELEITORAL', 'Justiça Eleitoral', 'COURT_BRANCH'],
  ['MILITAR', 'Justiça Militar Estadual', 'COURT_BRANCH'], ['SUPERIOR', 'Tribunais Superiores', 'COURT_BRANCH'],
  ['STF', 'Supremo Tribunal Federal', 'CONTROL'], ['CNJ', 'Conselho Nacional de Justiça', 'CONTROL'],
] as const;
const degrees = [
  ['G1', 'Primeiro grau'], ['G2', 'Segundo grau'], ['JE', 'Juizados especiais'], ['TR', 'Turma recursal'],
  ['TRU', 'Turma regional de uniformização'], ['SUP', 'Instância superior'], ['ADMIN', 'Administrativo'], ['NA', 'Não informado'],
] as const;
const aliases = [
  'STJ','TST','TSE','STM','TRF1','TRF2','TRF3','TRF4','TRF5','TRF6',
  'TJAC','TJAL','TJAM','TJAP','TJBA','TJCE','TJDFT','TJES','TJGO','TJMA','TJMG','TJMS','TJMT','TJPA','TJPB','TJPE','TJPI','TJPR','TJRJ','TJRN','TJRO','TJRR','TJRS','TJSC','TJSE','TJSP','TJTO',
  ...Array.from({ length: 24 }, (_, i) => `TRT${i + 1}`), 'TJMMG','TJMRS','TJMSP',
  'TRE-AC','TRE-AL','TRE-AM','TRE-AP','TRE-BA','TRE-CE','TRE-DFT','TRE-ES','TRE-GO','TRE-MA','TRE-MG','TRE-MS','TRE-MT','TRE-PA','TRE-PB','TRE-PE','TRE-PI','TRE-PR','TRE-RJ','TRE-RN','TRE-RO','TRE-RR','TRE-RS','TRE-SC','TRE-SE','TRE-SP','TRE-TO',
];
if (aliases.length !== 91) throw new Error(`alias catalog expected 91, got ${aliases.length}`);
const ufBySigla: Record<string, string> = { AC:'AC',AL:'AL',AM:'AM',AP:'AP',BA:'BA',CE:'CE',DF:'DF',ES:'ES',GO:'GO',MA:'MA',MG:'MG',MS:'MS',MT:'MT',PA:'PA',PB:'PB',PE:'PE',PI:'PI',PR:'PR',RJ:'RJ',RN:'RN',RO:'RO',RR:'RR',RS:'RS',SC:'SC',SE:'SE',SP:'SP',TO:'TO' };
const names: Record<string, string> = { STF:'Supremo Tribunal Federal',CNJ:'Conselho Nacional de Justiça',STJ:'Superior Tribunal de Justiça',TST:'Tribunal Superior do Trabalho',TSE:'Tribunal Superior Eleitoral',STM:'Superior Tribunal Militar' };

function sha(value: Buffer | string) { return crypto.createHash('sha256').update(value).digest('hex'); }
function stableHash(rows: AnyRow[]) { return sha(rows.map(r => JSON.stringify(r, Object.keys(r).sort())).sort().join('\n')); }
async function readJson(file: string) { return JSON.parse(await fs.readFile(path.join(RAW, file), 'utf8')) as unknown; }
async function rawMeta(file: string, provider: string, resourceName: string, url: string, rows: number, parsed: number, duplicates: number) {
  const b = await fs.readFile(path.join(RAW, file));
  return { snapshotId: `${provider.toLowerCase()}-${resourceName}-${DATE}`, provider, resourceName, sourceUrl: url, bytes: b.byteLength, sha256: sha(b), rawPath: path.join(RAW, file), rows, parsed, duplicates, contentType: 'application/json' };
}
function branchFor(sigla: string) {
  if (sigla.startsWith('TRE-') || sigla === 'TSE') return 'ELEITORAL';
  if (sigla.startsWith('TRT') || sigla === 'TST') return 'TRABALHO';
  if (sigla.startsWith('TRF')) return 'FEDERAL';
  if (['TJMMG','TJMRS','TJMSP'].includes(sigla)) return 'MILITAR';
  if (['STJ','STM'].includes(sigla)) return 'SUPERIOR';
  if (sigla === 'STF') return 'STF';
  if (sigla === 'CNJ') return 'CNJ';
  return 'ESTADUAL';
}
function officialName(sigla: string) {
  if (names[sigla]) return names[sigla];
  if (sigla.startsWith('TJ')) return `Tribunal de Justiça ${sigla.slice(2)}`;
  if (sigla.startsWith('TRT')) return `Tribunal Regional do Trabalho da ${sigla.slice(3)}ª Região`;
  if (sigla.startsWith('TRF')) return `Tribunal Regional Federal da ${sigla.slice(3)}ª Região`;
  if (sigla.startsWith('TRE-')) return `Tribunal Regional Eleitoral de ${sigla.slice(4)}`;
  if (sigla.startsWith('TJM')) return `Tribunal de Justiça Militar de ${sigla.slice(3)}`;
  return sigla;
}

const TJBA_UNITS_URL = 'https://transparencia-service-api.tjba.jus.br/unidades';
const TJBA_COMARCAS_URL = 'https://transparencia-service-api.tjba.jus.br/comarcas';
const TJBA_METAS_URL = 'https://transparencia-service-api.tjba.jus.br/metas';
const TJRJ_COMARCAS_URL = 'https://www3.tjrj.jus.br/orgaoservicepub/api/ServicoPub/Comarca';
const TJRJ_ORGAO_URL = 'https://www3.tjrj.jus.br/orgaoservicepub/api/ServicoPub/Orgao';

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const before = Number((await pool.query<{ bytes: string }>(`SELECT pg_database_size(current_database())::text AS bytes`)).rows[0]?.bytes ?? 0);
  const tjbaUnits = await readJson('tjba-unidades.json') as AnyRow[];
  const tjbaComarcas = await readJson('tjba-comarcas.json') as AnyRow[];
  const tjbaMetas = await readJson('tjba-metas.json') as AnyRow[];
  const tjrjComarcaResponse = await readJson('tjrj-comarcas.json') as AnyRow;
  const tjrjComarcas = (tjrjComarcaResponse.data ?? []) as AnyRow[];
  const tjrjUnits: AnyRow[] = [];
  for (let page = 1; page <= 41; page++) {
    const response = await readJson(path.join('tjrj-orgaos', `page-${page}.json`)) as AnyRow;
    tjrjUnits.push(...((response.data ?? []) as AnyRow[]));
  }
  const seenTjba = new Set<string>(); const seenTjrj = new Set<string>();
  let duplicateTjba = 0; for (const r of tjbaUnits) { const k = String(r.idUnidade); if (seenTjba.has(k)) duplicateTjba++; else seenTjba.add(k); }
  let duplicateTjrj = 0; for (const r of tjrjUnits) { const k = String(r.codOrg); if (seenTjrj.has(k)) duplicateTjrj++; else seenTjrj.add(k); }
  const unitRows = [
    ...tjbaUnits.map(r => ({ unitId: `TJBA:UNIT:${r.idUnidade}`, tribunal: 'TJBA', sourceSystem: 'TJBA_API', sourceEntityType: 'UNIDADE', sourceId: String(r.idUnidade), officialName: String(r.dsUnidade ?? ''), parent: null, active: Boolean(r.flAtivo), municipality: r.idMunicipio == null ? null : String(r.idMunicipio), uf: 'BA', payload: r })),
    ...tjrjUnits.map(r => ({ unitId: `TJRJ:ORG:${r.codOrg}`, tribunal: 'TJRJ', sourceSystem: 'TJRJ_API', sourceEntityType: 'ORGAO', sourceId: String(r.codOrg), officialName: String(r.nome ?? ''), parent: r.codComarca == null ? null : String(r.codComarca), active: String(r.ativo ?? '').toUpperCase() === 'S', municipality: null, uf: 'RJ', payload: r })),
  ];
  const tribunals = aliases.map(sigla => ({ tribunalId: `JUD:TRIBUNAL:${sigla}`, sigla, officialName: officialName(sigla), branch: branchFor(sigla), level: sigla.startsWith('TRE-') ? 'REGIONAL' : sigla.startsWith('TJ') || sigla.startsWith('TRT') || sigla.startsWith('TRF') || sigla.startsWith('TJM') ? 'REGIONAL' : 'SUPERIOR', seatUf: ufBySigla[sigla.replace(/^TRE-/, '')] ?? null, sourceSystem: 'CNJ_ENDPOINT_CATALOG', sourceAlias: sigla, sourceUrl: 'https://datajud-wiki.cnj.jus.br/api-publica/acesso/', matchStatus: 'DOCUMENT_VERIFIED' }));
  tribunals.push({ tribunalId: 'JUD:TRIBUNAL:STF', sigla: 'STF', officialName: officialName('STF'), branch: 'STF', level: 'SUPERIOR', seatUf: null, sourceSystem: 'CNJ_INSTITUTIONAL', sourceAlias: null, sourceUrl: 'https://portal.stf.jus.br/', matchStatus: 'DOCUMENT_VERIFIED' });
  tribunals.push({ tribunalId: 'JUD:TRIBUNAL:CNJ', sigla: 'CNJ', officialName: officialName('CNJ'), branch: 'CNJ', level: 'CONTROL', seatUf: null, sourceSystem: 'CNJ_INSTITUTIONAL', sourceAlias: null, sourceUrl: 'https://www.cnj.jus.br/', matchStatus: 'DOCUMENT_VERIFIED' });
  const snapshots = [
    await rawMeta('tjba-unidades.json','TJBA','unidades',TJBA_UNITS_URL,tjbaUnits.length,tjbaUnits.length,duplicateTjba),
    await rawMeta('tjba-comarcas.json','TJBA','comarcas',TJBA_COMARCAS_URL,tjbaComarcas.length,tjbaComarcas.length,0),
    await rawMeta('tjba-metas.json','TJBA','metas',TJBA_METAS_URL,tjbaMetas.length,tjbaMetas.length,0),
    await rawMeta('tjrj-comarcas.json','TJRJ','comarcas',TJRJ_COMARCAS_URL,Number(tjrjComarcaResponse.totalCount ?? tjrjComarcas.length),tjrjComarcas.length,0),
    await rawMeta('tjrj-orgaos/page-1.json','TJRJ','orgaos',TJRJ_ORGAO_URL,Number((await readJson('tjrj-orgaos/page-1.json') as AnyRow).totalCount ?? tjrjUnits.length),tjrjUnits.length,duplicateTjrj),
  ];
  const revisions = [
    { id: `p141-tribunals-${DATE.replaceAll('-','')}`, scope: 'TRIBUNALS', rows: tribunals, snapshotIds: snapshots.map(s => s.snapshotId) },
    { id: `p141-units-tjba-${DATE.replaceAll('-','')}`, scope: 'UNITS_TJBA', rows: unitRows.filter(r => r.tribunal === 'TJBA'), snapshotIds: snapshots.slice(0,3).map(s => s.snapshotId) },
    { id: `p141-units-tjrj-${DATE.replaceAll('-','')}`, scope: 'UNITS_TJRJ', rows: unitRows.filter(r => r.tribunal === 'TJRJ'), snapshotIds: snapshots.slice(3).map(s => s.snapshotId) },
  ];
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const [code,name,kind] of branches) await client.query(`INSERT INTO civica_jud.jud_branch(branch_id,code,name,institutional_kind,source_url,source_ref,status,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name`, [`JUD:BRANCH:${code}`,code,name,kind,'https://www.cnj.jus.br/poder-judiciario/','P14.0/P14.1','ACTIVE',JSON.stringify({phase:'P14.1'})]);
    for (const [code,name] of degrees) await client.query(`INSERT INTO civica_jud.jud_degree(degree_id,code,name,source_url,provenance) VALUES($1,$2,$3,$4,$5) ON CONFLICT(code) DO UPDATE SET name=EXCLUDED.name`, [`JUD:DEGREE:${code}`,code,name,'https://www.cnj.jus.br/sgt/',JSON.stringify({phase:'P14.1'})]);
    for (const t of tribunals) await client.query(`INSERT INTO civica_jud.jud_tribunal(tribunal_id,sigla,official_name,branch_id,institutional_level,source_system,source_alias,seat_uf,status,match_status,source_url,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'ACTIVE',$9,$10,$11) ON CONFLICT(tribunal_id) DO UPDATE SET official_name=EXCLUDED.official_name,branch_id=EXCLUDED.branch_id,source_system=EXCLUDED.source_system,source_alias=EXCLUDED.source_alias,seat_uf=EXCLUDED.seat_uf,match_status=EXCLUDED.match_status WHERE civica_jud.jud_tribunal.official_name IS DISTINCT FROM EXCLUDED.official_name OR civica_jud.jud_tribunal.match_status IS DISTINCT FROM EXCLUDED.match_status`, [t.tribunalId,t.sigla,t.officialName,`JUD:BRANCH:${t.branch}`,t.level,t.sourceSystem,t.sourceAlias,t.seatUf,t.matchStatus,t.sourceUrl,JSON.stringify({phase:'P14.1',datajudCalls:0})]);
    for (const s of snapshots) await client.query(`INSERT INTO civica_jud.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,$2,$3,$4,$5,200,$6,$7,$8,$9,'p14.1-v1',$10,$11,0,$12,'COMPLETE',$13) ON CONFLICT(snapshot_id) DO UPDATE SET bytes=EXCLUDED.bytes,sha256=EXCLUDED.sha256,source_rows=EXCLUDED.source_rows,parsed_rows=EXCLUDED.parsed_rows,duplicate_rows=EXCLUDED.duplicate_rows,status=EXCLUDED.status,details=EXCLUDED.details`, [s.snapshotId,s.provider,s.resourceName,s.sourceUrl,OBSERVED_AT,s.contentType,s.bytes,s.sha256,s.rawPath,s.rows,s.parsed,s.duplicates,JSON.stringify({rawOnD:true})]);
    for (const r of revisions) {
      const semanticHash = stableHash(r.rows);
      await client.query(`UPDATE civica_jud.jud_publication_revision SET is_active=false WHERE scope=$1 AND is_active=true AND revision_id<>$2`, [r.scope, r.id]);
      await client.query(`INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,created_at,activated_at,provenance) VALUES($1,$2,$3,$4,$5,'ACTIVE',true,true,$6,$6,$7) ON CONFLICT(revision_id) DO UPDATE SET semantic_hash=EXCLUDED.semantic_hash,row_count=EXCLUDED.row_count,state='ACTIVE',is_active=true,last_known_good=true,activated_at=EXCLUDED.activated_at,snapshot_ids=EXCLUDED.snapshot_ids WHERE civica_jud.jud_publication_revision.semantic_hash IS DISTINCT FROM EXCLUDED.semantic_hash OR civica_jud.jud_publication_revision.is_active IS DISTINCT FROM true`, [r.id,r.scope,JSON.stringify(r.snapshotIds),semanticHash,r.rows.length,OBSERVED_AT,JSON.stringify({phase:'P14.1',replaySafe:true})]);
      if (r.scope === 'TRIBUNALS') for (const t of r.rows) await client.query(`INSERT INTO civica_jud.jud_tribunal_version(tribunal_id,revision_id,official_name,sigla,status,source_hash,observed_at,provenance) VALUES($1,$2,$3,$4,'ACTIVE',$5,$6,$7) ON CONFLICT(tribunal_id,revision_id) DO NOTHING`, [t.tribunalId,r.id,t.officialName,t.sigla,semanticHash,OBSERVED_AT,JSON.stringify({scope:r.scope})]);
    }
    for (const u of unitRows) {
      const revisionId = u.tribunal === 'TJBA' ? `p141-units-tjba-${DATE.replaceAll('-','')}` : `p141-units-tjrj-${DATE.replaceAll('-','')}`;
      await client.query(`INSERT INTO civica_jud.jud_unit(unit_id,tribunal_id,degree_id,source_system,source_entity_type,source_id,official_name,source_parent_id,physical_municipality_source_code,physical_municipality_source_system,physical_uf,active,match_status,source_url,raw_payload) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'DOCUMENT_VERIFIED',$13,$14) ON CONFLICT(unit_id) DO UPDATE SET official_name=EXCLUDED.official_name,source_parent_id=EXCLUDED.source_parent_id,physical_municipality_source_code=EXCLUDED.physical_municipality_source_code,active=EXCLUDED.active,raw_payload=EXCLUDED.raw_payload WHERE civica_jud.jud_unit.official_name IS DISTINCT FROM EXCLUDED.official_name OR civica_jud.jud_unit.source_parent_id IS DISTINCT FROM EXCLUDED.source_parent_id OR civica_jud.jud_unit.physical_municipality_source_code IS DISTINCT FROM EXCLUDED.physical_municipality_source_code OR civica_jud.jud_unit.active IS DISTINCT FROM EXCLUDED.active OR civica_jud.jud_unit.raw_payload IS DISTINCT FROM EXCLUDED.raw_payload`, [u.unitId,`JUD:TRIBUNAL:${u.tribunal}`,'JUD:DEGREE:NA',u.sourceSystem,u.sourceEntityType,u.sourceId,u.officialName,u.parent,u.municipality,u.sourceSystem,u.uf,u.active,u.tribunal === 'TJBA' ? TJBA_UNITS_URL : TJRJ_ORGAO_URL,JSON.stringify(u.payload)]);
      const srcHash = sha(JSON.stringify(u.payload));
      await client.query(`INSERT INTO civica_jud.jud_external_id(entity_type,canonical_id,source_system,source_entity_type,source_id,match_status,evidence,revision_id) VALUES('UNIT',$1,$2,$3,$4,'EXACT_OFFICIAL',$5,$6) ON CONFLICT DO NOTHING`, [u.unitId,u.sourceSystem,u.sourceEntityType,u.sourceId,'source-native official unit id',revisionId]);
      await client.query(`INSERT INTO civica_jud.jud_unit_version(unit_id,revision_id,official_name,source_parent_id,physical_municipality_source_code,active,source_hash,observed_at,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT(unit_id,revision_id) DO NOTHING`, [u.unitId,revisionId,u.officialName,u.parent,u.municipality,u.active,srcHash,OBSERVED_AT,JSON.stringify({sourceSystem:u.sourceSystem})]);
    }
    for (const m of tjbaMetas) {
      const uid = `TJBA:UNIT:${m.codCnjUnidade}`; if (!seenTjba.has(String(m.codCnjUnidade))) continue;
      await client.query(`INSERT INTO civica_jud.jud_territorial_relation(relation_kind,unit_id,source_system,source_relation_id,territory_source_code,territory_name,match_status,revision_id,evidence,raw_payload) VALUES('COMARCA_MEMBERSHIP',$1,'TJBA_API',$2,$3,$4,'DOCUMENT_VERIFIED',$5,'TJBA metas API: codCnjComarca/codCnjUnidade',$6) ON CONFLICT DO NOTHING`, [uid,`${m.codCnjUnidade}:${m.codCnjComarca}`,String(m.codCnjComarca),String(m.comarca ?? ''),`p141-units-tjba-${DATE.replaceAll('-','')}`,JSON.stringify(m)]);
    }
    for (const u of tjrjUnits) {
      await client.query(`INSERT INTO civica_jud.jud_territorial_relation(relation_kind,unit_id,source_system,source_relation_id,territory_source_code,territory_name,match_status,revision_id,evidence,raw_payload) VALUES('COMARCA_MEMBERSHIP',$1,'TJRJ_API',$2,$3,$4,'DOCUMENT_VERIFIED',$5,'TJRJ Orgao API codComarca',$6) ON CONFLICT DO NOTHING`, [`TJRJ:ORG:${u.codOrg}`,`${u.codOrg}:${u.codComarca}`,u.codComarca == null ? null : String(u.codComarca),String(tjrjComarcas.find(c => String(c.codComarca) === String(u.codComarca))?.nome ?? ''),`p141-units-tjrj-${DATE.replaceAll('-','')}`,JSON.stringify(u)]);
    }
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  const after = Number((await pool.query<{ bytes: string }>(`SELECT pg_database_size(current_database())::text AS bytes`)).rows[0]?.bytes ?? 0);
  const growth = after - before;
  if (growth > MAX_GROWTH) throw new Error(`DB_BUDGET_GATE failed: ${growth}`);
  const counts = await pool.query<{ tribunals: string; units: string; relations: string; snapshots: string; revisions: string }>(`SELECT (SELECT count(*) FROM civica_jud.jud_tribunal)::text tribunals,(SELECT count(*) FROM civica_jud.jud_unit)::text units,(SELECT count(*) FROM civica_jud.jud_territorial_relation)::text relations,(SELECT count(*) FROM civica_jud.jud_source_snapshot)::text snapshots,(SELECT count(*) FROM civica_jud.jud_publication_revision)::text revisions`);
  console.log(JSON.stringify({ database: db, beforeBytes: before, afterBytes: after, growthBytes: growth, maxGrowthBytes: MAX_GROWTH, tribunals: Number(counts.rows[0].tribunals), units: Number(counts.rows[0].units), relations: Number(counts.rows[0].relations), snapshots: Number(counts.rows[0].snapshots), revisions: Number(counts.rows[0].revisions), source: { tjbaUnits: tjbaUnits.length, tjbaMetas: tjbaMetas.length, tjrjUnits: tjrjUnits.length, tjrjComarcas: tjrjComarcas.length }, duplicateRows: { tjba: duplicateTjba, tjrj: duplicateTjrj }, datajudCalls: 0 }));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
