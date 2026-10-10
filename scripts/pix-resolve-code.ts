import { OfficialHttp } from '../apps/collector/src/http.ts';
import { PostgresCollectorStore } from '../apps/collector/src/postgres-collector.ts';
import { chamberNext, parseChamberHistory } from '../apps/collector/src/parsers/camara.ts';
import { deriveChamberExercises, loadCodeInputs, persistCrosswalk, persistHistoricalRoster, planIdentity, type HistoricalPerson } from '../apps/collector/src/postgres-pix-identity.ts';
import type { Profile } from '../packages/domain/src/index.ts';

/**
 * Re-resolve UM código SIOP cujo deputado teve o histórico indisponível (API da Câmara intermitente).
 * Uso: pix-resolve-code.ts <author_code> <deputado_id> [tentativas]. Roster de apoio = lote histórico já persistido + o deputado recém-buscado.
 * Se o histórico continuar vazio, nada é gravado (o CONFLICT existente permanece).
 */
const [code, deputyId, attemptsArg] = process.argv.slice(2);
if (!code || !deputyId) throw new Error('uso: pix-resolve-code.ts <author_code> <deputado_id> [tentativas]');
const store = new PostgresCollectorStore(); await store.assertTarget();
try {
  let runId = '';
  runId = await store.startRun('camara', `pg:pix-roster-fetch:camara:${Date.now()}`);
  // a API da Câmara devolve `dados: []` para alguns ids quando a requisição pede Accept: application/json; com Accept */* responde.
  const noAccept: typeof fetch = (input, init) => { const headers = new Headers(init?.headers); headers.set('Accept', '*/*'); return fetch(input, { ...init, headers }); };
  const http = new OfficialHttp({ source: 'camara', save: raw => store.saveRaw(runId, raw), delayMs: 300, maxAttempts: 4, fetch: noAccept });
  let history = await http.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputyId}/historico`);
  const rowsOf = (h: typeof history) => ((h.data as any).dados ?? []) as any[];
  for (let attempt = 1; attempt < Number(attemptsArg ?? 20) && !rowsOf(history).length; attempt++) { await new Promise(r => setTimeout(r, 3000)); history = await http.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputyId}/historico`); }
  const rows = rowsOf(history);
  if (!rows.length) { console.log(JSON.stringify({ code, deputyId, result: 'historico_vazio', action: 'nada gravado; CONFLICT mantido' })); process.exitCode = 0; }
  else {
    void chamberNext;
    const detail = await http.json(`https://dadosabertos.camara.leg.br/api/v2/deputados/${deputyId}`);
    const d = ((detail.data as any).dados ?? {}) as any, last = d.ultimoStatus ?? {};
    const parsed = parseChamberHistory(history, deputyId);
    const fresh: HistoricalPerson = { house: 'camara', externalId: deputyId, civilName: d.nomeCivil ?? null, names: [...new Set([last.nome, last.nomeEleitoral, d.nomeCivil, ...rows.flatMap(r => [r.nome, r.nomeEleitoral])].filter(Boolean).map(String))],
      profile: { source: 'camara', externalId: deputyId, name: String(last.nome), fullName: d.nomeCivil ?? null, uf: String(last.siglaUf ?? ''), party: String(last.siglaPartido ?? ''), photoUrl: null, officialUrl: `https://www.camara.leg.br/deputados/${deputyId}`, observedAt: history.fetchedAt, rawId: history.rawId, historyAvailability: 'available',
        mandates: parsed.mandates, exercises: deriveChamberExercises(parsed.events, history.rawId, deputyId), parties: parsed.parties, events: parsed.events } as Profile };
    const persisted = (await store.query(`SELECT payload->>'source' source, external_id, payload FROM civica.profiles WHERE batch_id LIKE 'pg:roster-historical:%'`)).rows
      .filter(r => !(r.source === 'camara' && r.external_id === deputyId)).map(r => r.payload as Profile)
      .map<HistoricalPerson>(p => ({ house: p.source as 'camara' | 'senado', externalId: p.externalId, civilName: p.fullName, names: [p.name, p.fullName].filter(Boolean) as string[], profile: p }));
    const people = [...persisted, fresh];
    const inputs = (await loadCodeInputs(store.pool)).filter(i => i.authorCode === code);
    const plan = planIdentity(inputs, people);
    const resolution = plan.resolutions[0]!.resolution;
    const written = await store.transaction(async client => {
      if (resolution.cls !== 'EXACT' && resolution.cls !== 'HIGH') return null;
      const p = await persistHistoricalRoster(client, people.filter(x => x.house === 'camara' && x.externalId === deputyId), plan.persistKeys);
      return await persistCrosswalk(client, plan, people, p.personIdByRecord);
    });
    console.log(JSON.stringify({ code, deputyId, historyRows: rows.length, exercises: fresh.profile.exercises, resolution: { cls: resolution.cls, reason: resolution.reason, method: resolution.method, byYear: resolution.byYear, candidates: resolution.candidates }, written }, null, 1));
  }
  await store.query(`UPDATE civica.ingestion_runs SET status='published', finished_at=$1, roster_complete=1 WHERE id=$2`, [new Date().toISOString(), runId]);
} finally { await store.pool.end(); }
