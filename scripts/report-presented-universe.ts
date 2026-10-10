import fs from 'node:fs';
import pg from 'pg';
import { actorKindFromCamaraTipoAutor, actorKindFromSenadoSiglaTipo, classifyAuthorship, type AuthorshipClass } from '../packages/domain/src/authorship.ts';

/**
 * Números do universo apresentado em 2026 no catálogo (somente leitura): por presentedYear × identifierYear, grupo, sigla, mês,
 * e autoria por classe (A1, A2, A3, D, F) com os 20 primeiros de cada classe. Nunca soma classes entre si.
 */
const pool = new pg.Pool({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT), database: process.env.DB_NAME, user: process.env.DB_USER, password: process.env.DB_PASSWORD });
const ACTIVE = `JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id`;
const q = async (sql: string, values: unknown[] = []) => (await pool.query(sql, values)).rows;
const out: Record<string, any> = {};
try {
  out.totals = await q(`SELECT p.source,count(*) FILTER (WHERE p.presented_year=2026)::int presented_2026,count(*) FILTER (WHERE p.year=2026)::int identifier_2026,count(*) FILTER (WHERE p.year=2026 AND p.presented_year=2026)::int both_,count(*) FILTER (WHERE p.year IS NULL AND p.presented_year=2026)::int identifier_null_presented_2026,count(*) FILTER (WHERE p.year<2026 AND p.presented_year=2026)::int identifier_before_presented_2026,count(*)::int catalog FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1 ORDER BY 1`);
  out.byGroup = await q(`SELECT p.source,p.functional_group g,count(*) FILTER (WHERE p.presented_year=2026)::int presented_2026,count(*) FILTER (WHERE p.year=2026)::int identifier_2026 FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1,2 ORDER BY 1,3 DESC`);
  out.byType = await q(`SELECT p.source,p.type,count(*) FILTER (WHERE p.presented_year=2026)::int presented_2026,count(*) FILTER (WHERE p.year=2026)::int identifier_2026 FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1,2 HAVING count(*) FILTER (WHERE p.presented_year=2026)>=150 ORDER BY 1,3 DESC`);
  out.byMonth = await q(`SELECT p.source,to_char(p.presented_at AT TIME ZONE 'America/Sao_Paulo','MM') m,count(*)::int presented_2026,count(*) FILTER (WHERE p.year=2026)::int also_identifier_2026 FROM civica_poc.proposals p ${ACTIVE} WHERE p.presented_year=2026 GROUP BY 1,2 ORDER BY 1,2`);
  out.lag = await q(`SELECT p.source,CASE WHEN p.year IS NULL THEN 'sem_ano' WHEN 2026-p.year<0 THEN 'negativo' WHEN 2026-p.year>=10 THEN '10+' WHEN 2026-p.year>=5 THEN '5-9' ELSE (2026-p.year)::text END lag,count(*)::int n FROM civica_poc.proposals p ${ACTIVE} WHERE p.presented_year=2026 GROUP BY 1,2 ORDER BY 1,2`);
  out.lagByGroup = await q(`SELECT p.source,p.functional_group g,count(*) FILTER (WHERE p.year IS NULL)::int sem_ano,count(*) FILTER (WHERE p.year=2026)::int lag0,count(*) FILTER (WHERE p.year<2026)::int lag_pos,count(*) FILTER (WHERE p.year>2026)::int lag_neg,max(2026-p.year)::int max_lag FROM civica_poc.proposals p ${ACTIVE} WHERE p.presented_year=2026 GROUP BY 1,2 ORDER BY 1,2`);
  out.duplicates = await q(`SELECT p.source,count(*)::int rows,count(DISTINCT p.external_id)::int distinct_ids FROM civica_poc.proposals p ${ACTIVE} GROUP BY 1`);

  // autoria por classe (universo apresentado em 2026)
  const rows = await q(`SELECT p.source,p.external_id id,p.type,a.person_external_id person,a.name,a.party,a.author_kind kind,a.proponent FROM civica_poc.proposal_authors a JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id ${ACTIVE} WHERE p.presented_year=2026`);
  const classes: Record<string, number> = {}, tops: Record<string, Map<string, { name: string; party: string | null; ids: Set<string> }>> = {};
  let unknownKind = 0;
  for (const r of rows) {
    const actor = r.source === 'camara' ? actorKindFromCamaraTipoAutor(r.kind) : actorKindFromSenadoSiglaTipo(r.kind);
    if (!r.kind) unknownKind++;
    const c = classifyAuthorship({ house: r.source, type: r.type, actor, proponent: r.proponent });
    const code = c.code === 'F' ? (c.role === 'procedural_act' ? 'F_proc' : 'F_ambiguo') : c.code;
    classes[`${r.source}|${code}`] = (classes[`${r.source}|${code}`] ?? 0) + 1;
    if (['A1', 'A2', 'A3', 'D', 'F_proc'].includes(code) && actor === 'parliamentarian' && (r.source === 'camara' || r.kind === 'SENADOR')) {
      const key = `${r.source}|${code}`; const map = (tops[key] ??= new Map());
      const who = String(r.name).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim(); const entry = map.get(who) ?? { name: r.name, party: r.party, ids: new Set<string>() }; entry.ids.add(r.id); map.set(who, entry);
    }
  }
  out.authorship = { links: rows.length, linksWithoutKind: unknownKind, classes, top20: Object.fromEntries(Object.entries(tops).map(([k, m]) => [k, [...m.values()].map(e => [e.name, e.party, e.ids.size]).sort((a: any, b: any) => b[2] - a[2]).slice(0, 20)])) };
  fs.writeFileSync(`${process.env.AUDIT_SCRATCH}/report_universe.json`, JSON.stringify(out));
  console.log(JSON.stringify({ totals: out.totals, authorship: { links: rows.length, linksWithoutKind: unknownKind, classes } }));
} finally { await pool.end(); }
