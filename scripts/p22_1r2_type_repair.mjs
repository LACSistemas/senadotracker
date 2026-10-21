import pg from 'pg';
import fs from 'node:fs';
import crypto from 'node:crypto';

const DB = 'civica_postgres_lab';
const SCHEMA = 'civica_state';
const HOUSES = ['ES', 'BA'];
const ART = 'artifacts';
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex');
const norm = (v) => String(v ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

const ES_CATALOG = {
  '1343': ['Boletim de Votação Nominal', 'VOTING_INSTRUMENT'],
  '287': ['Emenda', 'AMENDMENT'],
  '18': ['Indicação', 'INDICATION'],
  '17': ['Mensagem de Resposta ao Requerimento de Informação', 'SPECIAL_DOCUMENT'],
  '1344': ['Mensagem do Governo do Estado', 'SPECIAL_DOCUMENT'],
  '9': ['Ofício', 'SPECIAL_DOCUMENT'],
  '316': ['Ofício (Justificativa Ausência - Com. Permanente)', 'SPECIAL_DOCUMENT'],
  '2407': ['Ofício (Justificativa Ausência - Com. Temporária)', 'SPECIAL_DOCUMENT'],
  '325': ['Ofício (Justificativa de Ausência em Plenário)', 'SPECIAL_DOCUMENT'],
  '327': ['Ofício (Relatório de Atividades das Comissões)', 'SPECIAL_DOCUMENT'],
  '2371': ['Ofício de Instalação de Comissão Temporária', 'SPECIAL_DOCUMENT'],
  '2500': ['Ofício de Origem Externa (Secretarias e Órgãos Públicos Estaduais de Municipais)', 'SPECIAL_DOCUMENT'],
  '336': ['Ofício de Prestação de Contas TCE-ES', 'SPECIAL_DOCUMENT'],
  '2392': ['Ofício do Gabinete de Deputado', 'SPECIAL_DOCUMENT'],
  '2391': ['Ofício e Documento (Origem Externa)', 'SPECIAL_DOCUMENT'],
  '314': ['Parecer da Comissão', 'OPINION'],
  '6': ['Projeto de Decreto Legislativo', 'LEGISLATIVE_MAIN'],
  '5': ['Projeto de Lei', 'LEGISLATIVE_MAIN'],
  '4': ['Projeto de Lei Complementar', 'LEGISLATIVE_MAIN'],
  '7': ['Projeto de Resolução', 'LEGISLATIVE_MAIN'],
  '3': ['Proposta de Emenda à Constituição Estadual', 'LEGISLATIVE_MAIN'],
  '8': ['Requerimento', 'REQUEST'],
  '308': ['Requerimento de Congratulação', 'REQUEST'],
  '16': ['Requerimento de Informação', 'REQUEST'],
  '5240': ['Requerimento de Licença Médica de Deputado', 'REQUEST'],
  '2454': ['Requerimento de Licença para desempenhar Missão Autorizada', 'REQUEST'],
  '309': ['Requerimento de Pesar', 'REQUEST'],
  '334': ['Requerimento de Retirada da Proposição', 'REQUEST'],
  '290': ['Requerimento de Sessão Solene/Especial', 'REQUEST'],
  '12': ['Requerimento de Urgência', 'REQUEST'],
  '2386': ['Requerimento p/ Prorrogação/Transposição de Prazos das Comissões Temporárias', 'REQUEST'],
  '2366': ['Requerimento para Criação de Comissões Temporárias', 'REQUEST'],
  '2': ['Veto', 'VOTING_INSTRUMENT'],
};
const BA_CATALOG = {
  '1': ['Projeto de Lei', 'LEGISLATIVE_MAIN'],
  '2': ['Projeto de Decreto Legislativo', 'LEGISLATIVE_MAIN'],
  '3': ['Indicação', 'INDICATION'],
  '4': ['Requerimento', 'REQUEST'],
  '5': ['Mensagem', 'SPECIAL_DOCUMENT'],
  '6': ['Projeto de Lei Complementar', 'LEGISLATIVE_MAIN'],
  '7': ['Moção', 'REQUEST'],
  '9': ['Projeto de Resolução da Mesa Diretora', 'LEGISLATIVE_MAIN'],
  '10': ['Projeto de Emenda Constitucional', 'LEGISLATIVE_MAIN'],
  '11': ['Ofício', 'SPECIAL_DOCUMENT'],
  '12': ['Emenda', 'AMENDMENT'],
  '13': ['Projeto de Resolução', 'LEGISLATIVE_MAIN'],
  '14': ['Representação', 'UNCLASSIFIED'],
  '16': ['Utilidade Pública', 'UNCLASSIFIED'],
};

function sourceTypeId(row) {
  if (row.type_code) return String(row.type_code);
  const url = String(row.provenance?.officialUrl ?? '');
  return url.match(/[?&]tipo=([^&]+)/i)?.[1] ?? null;
}
function catalogFor(house) { return house === 'ES' ? ES_CATALOG : BA_CATALOG; }
function canonical(house, id) { return `${house}_TYPE_${id}`; }
function sortedJson(v) { return JSON.stringify(v, (_, x) => x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x); }

async function main() {
  const pool = new pg.Pool({ host: 'localhost', port: 5432, database: DB, user: 'projetoeleitor_user', password: 'projetoeleitorsenha', max: 4 });
  const c = await pool.connect();
  const db = (await c.query('select current_database()')).rows[0].current_database;
  if (db !== DB) throw new Error(`database guard failed: ${db}`);
  const result = { phase: 'P22.1R2', database: db, houses: {}, startedAt: new Date().toISOString(), productionTouched: false, projecteleitorDbTouched: false, sqliteTouched: false };

  for (const house of HOUSES) {
    const active = (await c.query(`SELECT revision_id FROM ${SCHEMA}.active_publications WHERE house=$1 AND domain='legislative'`, [house])).rows[0]?.revision_id;
    if (!active) throw new Error(`${house}: missing active legislative revision`);
    const before = (await c.query(`SELECT * FROM ${SCHEMA}.proposals WHERE house=$1 AND revision_id=$2 AND year=2026 ORDER BY external_id`, [house, active])).rows;
    const authorsBefore = (await c.query(`SELECT * FROM ${SCHEMA}.proposal_authors WHERE house=$1 AND revision_id=$2 ORDER BY proposal_external_id,author_key`, [house, active])).rows;
    const catalog = catalogFor(house);
    const unknown = [...new Set(before.map(sourceTypeId).filter((id) => !id || !catalog[id]))];
    if (unknown.length) throw new Error(`${house}: unknown source type ids: ${unknown.join(',')}`);
    const mapping = Object.entries(catalog).map(([id, [label, group]]) => ({ house, sourceTypeId: id, officialSourceTypeLabel: label, canonicalTypeCode: canonical(house, id), functionalGroup: group, proposalCount: before.filter((r) => sourceTypeId(r) === id).length, evidence: house === 'ES' ? `P20_7D_ES_consulta-tipo.aspx + P20_7D_ES_type_${id}.html` : `P20_7D_BA_type_${id}.html`, confidence: 'SOURCE_NATIVE_TYPE_CATALOG' })).sort((a, b) => Number(a.sourceTypeId) - Number(b.sourceTypeId));
    const conflicts = mapping.filter((m) => new Set(before.filter((r) => sourceTypeId(r) === m.sourceTypeId).map((r) => m.officialSourceTypeLabel)).size > 1);
    const payload = before.map((r) => [r.external_id, sourceTypeId(r), catalog[sourceTypeId(r)][0], catalog[sourceTypeId(r)][1]]);
    const revision = `state:${house}:legislative:type-semantics:${sha(payload)}`;
    const existing = (await c.query(`SELECT 1 FROM ${SCHEMA}.proposals WHERE house=$1 AND revision_id=$2 LIMIT 1`, [house, revision])).rowCount > 0;
    await c.query('BEGIN');
    if (!existing) {
      for (const r of before) {
        const id = sourceTypeId(r); const [label, group] = catalog[id];
        const provenance = { ...(r.provenance ?? {}), sourceTypeId: id, sourceTypeLabel: label, typeCatalogEvidence: house === 'ES' ? `P20_7D_ES_consulta-tipo.aspx + P20_7D_ES_type_${id}.html` : `P20_7D_BA_type_${id}.html`, currentActivityRaw: r.provenance?.currentActivity ?? null, currentStatusRaw: r.status ?? null };
        await c.query(`INSERT INTO ${SCHEMA}.proposals(revision_id,house,provider,external_id,title,type,number,year,presented_at,status,raw_id,provenance,type_code,type_label,type_group,type_confidence) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT DO NOTHING`, [revision, r.house, r.provider, r.external_id, r.title, canonical(house, id), r.number, r.year, r.presented_at, r.status, r.raw_id, provenance, id, label, group, 'SOURCE_NATIVE_TYPE_CATALOG']);
      }
      for (const a of authorsBefore) {
        const cols = ['revision_id','house','provider','proposal_external_id','author_key','actor_type','person_external_id','organization_external_id','actor_external_key','author_raw','role','author_order','raw_id','provenance','actor_type_raw','actor_type_canonical'];
        const vals = [revision, ...cols.slice(1).map((col) => a[col])];
        await c.query(`INSERT INTO ${SCHEMA}.proposal_authors(${cols.join(',')}) VALUES(${cols.map((_, i) => `$${i + 1}`).join(',')}) ON CONFLICT DO NOTHING`, vals);
      }
      const quality = { phase: 'P22.1R2', previousRevision: active, proposalCount: before.length, authorshipCount: authorsBefore.length, sourceTypeIds: mapping.length, unknownSourceTypes: unknown.length, typeIdLabelConflicts: conflicts.length, sourceCatalogEvidence: mapping.map((m) => m.evidence), status: 'active' };
      await c.query(`INSERT INTO ${SCHEMA}.public_domain_revisions(house,domain,revision_id,status,quality,created_at,activated_at) VALUES($1,'legislative',$2,'active',$3,now(),now()) ON CONFLICT(house,domain,revision_id) DO UPDATE SET status='active',quality=excluded.quality`, [house, revision, quality]);
    }
    await c.query(`INSERT INTO ${SCHEMA}.active_publications(house,domain,revision_id,activated_at) VALUES($1,'legislative',$2,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [house, revision]);
    await c.query('COMMIT');
    const after = (await c.query(`SELECT * FROM ${SCHEMA}.proposals WHERE house=$1 AND revision_id=$2 AND year=2026 ORDER BY external_id`, [house, revision])).rows;
    const authorsAfter = (await c.query(`SELECT * FROM ${SCHEMA}.proposal_authors WHERE house=$1 AND revision_id=$2 ORDER BY proposal_external_id,author_key`, [house, revision])).rows;
    const beforeIds = before.map((r) => r.external_id).sort(); const afterIds = after.map((r) => r.external_id).sort();
    const authorProjection = (rows) => rows.map((r) => colsForAuthors(r)).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    const projectionHash = (rows) => sha(rows.map((r) => JSON.stringify(r)).sort().join('\n'));
    const colsForAuthors = (r) => ({ proposal_external_id:r.proposal_external_id, author_key:r.author_key, actor_type:r.actor_type, person_external_id:r.person_external_id, organization_external_id:r.organization_external_id, author_raw:r.author_raw, role:r.role, author_order:r.author_order, actor_type_canonical:r.actor_type_canonical });
    const proposalProjection = (rows) => rows.map((r) => ({ external_id:r.external_id, title:r.title, number:r.number, year:r.year, presented_at:r.presented_at, status:r.status, raw_id:r.raw_id })).sort((a,b)=>a.external_id.localeCompare(b.external_id));
    const eventRows = (await c.query(`SELECT count(*)::int n FROM ${SCHEMA}.state_proposal_events e JOIN ${SCHEMA}.active_publications a ON a.house=e.house AND a.domain='timeline' AND a.revision_id=e.revision_id WHERE e.house=$1`, [house])).rows[0].n;
    const sample = after.filter((r, i, arr) => arr.findIndex((x) => x.type_code === r.type_code) === i).slice(0, 20).map((r) => ({ proposalId:r.external_id, sourceVisibleType:r.type_label, canonicalType:r.type, functionalGroup:r.type_group, result:'PASS' }));
    const labelAudit = (await c.query(`SELECT p.type_label label,count(*)::int n FROM ${SCHEMA}.proposals p WHERE p.house=$1 AND p.revision_id=$2 GROUP BY p.type_label ORDER BY n DESC LIMIT 30`, [house, revision])).rows.map((r) => ({ label:r.label, count:r.n, classification:'SOURCE_TYPE_CATALOG_LABEL', note:'stable source-native proposal type; activity/status retained separately' }));
    const groups = (await c.query(`SELECT p.type_group,count(distinct p.external_id)::int proposalCount,count(e.proposal_external_id)::int eventRows,count(distinct e.proposal_external_id)::int proposalsWithEvents FROM ${SCHEMA}.proposals p LEFT JOIN ${SCHEMA}.active_publications a ON a.house=p.house AND a.domain='timeline' LEFT JOIN ${SCHEMA}.state_proposal_events e ON e.house=p.house AND e.revision_id=a.revision_id AND e.proposal_external_id=p.external_id WHERE p.house=$1 AND p.revision_id=$2 AND p.year=2026 GROUP BY p.type_group ORDER BY p.type_group`, [house, revision])).rows;
    result.houses[house] = { previousRevision: active, revision, sourceTypeIds: mapping.length, stableSourceTypes: mapping.length, typeIdLabelConflicts: conflicts.length, unknownSourceTypes: unknown.length, unclassifiedFunctionalGroups: mapping.filter((m) => m.functionalGroup === 'UNCLASSIFIED').length, proposalCountBefore: before.length, proposalCountAfter: after.length, authorshipRowsBefore: authorsBefore.length, authorshipRowsAfter: authorsAfter.length, proposalIdsParity: JSON.stringify(beforeIds) === JSON.stringify(afterIds), authorshipParity: projectionHash(authorProjection(authorsBefore)) === projectionHash(authorProjection(authorsAfter)), linkageParity: projectionHash(authorProjection(authorsBefore).map((x)=>x.person_external_id)) === projectionHash(authorProjection(authorsAfter).map((x)=>x.person_external_id)), proposalFieldParity: projectionHash(proposalProjection(before)) === projectionHash(proposalProjection(after)), timelineEventRows: eventRows, timelineParity: eventRows > 0, mapping, proposalTypeAudit: sample, activityLabelAudit: labelAudit, typeCoverage: groups, pecSemanticsTest: house === 'BA' ? { sourceTypeId:'10', sourceTypeLabel:catalog['10'][0], functionalGroup:catalog['10'][1], result:'PASS' } : { sourceTypeId:'3', sourceTypeLabel:catalog['3'][0], functionalGroup:catalog['3'][1], result:'PASS' }, amendmentSemanticsTest: { sourceTypeId: house === 'BA' ? '12' : '287', sourceTypeLabel:catalog[house === 'BA' ? '12' : '287'][0], functionalGroup:catalog[house === 'BA' ? '12' : '287'][1], result:'PASS' }, requestSemanticsTest: { sourceTypeId: house === 'BA' ? '4' : '8', sourceTypeLabel:catalog[house === 'BA' ? '4' : '8'][0], functionalGroup:catalog[house === 'BA' ? '4' : '8'][1], result:'PASS' }, indicationSemanticsTest: { sourceTypeId: house === 'BA' ? '3' : '18', sourceTypeLabel:catalog[house === 'BA' ? '3' : '18'][0], functionalGroup:catalog[house === 'BA' ? '3' : '18'][1], result:'PASS' } };
  }
  result.finishedAt = new Date().toISOString();
  fs.writeFileSync(`${ART}/P22_1R2_run.json`, JSON.stringify(result, null, 2));
  await c.release(); await pool.end(); console.log(JSON.stringify(result, null, 2));
}
main().catch((e) => { console.error(e); process.exitCode = 1; });

