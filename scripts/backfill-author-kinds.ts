import fs from 'node:fs';
import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { OfficialHttp } from '../apps/collector/src/http.ts';
import { ensureTemporalSchema } from '../packages/db/src/postgres-temporal.ts';

/**
 * Preenche `proposal_authors.author_kind` / `proponent` (entrada de `classifyAuthorship`).
 *  1) Câmara, linhas existentes: arquivo oficial `proposicoesAutores-2026.json` (chave proposta + author_key = id do autor — ou o nome, quando o autor não tem URI (senadores) — : ordem de assinatura).
 *  2) Câmara, linhas sem correspondência no arquivo (entidades trazidas pela coleta por apresentação): `/proposicoes/{id}/autores`.
 * Idempotente: só preenche onde author_kind é NULL. Não altera nomes, partidos nem chaves.
 */
const FILE = process.env.CAMARA_AUTORES_FILE ?? 'data/research/camara-autores-2026.json';
const store = new PostgresCollectorStore();
try {
  await store.assertTarget(); await ensureTemporalSchema(store.pool);
  const batch = (await store.query<any>(`SELECT batch_id FROM civica_poc.active_publications WHERE source='camara'`)).rows[0].batch_id;
  const before = Number((await store.query<any>(`SELECT count(*)::int n FROM civica_poc.proposal_authors WHERE batch_id=$1 AND author_kind IS NULL`, [batch])).rows[0].n);
  const authors: any[] = JSON.parse(fs.readFileSync(FILE, 'utf8')).dados;
  const idOf = (uri: string) => /\/(\d+)\/?$/.exec(uri)?.[1] ?? '';
  let fromFile = 0;
  for (let i = 0; i < authors.length; i += 500) {
    const chunk = authors.slice(i, i + 500);
    const r = await store.query(`UPDATE civica_poc.proposal_authors a SET author_kind=v.kind, proponent=v.proponent
      FROM unnest($2::text[],$3::text[],$4::text[],$5::boolean[]) AS v(proposal_id,author_key,kind,proponent)
      WHERE a.batch_id=$1 AND a.proposal_id=v.proposal_id AND a.author_key=v.author_key AND a.author_kind IS NULL`,
      [batch, chunk.map(x => String(x.idProposicao)), chunk.map(x => `${idOf(String(x.uriAutor)) || x.nomeAutor}:${x.ordemAssinatura}`), chunk.map(x => x.tipoAutor ?? null), chunk.map(x => String(x.proponente) === '1')]);
    fromFile += r.rowCount ?? 0;
  }
  const pending = (await store.query<{ proposal_id: string }>(`SELECT proposal_id FROM civica_poc.proposal_authors WHERE batch_id=$1 AND author_kind IS NULL GROUP BY proposal_id ORDER BY proposal_id::bigint`, [batch])).rows.map(r => r.proposal_id);
  const runId = await store.startRun('camara', `pg:author-kinds:${Date.now()}`);
  const http = new OfficialHttp({ source: 'camara', save: raw => store.saveRaw(runId, raw), timeoutMs: 25_000, maxAttempts: 3, delayMs: 120 });
  let fromApi = 0, failed = 0, cursor = 0;
  const worker = async () => {
    while (cursor < pending.length) {
      const id = pending[cursor++]!;
      try {
        const response = await http.json(`https://dadosabertos.camara.leg.br/api/v2/proposicoes/${id}/autores`);
        for (const a of ((response.data as any).dados ?? []) as any[]) {
          const r = await store.query(`UPDATE civica_poc.proposal_authors SET author_kind=$4, proponent=$5 WHERE batch_id=$1 AND proposal_id=$2 AND author_key=$3 AND author_kind IS NULL`, [batch, id, `${idOf(String(a.uri)) || a.nome}:${a.ordemAssinatura}`, a.tipo ?? null, String(a.proponente) === '1']);
          fromApi += r.rowCount ?? 0;
        }
      } catch { failed++; }
    }
  };
  await Promise.all(Array.from({ length: 4 }, worker));
  await store.query(`UPDATE civica.ingestion_runs SET finished_at=$1,status='published',roster_complete=1 WHERE id=$2`, [new Date().toISOString(), runId]);
  const after = Number((await store.query<any>(`SELECT count(*)::int n FROM civica_poc.proposal_authors WHERE batch_id=$1 AND author_kind IS NULL`, [batch])).rows[0].n);
  const kinds = (await store.query<any>(`SELECT author_kind,proponent,count(*)::int n FROM civica_poc.proposal_authors WHERE batch_id=$1 GROUP BY 1,2 ORDER BY 3 DESC`, [batch])).rows;
  console.log(JSON.stringify({ nullBefore: before, filledFromFile: fromFile, entitiesFromApi: pending.length, filledFromApi: fromApi, failed, nullAfter: after, kinds }));
} finally { await store.pool.end(); }
