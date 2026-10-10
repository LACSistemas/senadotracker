import fs from 'node:fs';
import pg from 'pg';
import { proposalFunctionalGroup } from '../packages/domain/src/index.ts';

/**
 * Cobertura de `presented_at` em 2026: compara o catálogo ativo com a lista oficial de entidades apresentadas em 2026
 * (Câmara: /proposicoes?dataApresentacaoInicio/Fim; Senado: materia/pesquisa/lista). Somente leitura; arquivos de entrada em SCRATCH.
 */
const SCRATCH = process.env.AUDIT_SCRATCH!;
const read = (name: string) => JSON.parse(fs.readFileSync(`${SCRATCH}/${name}`, 'utf8'));
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const dist = <T,>(items: T[], key: (x: T) => string | number) => { const m: Record<string, number> = {}; for (const x of items) { const k = String(key(x)); m[k] = (m[k] ?? 0) + 1; } return m; };
const lagBucket = (lag: number | null) => lag === null ? 'sem_ano' : lag < 0 ? 'negativo' : lag >= 10 ? '10+' : lag >= 5 ? '5-9' : String(lag);
try {
  const catalog = (await pool.query(`SELECT p.source,p.external_id id,p.type,p.year,extract(year from p.presented_at at time zone 'America/Sao_Paulo')::int py,to_char(p.presented_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') pday FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id`)).rows;
  const support = (await pool.query(`SELECT source,external_id id,type,year,to_char(presented_at at time zone 'America/Sao_Paulo','YYYY-MM-DD') pday FROM civica_poc.proposal_support WHERE extract(year from presented_at at time zone 'America/Sao_Paulo')=2026`)).rows;
  const out: Record<string, any> = {};

  // ---------------- Câmara
  const camApi = read('camara_B_api.json'); const api: any[] = camApi.items; const apiIds = new Set<string>(api.map(x => x.id));
  const cam = catalog.filter(r => r.source === 'camara'); const camIds = new Set<string>(cam.map(r => String(r.id)));
  const localB = cam.filter(r => r.py === 2026); const localBIds = new Set<string>(localB.map(r => String(r.id)));
  const missing = api.filter(x => !camIds.has(x.id));
  const extra = localB.filter(r => !apiIds.has(String(r.id)));
  const missingInSupport = missing.filter(x => support.some(s => s.source === 'camara' && String(s.id) === x.id)).length;
  const grp = (t: string) => proposalFunctionalGroup(t);
  const lag = (x: any) => x.a ? 2026 - x.a : null;
  out.camara = {
    perMonthApi: camApi.perMonth, apiTotal: api.length, catalogTotal: cam.length, localB: localB.length,
    inApiAndCatalog: api.length - missing.length, missingFromCatalog: missing.length, localBNotInApi: extra.length,
    missingInSupportTable: missingInSupport, supportPresented2026: support.filter(s => s.source === 'camara').length,
    missingByType: dist(missing, x => x.t), missingByGroup: dist(missing, x => grp(x.t)), missingByMonth: dist(missing, x => x.m),
    missingByIdentifierYear: dist(missing, x => x.a ?? 'sem_ano'), missingLag: dist(missing, x => lagBucket(lag(x))),
    missingMaxLag: Math.max(...missing.filter(x => x.a).map(x => 2026 - x.a)), missingOldest: missing.filter(x => x.a).sort((p, q) => p.a - q.a).slice(0, 5),
    missingExamples: missing.slice(0, 0),
    apiLagAll: dist(api, x => lagBucket(lag(x))), apiLagByGroup: Object.fromEntries(Object.entries(dist(api, x => grp(x.t) + '|' + lagBucket(lag(x)))).sort()),
    apiLagByType: Object.entries(dist(api, x => x.t + '|' + lagBucket(lag(x)))).filter(([k]) => !k.endsWith('|0') && !k.endsWith('|sem_ano')).sort((a, b) => b[1] - a[1]).slice(0, 25),
    apiByGroup: dist(api, x => grp(x.t)), apiByMonth: dist(api, x => x.m), apiByType: Object.entries(dist(api, x => x.t)).sort((a, b) => b[1] - a[1]).slice(0, 30),
    extraSample: extra.slice(0, 8).map(r => [r.id, r.type, r.year, r.pday]),
    extraByDay: Object.entries(dist(extra, r => r.pday)).sort((a, b) => b[1] - a[1]).slice(0, 6),
    extraByType: dist(extra, r => r.type),
  };
  out.camaraMissingList = missing.map(x => [x.id, x.t, x.n, x.a, x.m]);

  // ---------------- Senado
  const senApi = read('senado_B_api.json'); const sapi: any[] = senApi.items; const sapiIds = new Set<string>(sapi.map(x => x.id));
  const sen = catalog.filter(r => r.source === 'senado'); const senIds = new Set<string>(sen.map(r => String(r.id)));
  const sLocalB = sen.filter(r => r.py === 2026); const sMissing = sapi.filter(x => !senIds.has(x.id)); const sExtra = sLocalB.filter(r => !sapiIds.has(String(r.id)));
  const slag = (x: any) => x.a ? 2026 - x.a : null;
  out.senado = {
    perMonthApi: senApi.perMonth, apiTotal: sapi.length, catalogTotal: sen.length, localB: sLocalB.length, inApiAndCatalog: sapi.length - sMissing.length,
    missingFromCatalog: sMissing.length, localBNotInApi: sExtra.length, apiLagAll: dist(sapi, x => lagBucket(slag(x))),
    apiByType: Object.entries(dist(sapi, x => x.t)).sort((a, b) => b[1] - a[1]).slice(0, 20), apiByGroup: dist(sapi, x => grp(x.t)),
    missingByType: Object.entries(dist(sMissing, x => x.t)).sort((a, b) => b[1] - a[1]).slice(0, 15), missingByGroup: dist(sMissing, x => grp(x.t)),
    missingLag: dist(sMissing, x => lagBucket(slag(x))), missingByMonth: dist(sMissing, x => String(x.data).slice(5, 7)),
    missingByAuthorKind: dist(sMissing, x => !x.autor ? 'sem_autor' : /^Senador|^Senadora/.test(x.autor) ? 'senador(a)' : /Deputad/.test(x.autor) ? 'deputado(a)' : /Comiss|CCJ|CAE|CAS|CE |CDH|CRE|CI /.test(x.autor) ? 'comissão/órgão' : 'outro'),
    missingCommittee: sMissing.filter(x => x.com).length, missingMaxLag: Math.max(...sMissing.filter(x => x.a).map(x => 2026 - x.a)),
    missingAuthorSample: Object.entries(dist(sMissing, x => String(x.autor).slice(0, 60))).sort((a, b) => b[1] - a[1]).slice(0, 12),
    extraSample: sExtra.slice(0, 5).map(r => [r.id, r.type, r.year, r.pday]),
    dateMismatch: sapi.filter(x => senIds.has(x.id)).filter(x => { const c = sen.find(r => String(r.id) === x.id)!; return c.pday !== String(x.data).slice(0, 10); }).length,
  };
  out.senadoMissingList = sMissing.map(x => [x.id, x.t, x.n, x.a, String(x.data).slice(0, 10), x.autor]);
  fs.writeFileSync(`${SCRATCH}/coverage.json`, JSON.stringify(out));
  const { camaraMissingList, senadoMissingList, ...short } = out;
  console.log(JSON.stringify(short));
} finally { await pool.end(); }
