import type { DatabaseSync } from 'node:sqlite';
import { failRun, startRun, transaction } from '@senadotracker/db';
import { normalizeSupplierIdentifier } from '@senadotracker/domain';
import { InstitutionalHttp } from './institutional-http.ts';
import { requireArray, requireRecord } from './institutional-normalize.ts';
import { checkpoint, emptyInstitutionalMetrics, finishInstitutionalMetrics, startInstitutionalMetrics } from './institutional-run.ts';
import { persistInstitutionalRaw, stageInstitutionalSourceRecord } from './institutional-storage.ts';

const api = 'https://pncp.gov.br/api/consulta/v1';
const houses = [{ institution: 'CAMARA', cnpj: '00530352000159' }, { institution: 'SENADO', cnpj: '00530279000115' }] as const;
const digits = (value: unknown) => String(value ?? '').replace(/\D/g, '').replace(/^0+/, '') || '0';
const field = (row: Record<string, unknown>, key: string) => row[key] == null ? null : String(row[key]).trim() || null;
export interface PncpOptions { from: string; to: string; rawDirectory: string; limit?: number|null; dryRun?: boolean; http?: InstitutionalHttp; progress?: (message: string) => void }

/** Descoberta não bloqueante. Só vincula quando Casa, ano, número e fornecedor forte formam um único contrato local. */
export async function collectPncpEnrichment(db: DatabaseSync, options: PncpOptions) {
  const results: unknown[] = [], http = options.http ?? new InstitutionalHttp({ delayMs: 180, maxAttempts: 4 });
  for (const house of houses) {
    const runId = startRun(db, house.institution === 'CAMARA' ? 'camara' : 'senado'), collector = 'pncp-enrichment', scope = `${house.institution.toLowerCase()}:${options.from}:${options.to}`, metrics = emptyInstitutionalMetrics();
    startInstitutionalMetrics(db, runId, collector, scope); checkpoint(db, collector, scope, { status: 'running' });
    try {
      const rows: Record<string, unknown>[] = [], pages: { rows: Record<string,unknown>[]; rawId: string; fetchedAt: string }[] = [];
      let page = 1, totalPages = 1;
      do {
        const query = new URLSearchParams({ dataInicial: options.from.replaceAll('-', ''), dataFinal: options.to.replaceAll('-', ''), cnpjOrgao: house.cnpj, pagina: String(page), tamanhoPagina: '500' });
        const response = await http.bytes(`${api}/contratos/atualizacao?${query}`), raw = persistInstitutionalRaw(db, runId, options.rawDirectory, response), payload = requireRecord(JSON.parse(new TextDecoder().decode(response.bytes)), 'página PNCP'), current = requireArray(payload.data, 'dados PNCP').map(value => requireRecord(value, 'contrato PNCP'));
        metrics.requests++; metrics.bytes += response.bytes.length; rows.push(...current); pages.push({ rows: current, rawId: raw.rawId, fetchedAt: response.fetchedAt }); totalPages = Math.max(1, Number(payload.totalPaginas ?? 1)); page++;
        if (options.limit && rows.length >= options.limit) break;
      } while (page <= totalPages);
      const selected = options.limit ? rows.slice(0, options.limit) : rows; metrics.recordsFetched = selected.length;
      const matches = selected.map(pncp => {
        const supplier = normalizeSupplierIdentifier(field(pncp, 'niFornecedor') ?? '');
        if (supplier.validationStatus !== 'valid') return { pncp, local: [] as Record<string,unknown>[] };
        const pncpNumber = String(pncp.numeroContratoEmpenho ?? '').split('/')[0];
        const local = db.prepare(`SELECT DISTINCT c.id,c.source_contract_id,c.contract_number FROM institutional_contracts c JOIN supplier_identifiers i ON i.supplier_id=c.supplier_id WHERE c.institution=? AND c.contract_year=? AND i.identifier_type=? AND i.normalized_value=? AND i.validation_status='valid'`).all(house.institution, Number(pncp.anoContrato), supplier.type, supplier.normalizedValue).filter(contract => digits((contract as Record<string,unknown>).contract_number) === digits(pncpNumber));
        return { pncp, local };
      });
      if (options.dryRun) { failRun(db, runId, 'dry-run'); finishInstitutionalMetrics(db, runId, collector, scope, metrics, 'complete'); checkpoint(db, collector, scope, { status: 'pending', metadata: { dryRun: true, records: selected.length } }); results.push({ institution: house.institution, dryRun: true, records: selected.length }); continue; }
      transaction(db, () => {
        const now = new Date().toISOString(); db.prepare('INSERT INTO institutional_collection_batches VALUES (?,?,?,?,?,?,?,?,?,?)').run(runId, house.institution, 'pncp', 'contract_enrichment', options.from, options.to, now, 'available', selected.length, JSON.stringify(metrics));
        let offset = 0;
        for (const pageInfo of pages) for (const pncp of pageInfo.rows) { if (offset++ >= selected.length) break; const control = field(pncp, 'numeroControlePNCP') ?? `${house.cnpj}:${field(pncp,'anoContrato')}:${field(pncp,'sequencialContrato')}`; stageInstitutionalSourceRecord(db, { batchId: runId, sourceSystem: 'pncp', entityType: 'contract_enrichment', externalKey: control, payload: pncp, sourceUpdatedAt: field(pncp, 'dataAtualizacaoGlobal') ?? field(pncp, 'dataAtualizacao'), fetchedAt: pageInfo.fetchedAt, rawId: pageInfo.rawId }); }
        for (const match of matches) if (match.local.length === 1) { db.prepare('UPDATE institutional_contracts SET pncp_control_number=? WHERE id=? AND pncp_control_number IS NULL').run(field(match.pncp, 'numeroControlePNCP'), String(match.local[0]!.id)); metrics.recordsUpdated++; } else if (match.local.length > 1) metrics.valueConflicts++;
        db.prepare(`INSERT INTO active_institutional_publications VALUES (?,'pncp','contract_enrichment',?) ON CONFLICT(institution,source_system,dataset) DO UPDATE SET batch_id=excluded.batch_id`).run(house.institution, runId);
        db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now, selected.length, JSON.stringify(metrics), runId); db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
      });
      finishInstitutionalMetrics(db, runId, collector, scope, metrics, 'complete'); checkpoint(db, collector, scope, { status: 'complete', metadata: { records: selected.length, matched: metrics.recordsUpdated, conflicts: metrics.valueConflicts } }); results.push({ institution: house.institution, runId, records: selected.length, matched: metrics.recordsUpdated, conflicts: metrics.valueConflicts }); options.progress?.(`${house.institution}: ${selected.length} contratos PNCP; ${metrics.recordsUpdated} vínculos inequívocos`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error); try { finishInstitutionalMetrics(db, runId, collector, scope, metrics, 'failed', message); } catch {} failRun(db, runId, message); checkpoint(db, collector, scope, { status: 'pending', error: message, metadata: { nonBlocking: true } }); results.push({ institution: house.institution, pending: true, error: message });
    }
  }
  return { nonBlocking: true, results };
}
