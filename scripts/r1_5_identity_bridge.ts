import pg from 'pg';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

type Json = Record<string, any>;
const env = Object.fromEntries((await readFile('.env', 'utf8')).split(/\r?\n/).filter(x => x.includes('=')).map(x => { const i = x.indexOf('='); return [x.slice(0, i), x.slice(i + 1).trim()]; }));
const pool = new pg.Pool({ host: env.DB_HOST, port: Number(env.DB_PORT), database: env.DB_NAME, user: env.DB_USER, password: env.DB_PASSWORD });
const q = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows as any[];
const text = (v: unknown) => String(v ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
const number = (v: unknown) => { const m = text(v).replace(/^0+/, '').match(/^\d+$/); return m ? m[0] : null; };
const key = (type: unknown, numberValue: unknown, year: unknown) => { const n = number(numberValue); const y = number(year); return n && y ? `senado|${text(type).toUpperCase()}|${n}|${y}` : null; };
const labelKey = (label: unknown) => { const m = text(label).toUpperCase().match(/^([A-Z][A-Z0-9]*)\s+(\d+)\s*\/\s*(\d{4})/); return m ? key(m[1], m[2], m[3]) : null; };
const fullLabel = (label: unknown) => text(label).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
const hash = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

const officialRoot = JSON.parse(await readFile('data/cache/senate-active-matters.json', 'utf8')) as Json;
const sourceUrl = 'https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?tramitando=S';
const officialRows = ((officialRoot.PesquisaBasicaMateria?.Materias?.Materia ?? []) as Json[]).map((x, index) => ({
  row: index,
  codigoMateria: text(x.Codigo) || null,
  identificacaoProcesso: text(x.IdentificacaoProcesso) || null,
  sigla: text(x.Sigla) || null,
  numero: text(x.Numero) || null,
  ano: text(x.Ano) || null,
  numeroMateria: text(x.NumeroMateria) || null,
  anoMateria: text(x.AnoMateria) || null,
  descricaoIdentificacao: text(x.DescricaoIdentificacao) || null,
  ementa: text(x.Ementa) || null,
  url: text(x.UrlDetalheMateria) || null,
  data: text(x.Data) || null,
  casa: 'senado',
}));
const officialFields = ['codigoMateria', 'identificacaoProcesso', 'sigla', 'numero', 'ano', 'numeroMateria', 'anoMateria', 'descricaoIdentificacao', 'ementa', 'url', 'data'];
const officialIdentifierStats = Object.fromEntries(officialFields.map(field => {
  const values = officialRows.map(x => x[field as keyof typeof x]).filter(Boolean) as string[];
  const counts = new Map(values.map(v => [v, 0]));
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [field, { rows: officialRows.length, nulls: officialRows.length - values.length, nullRate: (officialRows.length - values.length) / Math.max(officialRows.length, 1), distinct: new Set(values).size, duplicateValues: [...counts.values()].filter(n => n > 1).length, maxMultiplicity: Math.max(0, ...counts.values()) }];
}));
const officialKeys = new Map<string, Json[]>();
for (const x of officialRows) { const k = key(x.sigla, x.numero, x.ano); if (k) officialKeys.set(k, [...(officialKeys.get(k) ?? []), x]); }

const pgRows = await q(`SELECT p.external_id,p.source,p.type,p.number::text number,p.year,p.label,p.summary,NULL::text AS official_url,p.principal_id,p.payload,p.raw_id,p.batch_id
  FROM civica_poc.proposals p JOIN civica_poc.active_publications a ON a.source=p.source AND a.batch_id=p.batch_id WHERE p.source='senado' ORDER BY p.external_id`);
const pgById = new Map(pgRows.map(x => [text(x.external_id), x]));
const pgByKey = new Map<string, Json[]>();
const pgByLabel = new Map<string, Json[]>();
for (const x of pgRows) { const k = key(x.type, x.number, x.year); if (k) pgByKey.set(k, [...(pgByKey.get(k) ?? []), x]); }
for (const x of pgRows) { const k = fullLabel(x.label); if (k) pgByLabel.set(k, [...(pgByLabel.get(k) ?? []), x]); }
const bridge: Json[] = [];
const ambiguous: Json[] = [];
const unmatched: Json[] = [];
const levels = { A: 0, B: 0, C: 0, D: 0 };
for (const official of officialRows) {
  const a = official.codigoMateria ? pgById.get(official.codigoMateria) : undefined;
  if (a) { levels.A++; bridge.push({ official, pg: a, level: 'A', evidence: 'official numeric id == PG external_id', confidence: 'high' }); continue; }
  const bKey = key(official.sigla, official.numero, official.ano);
  const b = bKey ? (pgByKey.get(bKey) ?? []) : [];
  if (b.length === 1) { levels.B++; bridge.push({ official, pg: b[0], level: 'B', evidence: bKey, confidence: 'high' }); continue; }
  if (b.length > 1) {
    const exactLabel = b.filter(x => fullLabel(x.label) === fullLabel(official.descricaoIdentificacao));
    if (exactLabel.length === 1) { levels.B++; bridge.push({ official, pg: exactLabel[0], level: 'B', evidence: `${bKey}; exact normalized official label`, confidence: 'high' }); continue; }
    unmatched.push({ official, candidateKey: bKey, reason: 'canonical key collides in PG but no candidate has the exact official label', candidates: b.map(x => ({ external_id: x.external_id, label: x.label, batch_id: x.batch_id })) }); continue;
  }
  const cKey = labelKey(official.descricaoIdentificacao);
  const c = cKey ? (pgByKey.get(cKey) ?? []) : [];
  if (c.length === 1) { levels.C++; bridge.push({ official, pg: c[0], level: 'C', evidence: cKey, confidence: 'medium' }); continue; }
  if (c.length > 1) { unmatched.push({ official, candidateKey: cKey, reason: 'canonical key collides in PG but no candidate has the exact official label', candidates: c.map(x => ({ external_id: x.external_id, label: x.label, batch_id: x.batch_id })) }); continue; }
  const labelCandidates = pgByLabel.get(fullLabel(official.descricaoIdentificacao)) ?? [];
  if (labelCandidates.length === 1) { levels.C++; bridge.push({ official, pg: labelCandidates[0], level: 'C', evidence: 'exact normalized official label', confidence: 'medium' }); continue; }
  if (labelCandidates.length > 1) { ambiguous.push({ official, candidates: labelCandidates.map(x => ({ external_id: x.external_id, label: x.label, batch_id: x.batch_id })), level: 'C', key: fullLabel(official.descricaoIdentificacao) }); continue; }
  unmatched.push({ official, candidateKey: bKey ?? cKey, reason: 'no exact official ID or unique canonical key in active PG proposals' });
}

const officialInventory = { source: 'senado', sourceUrl: 'https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?tramitando=S', observedFrom: 'data/cache/senate-active-matters.json', official_rows: officialRows.length, distinct_identifiers: Object.fromEntries(officialFields.map(f => [f, new Set(officialRows.map(x => x[f as keyof typeof x]).filter(Boolean)).size])), identifier_null_rates: officialIdentifierStats, duplicate_identifier_rates: Object.fromEntries(officialFields.map(f => [f, officialIdentifierStats[f]!.duplicateValues / Math.max(officialIdentifierStats[f]!.distinct, 1)])), candidate_keys: { canonicalTypeNumberYear: { rows: [...officialKeys.values()].flat().length, distinct: officialKeys.size, duplicateKeys: [...officialKeys.values()].filter(x => x.length > 1).length }, officialNumericId: { distinct: new Set(officialRows.map(x => x.codigoMateria).filter(Boolean)).size } }, sample: officialRows.slice(0, 5), fingerprint: hash(officialRows) };
const pgIdentityInventory = { source: 'senado', active_rows: pgRows.length, columns: ['external_id', 'source', 'type', 'number', 'year', 'label', 'summary', 'official_url', 'principal_id', 'payload', 'raw_id', 'batch_id'], distinct_identifiers: { external_id: new Set(pgRows.map(x => x.external_id).filter(Boolean)).size, canonicalTypeNumberYear: pgByKey.size }, null_rates: Object.fromEntries(['external_id', 'type', 'number', 'year', 'label', 'official_url', 'principal_id', 'payload', 'raw_id'].map(f => [f, pgRows.filter(x => x[f] == null || x[f] === '').length / Math.max(pgRows.length, 1)])), duplicate_keys: { external_id: pgRows.length - new Set(pgRows.map(x => x.external_id)).size, canonicalTypeNumberYear: [...pgByKey.values()].filter(x => x.length > 1).length }, payload_identifier_presence: Object.fromEntries(['codigoMateria', 'IdentificacaoProcesso', 'sigla', 'numero', 'ano', 'officialId', 'official_id', 'url'].map(f => [f, pgRows.filter(x => x.payload && x.payload[f] != null).length])), sample: pgRows.slice(0, 5).map(x => ({ external_id: x.external_id, type: x.type, number: x.number, year: x.year, label: x.label, official_url: x.official_url, principal_id: x.principal_id, payload: x.payload, raw_id: x.raw_id, batch_id: x.batch_id })), fingerprint: hash(pgRows.map(x => ({ external_id: x.external_id, type: x.type, number: x.number, year: x.year, label: x.label, official_url: x.official_url, principal_id: x.principal_id, payload: x.payload, raw_id: x.raw_id, batch_id: x.batch_id }))) };
const result = { totalOfficial: officialRows.length, matchLevelA: levels.A, matchLevelB: levels.B, matchLevelC: levels.C, matchLevelD: levels.D, matchedUnique: bridge.length, ambiguous: ambiguous.length, unmatched: unmatched.length, coverage: bridge.length / Math.max(officialRows.length, 1), bridge: bridge.slice(0, 25), ambiguousExamples: ambiguous.slice(0, 25), unmatchedExamples: unmatched.slice(0, 25), officialFingerprint: officialInventory.fingerprint, pgFingerprint: pgIdentityInventory.fingerprint };
await q(`CREATE TABLE IF NOT EXISTS civica_poc.proposal_identity_bridge (
  source text NOT NULL,
  official_matter_id text NOT NULL,
  official_process_id text,
  sigla text,
  matter_number text,
  matter_year integer,
  official_label text,
  official_summary text,
  official_url text,
  pg_proposal_id text,
  match_level text NOT NULL,
  match_status text NOT NULL,
  confidence text NOT NULL,
  evidence jsonb NOT NULL,
  source_url text NOT NULL,
  source_sha256 text NOT NULL,
  fetched_at timestamptz NOT NULL,
  PRIMARY KEY (source, official_matter_id)
)`);
const sourceSha = hash(officialRoot), fetchedAt = new Date().toISOString();
for (const item of officialRows) {
  const match = bridge.find(x => x.official.codigoMateria === item.codigoMateria);
  const amb = ambiguous.find(x => x.official.codigoMateria === item.codigoMateria);
  const pg = match?.pg ?? null;
  await q(`INSERT INTO civica_poc.proposal_identity_bridge(source,official_matter_id,official_process_id,sigla,matter_number,matter_year,official_label,official_summary,official_url,pg_proposal_id,match_level,match_status,confidence,evidence,source_url,source_sha256,fetched_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17)
    ON CONFLICT(source,official_matter_id) DO UPDATE SET official_process_id=excluded.official_process_id,sigla=excluded.sigla,matter_number=excluded.matter_number,matter_year=excluded.matter_year,official_label=excluded.official_label,official_summary=excluded.official_summary,official_url=excluded.official_url,pg_proposal_id=excluded.pg_proposal_id,match_level=excluded.match_level,match_status=excluded.match_status,confidence=excluded.confidence,evidence=excluded.evidence,source_sha256=excluded.source_sha256,fetched_at=excluded.fetched_at`, [
    'senado', item.codigoMateria, item.identificacaoProcesso, item.sigla, item.numero, Number(item.ano) || null, item.descricaoIdentificacao, item.ementa, item.url, pg?.external_id ?? null,
    match ? match.level : amb ? amb.level : 'NONE', match ? 'MATCHED' : amb ? 'AMBIGUOUS' : 'UNMATCHED', match?.confidence ?? (amb ? 'low' : 'none'), JSON.stringify(match ? { evidence: match.evidence } : amb ? { candidates: amb.candidates } : { reason: 'no canonical PG proposal' }), sourceUrl, sourceSha, fetchedAt,
  ]);
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/r1_5_senate_official_identity_inventory.json', JSON.stringify(officialInventory, null, 2));
await writeFile('artifacts/r1_5_pg_proposal_identity_inventory.json', JSON.stringify(pgIdentityInventory, null, 2));
await writeFile('artifacts/r1_5_identity_match.json', JSON.stringify(result, null, 2));
console.log(JSON.stringify({ ...result, officialIdentifierStats, pgRows: pgRows.length }, null, 2));
await pool.end();

