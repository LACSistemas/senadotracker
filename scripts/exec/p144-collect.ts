import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';

const ROOT = 'D:\\Civica\\judiciario\\stj';
const REVISION_ID = 'p144-stj-20261104';
const PARSER_VERSION = 'p14.4-v1';
const cutoff = new Date('2026-11-04T23:59:59Z');
const pool = openPool(4);
const sha256 = (value: Buffer | string) => crypto.createHash('sha256').update(value).digest('hex');
const norm = (value: unknown) => String(value ?? '').trim();
const nullable = (value: unknown) => { const v = norm(value); return v === '' || v.toLowerCase() === 'null' ? null : v; };
const dateValue = (value: unknown) => {
  const v = nullable(value); if (!v) return null;
  if (/^\d{8}$/.test(v)) return `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  return null;
};
const integerValue = (value: unknown) => { const v = nullable(value); if (!v) return null; const n = Number(v.replace(/[^0-9-]/g, '')); return Number.isSafeInteger(n) ? n : null; };
const text = (value: unknown, max = 200000) => { const v = nullable(value); return v ? v.slice(0, max) : null; };
const boolValue = (value: unknown) => { const v = nullable(value)?.toUpperCase(); return v === 'S' ? true : v === 'N' ? false : null; };
const normalizeName = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();

function parseCsv(input: string, delimiter = ','): Record<string, string>[] {
  const rows: string[][] = []; let row: string[] = []; let field = ''; let quoted = false;
  for (let i = 0; i < input.length; i++) { const c = input[i];
    if (quoted) { if (c === '"' && input[i + 1] === '"') { field += '"'; i++; } else if (c === '"') quoted = false; else field += c; }
    else if (c === '"') quoted = true;
    else if (c === delimiter) { row.push(field); field = ''; }
    else if (c === '\n') { row.push(field.replace(/\r$/, '')); rows.push(row); row = []; field = ''; }
    else field += c;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/, '')); rows.push(row); }
  const headers = (rows.shift() ?? []).map((x, i) => i === 0 ? x.replace(/^\uFEFF/, '').trim() : x.trim());
  return rows.filter(r => r.some(x => x !== '')).map(r => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ''])));
}
async function readCsv(file: string, delimiter = ',') {
  const b = await fs.readFile(file); const utf = b.toString('utf8'); return parseCsv(utf.replace(/^\uFEFF/, ''), delimiter);
}
async function readJson(file: string) { return JSON.parse(await fs.readFile(file, 'utf8')) as Record<string, unknown>[]; }
async function fileMeta(file: string, url: string, sourceRows: number, parsedRows: number, duplicateRows: number, contentType: string) {
  const b = await fs.readFile(file); const fileSha = sha256(b); const stat = await fs.stat(file);
  const id = `STJ:SNAP:${sha256(`${url}|${fileSha}`).slice(0, 40)}`;
  return { snapshotId: id, provider: 'STJ', resourceName: path.basename(file), sourceUrl: url, fetchedAt: stat.mtime.toISOString(), httpStatus: 200, contentType, bytes: b.length, sha256: fileSha, rawPath: file, parserVersion: PARSER_VERSION, sourceRows, parsedRows, rejectedRows: Math.max(0, sourceRows - parsedRows), duplicateRows };
}
const relationId = (kind: string, source: string, target: string) => `STJ:REL:${sha256(`${kind}|${source}|${target}`).slice(0, 40)}`;

const resources = {
  temas: 'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/df29da13-7d6b-41ba-ad96-cd1a5bbd191c/download/temas.csv',
  processos: 'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/7ed21202-0049-4fcb-aa7c-48d810d3c499/download/processos.csv',
  espelhoPrimeira: 'https://dadosabertos.web.stj.jus.br/dataset/a96a175b-a54b-4bfd-82b8-fcd7cc0200bc/resource/dea9d4ed-b6f5-4141-9abf-ec3497e2800d/download/20260930.json',
  espelhoSegunda: 'https://dadosabertos.web.stj.jus.br/dataset/7107650a-f26c-4900-bffd-4492af6361cf/resource/767395a9-0c5b-42c6-be17-dbc4edd3fadb/download/20260930.json',
  espelhoDicionarioPrimeira: 'https://dadosabertos.web.stj.jus.br/dataset/a96a175b-a54b-4bfd-82b8-fcd7cc0200bc/resource/c2c1d8cb-57bf-476b-ae7f-1dbaf9695b2b/download/dicionario-espelhodoacordao.csv',
  espelhoDicionarioSegunda: 'https://dadosabertos.web.stj.jus.br/dataset/7107650a-f26c-4900-bffd-4492af6361cf/resource/fabfa334-db70-4a82-9364-5731208ec6f8/download/dicionario-espelhodoacordao.csv',
  dicionarioTemas: 'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/d5e50514-6d6d-4f1e-8557-94f135eae03b/download/dicionario-temas.csv',
  dicionarioProcessos: 'https://dadosabertos.web.stj.jus.br/dataset/4238da2f-c07b-4c1a-b345-4402accacdcf/resource/162e58f0-01c1-4d91-94a4-664b4de81e79/download/dicionario-processos.csv',
  decisoes: 'https://dadosabertos.web.stj.jus.br/dataset/a2cd85cc-1391-4ebc-aeed-a45dd75a7987/resource/c91d9032-2cb4-43cf-b1e9-08318a547bef/download/metadados20261013.json',
  dicionarioDecisoes: 'https://dadosabertos.web.stj.jus.br/dataset/a2cd85cc-1391-4ebc-aeed-a45dd75a7987/resource/0488e8aa-33a3-494d-86ef-17889a0155ee/download/dicionariointegrasdecisoes.csv',
};

try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);
  const before = Number((await pool.query(`SELECT pg_database_size(current_database())::bigint bytes`)).rows[0].bytes);
  const temasRows = await readCsv(path.join(ROOT, 'precedentes', 'Temas.csv'));
  const processosRows = await readCsv(path.join(ROOT, 'precedentes', 'Processos.csv'));
  const espelhos = [
    { dataset: 'espelhos-de-acordaos-primeira-secao', file: path.join(ROOT, 'espelhos', 'primeira-secao', '20260930.json'), url: resources.espelhoPrimeira, rows: await readJson(path.join(ROOT, 'espelhos', 'primeira-secao', '20260930.json')) },
    { dataset: 'espelhos-de-acordaos-segunda-secao', file: path.join(ROOT, 'espelhos', 'segunda-secao', '20260930.json'), url: resources.espelhoSegunda, rows: await readJson(path.join(ROOT, 'espelhos', 'segunda-secao', '20260930.json')) },
  ];
  const decisoes = await readJson(path.join(ROOT, 'decisoes', 'metadados20261013.json'));
  const dictionaries = [
    { file: path.join(ROOT, 'precedentes', 'dicionario-temas.csv'), url: resources.dicionarioTemas },
    { file: path.join(ROOT, 'precedentes', 'dicionario-processos.csv'), url: resources.dicionarioProcessos },
    { file: path.join(ROOT, 'espelhos', 'primeira-secao', 'dicionario-espelhodoacordao.csv'), url: resources.espelhoDicionarioPrimeira },
    { file: path.join(ROOT, 'espelhos', 'segunda-secao', 'dicionario-espelhodoacordao.csv'), url: resources.espelhoDicionarioSegunda },
    { file: path.join(ROOT, 'decisoes', 'dicionariointegrasdecisoes.csv'), url: resources.dicionarioDecisoes },
  ];
  const themeBySeq = new Map<string, Record<string, string>>();
  for (const r of temasRows) { const k = norm(r.sequencialPrecedente); if (k && !themeBySeq.has(k)) themeBySeq.set(k, r); }
  const processByKey = new Map<string, Record<string, string>>();
  for (const r of processosRows) { const k = `${norm(r.sequencialPrecedente)}|${norm(r.numeroRegistro)}|${norm(r.Processo)}`; if (!processByKey.has(k)) processByKey.set(k, r); }
  const themes = [...themeBySeq.entries()].map(([seq, r]) => ({ seq, r }));
  const processes = [...processByKey.entries()].map(([key, r]) => ({ key, r }));
  const mirrors = espelhos.flatMap(e => e.rows.map(r => ({ dataset: e.dataset, resourceName: path.basename(e.file), url: e.url, r })));
  const mirrorById = new Map<string, typeof mirrors[number]>(); for (const m of mirrors) if (norm(m.r.id) && !mirrorById.has(norm(m.r.id))) mirrorById.set(norm(m.r.id), m);
  const decisionById = new Map<string, Record<string, unknown>>(); for (const r of decisoes) if (norm(r.SeqDocumento) && !decisionById.has(norm(r.SeqDocumento))) decisionById.set(norm(r.SeqDocumento), r);
  const snapshots = [
    await fileMeta(path.join(ROOT, 'precedentes', 'Temas.csv'), resources.temas, temasRows.length, themes.length, temasRows.length - themes.length, 'text/csv'),
    await fileMeta(path.join(ROOT, 'precedentes', 'Processos.csv'), resources.processos, processosRows.length, processes.length, processosRows.length - processes.length, 'text/csv'),
    ...espelhos.map(async e => {
      const uniqueInFile = new Set(e.rows.map(x => norm(x.id)).filter(Boolean)).size;
      return fileMeta(e.file, e.url, e.rows.length, uniqueInFile, e.rows.length - uniqueInFile, 'application/json');
    }),
    await fileMeta(path.join(ROOT, 'decisoes', 'metadados20261013.json'), resources.decisoes, decisoes.length, decisionById.size, decisoes.length - decisionById.size, 'application/json'),
    ...await Promise.all(dictionaries.map(async d => {
      const rows = await readCsv(d.file);
      return fileMeta(d.file, d.url, rows.length, rows.length, 0, 'text/csv');
    })),
  ];
  const snapshotRows = await Promise.all(snapshots);
  const persistedSnapshots = snapshotRows
    .filter((s, i, all) => all.findIndex(x => x.sha256 === s.sha256) === i)
    .map(s => ({ ...s, duplicateResources: snapshotRows.filter(x => x.sha256 === s.sha256 && x.snapshotId !== s.snapshotId).map(x => ({ resourceName: x.resourceName, sourceUrl: x.sourceUrl, rawPath: x.rawPath })) }));
  const semanticPayload = { themes: themes.map(x => [x.seq, x.r]), processes: processes.map(x => [x.key, x.r]), mirrors: [...mirrorById.keys()].sort().map(k => [k, mirrorById.get(k)?.r]), decisions: [...decisionById.keys()].sort().map(k => [k, decisionById.get(k)]) };
  const semanticHash = sha256(JSON.stringify(semanticPayload));
  const previous = (await pool.query(`SELECT revision_id,semantic_hash FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='STJ_JURISPRUDENCE' AND is_active=true ORDER BY created_at DESC LIMIT 1`)).rows[0];
  for (const s of persistedSnapshots) await pool.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_source_snapshot(snapshot_id,provider,resource_name,source_url,fetched_at,http_status,content_type,bytes,sha256,raw_path,parser_version,source_rows,parsed_rows,rejected_rows,duplicate_rows,status,details) VALUES($1,'STJ',$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,'ACQUIRED',$15::jsonb) ON CONFLICT(snapshot_id) DO UPDATE SET parsed_rows=EXCLUDED.parsed_rows,rejected_rows=EXCLUDED.rejected_rows,duplicate_rows=EXCLUDED.duplicate_rows,source_rows=EXCLUDED.source_rows,details=EXCLUDED.details`, [s.snapshotId,s.resourceName,s.sourceUrl,s.fetchedAt,s.httpStatus,s.contentType,s.bytes,s.sha256,s.rawPath,s.parserVersion,s.sourceRows,s.parsedRows,s.rejectedRows,s.duplicateRows,JSON.stringify({dataset:'STJ',cutoff:'2026-11-04',duplicateResources:s.duplicateResources})]);
  const snapshotByPath = new Map(persistedSnapshots.map(s => [path.normalize(s.rawPath), s.snapshotId]));
  if (previous?.semantic_hash === semanticHash) {
    console.log(JSON.stringify({ database: db, revision: previous.revision_id, status: 'NO_CHANGE', before, after: before, dbGrowth: 0, themesSource: temasRows.length, themesCanonical: themes.length, processesSource: processosRows.length, processLinks: processes.length, mirrorsSource: mirrors.length, mirrorsUnique: mirrorById.size, decisionsSource: decisoes.length, decisionsUnique: decisionById.size }));
    process.exit(0);
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET is_active=false WHERE scope='STJ_JURISPRUDENCE'`);
    await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance) VALUES($1,'STJ_JURISPRUDENCE',$2::jsonb,$3,$4,'STAGED',false,true,$5,now(),NULL,$6::jsonb)`, [REVISION_ID, JSON.stringify(persistedSnapshots.map(s => s.snapshotId)), semanticHash, themes.length + processes.length + mirrorById.size + decisionById.size, previous?.revision_id ?? null, JSON.stringify({provider:'STJ',parser:PARSER_VERSION,sourceCutoff:'2026-11-04'})]);
    const snapThemes = snapshotByPath.get(path.normalize(path.join(ROOT, 'precedentes', 'Temas.csv')))!, snapProcesses = snapshotByPath.get(path.normalize(path.join(ROOT, 'precedentes', 'Processos.csv')))!, snapDecisions = snapshotByPath.get(path.normalize(path.join(ROOT, 'decisoes', 'metadados20261013.json')))!;
    for (const { seq, r } of themes) {
      const precedentId = `STJ:PRECEDENT:${seq}`; const rawHash = sha256(JSON.stringify(r));
      await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_precedent(precedent_id,publication_revision_id,source_sequential,precedent_type,precedent_number,first_affectation_date,judgment_date,publication_date,status,complementary_information,submitted_question,fixed_thesis,annotations,judgment_scope,previous_understanding,legislative_reference,summary_reference,originated_summary,public_hearing,public_hearing_date,organ_name,subjects,stf_general_repercussion_number,stf_general_repercussion_description,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb)`, [precedentId,REVISION_ID,seq,text(r.tipoPrecedente),text(r.numeroPrecedente),dateValue(r.dataPrimeiraAfetacao),dateValue(r.dataJulgamento),dateValue(r.dataPublicacaoAcordao),text(r.situacao),text(r.informacoesComplementares),text(r.questaoSubmetidaAJulgamento),text(r.teseFirmada),text(r.anotacoesNUGEPNAC),text(r.delimitacaoJulgado),text(r.entendimentoAnterior),text(r.referenciaLegislativa),text(r.referenciaSumular),text(r.sumulaOriginada),boolValue(r.audienciaPublica),dateValue(r.dataAudienciaPublica),text(r.orgaoJulgador),text(r.Assuntos),text(r.numeroRepercussaoGeralSTF),text(r.descricaoRepercussaoGeral),snapThemes,rawHash,JSON.stringify({source:'Temas.csv',sourceSequential:seq})]);
    }
    for (const { key, r } of processes) {
      const seq = norm(r.sequencialPrecedente); const processId = `STJ:PROCESS:${sha256(key).slice(0, 40)}`; const rawHash = sha256(JSON.stringify(r));
      await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_precedent_process(process_id,publication_revision_id,precedent_id,source_sequential,process_label,registration_number,relator_name,leading_case,affectation_date,affectation_publication_date,affectation_note,affectation_proposer,mpf_view_date,judgment_date,judgment_publication_date,stf_process,stf_remittance_date,stf_status,origin_court,origin_court_sigla,origin_region,origin_uf,origin_justice_type,suspended_origin_processes,declaration_embargo_publication_date,desafectation,divergent_embargo,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30::jsonb)`, [processId,REVISION_ID,`STJ:PRECEDENT:${seq}`,seq,text(r.Processo),text(r.numeroRegistro),text(r.ministroRelator),norm(r.leadingCase).toUpperCase()==='S',dateValue(r.dataAfetacao),dateValue(r.dataPublicacaoAfetacao),text(r.observacaoAfetacao),text(r.NOME_MINISTRO_AFETACAO),dateValue(r.dataVistaMPF),dateValue(r.dataJulgamento),dateValue(r.dataPbulicacaoAcordao),text(r.processoSTF),dateValue(r.dataRemessaSTF),text(r.situacaoProcessoSTF),text(r.tribunalOrigem),text(r.siglaTribunalOrigem),text(r.siglaRegiaoOrigem),text(r.origemUF)?.slice(0,2) ?? null,text(r.tipoJusticaOrigem),integerValue(r.quantidadeProcessosSuspensoNaOrigem),dateValue(r.dataPublicacaoEmbargosDeDeclaração),text(r.Desafetação),text(r['Embargos de Divergência'] ?? r.EmbargosdeDivergência),snapProcesses,rawHash,JSON.stringify({source:'Processos.csv',naturalKey:key})]);
      const rid = relationId('PRECEDENT_PROCESS', `STJ:PRECEDENT:${seq}`, processId);
      await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_document_relation(relation_id,publication_revision_id,relation_kind,source_type,source_id,target_type,target_id,match_status,evidence,source_snapshot_id,provenance) VALUES($1,$2,'PRECEDENT_PROCESS','PRECEDENT',$3,'PROCESS',$4,'OFFICIAL_ID','sequencialPrecedente shared by official Temas.csv and Processos.csv',$5,$6::jsonb)`, [rid,REVISION_ID,`STJ:PRECEDENT:${seq}`,processId,snapProcesses,JSON.stringify({sourceKey:key})]);
    }
    const orgNames = new Set<string>(); const relatorNames = new Set<string>();
    for (const m of mirrorById.values()) { if (text(m.r.nomeOrgaoJulgador)) orgNames.add(norm(m.r.nomeOrgaoJulgador)); if (text(m.r.ministroRelator)) relatorNames.add(norm(m.r.ministroRelator)); }
    for (const r of processosRows) if (text(r.ministroRelator)) relatorNames.add(norm(r.ministroRelator));
    for (const r of decisoes) if (text(r.NM_MINISTRO)) relatorNames.add(norm(r.NM_MINISTRO));
    for (const name of [...orgNames].sort()) await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_orgao(org_id,source_name,normalized_name,verification_status,source_snapshot_id,provenance) VALUES($1,$2,$3,'SOURCE_STRUCTURED',$4,$5::jsonb) ON CONFLICT(normalized_name) DO NOTHING`, [`STJ:ORG:${sha256(name).slice(0,40)}`,name,normalizeName(name),snapThemes,JSON.stringify({source:'STJ structured field'})]);
    for (const name of [...relatorNames].sort()) await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_person(person_id,source_name,normalized_name,role,verification_status,source_snapshot_id,provenance) VALUES($1,$2,$3,'RELATOR','SOURCE_NOMINAL_UNIQUE',$4,$5::jsonb) ON CONFLICT(normalized_name) DO NOTHING`, [`STJ:PERSON:${sha256(normalizeName(name)).slice(0,40)}`,name,normalizeName(name),snapProcesses,JSON.stringify({source:'STJ nominal field',identity:'source-native name; no national person ID'})]);
    const snapMirror = (dataset: string) => snapshotByPath.get(path.normalize(espelhos.find(e => e.dataset === dataset)!.file))!;
    for (const m of mirrorById.values()) {
      const r = m.r; const mirrorId = `STJ:MIRROR:${norm(r.id)}`; const rawHash = sha256(JSON.stringify(r));
      await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_acordao_mirror(mirror_id,publication_revision_id,dataset_name,source_resource_name,process_number,registration_number,class_sigla,class_description,organ_name,relator_name,decision_date,publication_source,decision_type,ementa,decision_summary,cited_jurisprudence,notes,complementary_information,auxiliary_terms,legal_thesis,theme_reference,legislative_references,similar_acordaos,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22::jsonb,$23::jsonb,$24,$25,$26::jsonb)`, [mirrorId,REVISION_ID,m.dataset,m.resourceName,text(r.numeroProcesso),text(r.numeroRegistro),text(r.siglaClasse),text(r.descricaoClasse),text(r.nomeOrgaoJulgador),text(r.ministroRelator),dateValue(r.dataDecisao),text(r.dataPublicacao),text(r.tipoDeDecisao),text(r.ementa),text(r.decisao),text(r.jurisprudenciaCitada),text(r.notas),text(r.informacoesComplementares),text(r.termosAuxiliares),text(r.teseJuridica),text(r.tema),JSON.stringify(r.referenciasLegislativas ?? []),JSON.stringify(r.acordaosSimilares ?? []),snapMirror(m.dataset),rawHash,JSON.stringify({source:m.dataset,sourceId:norm(r.id)})]);
       const themeMatch = norm(r.tema).match(/Tema Repetitivo\s+(\d+)/i); if (themeMatch) { const theme = themes.find(x => norm(x.r.tipoPrecedente)==='Tema' && norm(x.r.numeroPrecedente)===themeMatch[1]); if (theme) { const target = `STJ:PRECEDENT:${theme.seq}`; await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_document_relation(relation_id,publication_revision_id,relation_kind,source_type,source_id,target_type,target_id,match_status,evidence,source_snapshot_id,provenance) VALUES($1,$2,'MIRROR_PRECEDENT_REFERENCE','MIRROR',$3,'PRECEDENT',$4,'OFFICIAL_REFERENCE','theme field explicitly names Tema Repetitivo and number',$5,$6::jsonb) ON CONFLICT(relation_kind,source_id,target_id,publication_revision_id) DO NOTHING`, [relationId('MIRROR_PRECEDENT_REFERENCE',mirrorId,target),REVISION_ID,mirrorId,target,snapMirror(m.dataset),JSON.stringify({themeReference:norm(r.tema)})]); } }
    }
    for (const [id, r] of decisionById.entries()) { const rawHash = sha256(JSON.stringify(r)); await client.query(`INSERT INTO ${JUDICIARY_SCHEMA}.jud_stj_decision(decision_id,publication_revision_id,source_resource_name,publication_date,decision_type,registration_number,process_label,receipt_date,distribution_date,relator_name,appeal_type,outcome,monocratic_description,subjects,source_snapshot_id,raw_row_hash,provenance) VALUES($1,$2,'metadados20261013.json',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)`, [`STJ:DECISION:${id}`,REVISION_ID,dateValue(r.dataPublicacao),text(r.tipoDocumento),text(r.numeroRegistro),text(r.processo),dateValue(r.dataRecebimento),dateValue(r.dataDistribuição),text(r.NM_MINISTRO),text(r.recurso),text(r.teor),text(r.descricaoMonocratica),text(r.assuntos),snapDecisions,rawHash,JSON.stringify({source:'integras-de-decisoes-terminativas-e-acordaos-do-diario-da-justica',sourceId:id})]); }
    await client.query(`UPDATE ${JUDICIARY_SCHEMA}.jud_publication_revision SET state='ACTIVE',is_active=true,last_known_good=true,activated_at=now(),provenance=provenance || $2::jsonb WHERE revision_id=$1`, [REVISION_ID, JSON.stringify({activated:true})]);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  const after = Number((await pool.query(`SELECT pg_database_size(current_database())::bigint bytes`)).rows[0].bytes); const rels = Number((await pool.query(`SELECT count(*)::int n FROM ${JUDICIARY_SCHEMA}.jud_stj_document_relation WHERE publication_revision_id=$1`, [REVISION_ID])).rows[0].n);
  console.log(JSON.stringify({ database: db, revision: REVISION_ID, status: previous ? 'NEW_REVISION' : 'PUBLISHED', themesSource: temasRows.length, themesCanonical: themes.length, processesSource: processosRows.length, processesCanonical: processes.length, processLinks: processes.length, mirrorsSource: mirrors.length, mirrorsUnique: mirrorById.size, decisionsSource: decisoes.length, decisionsUnique: decisionById.size, relations: rels, before, after, dbGrowth: after - before, dbEnvelopeRemaining: 100000000 - (after - 34642029715) }));
} catch (error) { console.error(error); process.exitCode = 1; } finally { await pool.end(); }
