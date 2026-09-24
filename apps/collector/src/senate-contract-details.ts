import type { DatabaseSync } from 'node:sqlite';
import { failRun, resolveStrongSupplier, startRun, transaction } from '@senadotracker/db';
import { InstitutionalHttp } from './institutional-http.ts';
import { isoDate, requireArray, requireRecord, scaledDecimal, stableInstitutionalId } from './institutional-normalize.ts';
import { checkpoint, emptyInstitutionalMetrics, finishInstitutionalMetrics, startInstitutionalMetrics } from './institutional-run.ts';
import { persistInstitutionalRaw, stageInstitutionalSourceRecord } from './institutional-storage.ts';

const api = 'https://adm.senado.gov.br/adm-dadosabertos/api/v1/contratacoes';
const portal = 'https://www6g.senado.leg.br/transparencia/licitacoes-e-contratos/contratos';
const text = (value: string) => value.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
const field = (row: Record<string, unknown>, ...keys: string[]) => { for (const key of keys) if (row[key] !== null && row[key] !== undefined && String(row[key]).trim()) return String(row[key]).trim(); return null; };
const safeDate = (value: unknown) => String(value ?? '').startsWith('9999-') ? null : isoDate(value);

export interface SenatePortalBilling { id: string; description: string | null; billedAt: string | null; billedValueScaled: number | null; penaltyValueScaled: number | null; glossValueScaled: number | null; documentNumber: string | null; documentIssuedAt: string | null; documentDueAt: string | null }
export interface SenatePortalCommitment { number: string; year: number; nature: string | null; committedValueScaled: number | null; liquidatedValueScaled: number | null; balanceValueScaled: number | null }
export interface SenatePortalDetails { contractNumber: string | null; contractYear: number | null; processNumber: string | null; supplierName: string | null; supplierDocument: string | null; object: string | null; signedAt: string | null; publishedAt: string | null; startAt: string | null; currentEndAt: string | null; tenderNumber: string | null; currentValueScaled: number | null; billings: SenatePortalBilling[]; commitments: SenatePortalCommitment[] }

const dlValue = (html: string, label: string) => text(new RegExp(`<dt[^>]*>${label}<\\/dt>\\s*<dd[^>]*>([\\s\\S]*?)<\\/dd>`, 'i').exec(html)?.[1] ?? '');
export function parseSenateContractPortal(mainHtml: string, paymentsHtml: string): SenatePortalDetails {
  const title = /<title>\s*Contrato\s+([^/<]+)\/(\d{4})/i.exec(mainHtml);
  const manager = /Processo:\s*<span>([^<]+)<\/span>/i.exec(mainHtml);
  const signer = /<th>Signat[^<]*<\/th>\s*<td>\s*<span>([^<]+)<\/span>\s*\(<span>([^<]+)<\/span>/i.exec(mainHtml);
  const object = /<th>Objeto<\/th>\s*<td>\s*<span>([\s\S]*?)<\/span>/i.exec(mainHtml);
  const dates = /<th>Datas<\/th>[\s\S]*?<dt>Assinatura<\/dt>\s*<dd>\s*<span>([^<]+)<\/span>[\s\S]*?<dt>Publica[^<]*<\/dt>\s*<dd>\s*<span>([^<]+)<\/span>[\s\S]*?<dt>Vig[^<]*<\/dt>[\s\S]*?<span>\s*<span>([^<]+)<\/span>\s*at[^<]*<span>([^<]+)<\/span>/i.exec(mainHtml);
  const tender = /<dt>N[^<]*\/Ano:<\/dt>\s*<dd>\s*<span>([^<]+)<\/span>/i.exec(mainHtml);
  const currentValueScaled = scaledDecimal(/<th>Valores<\/th>[\s\S]*?R\$\s*(?:&nbsp;)?\s*<span>([\d.,]+)<\/span>/i.exec(mainHtml)?.[1] ?? null);
  const billings: SenatePortalBilling[] = [];
  const chunks = paymentsHtml.split(/<dl class="dl-horizontal">/i).slice(1);
  for (const [index, chunk] of chunks.entries()) {
    const body = chunk.split(/<dl class="dl-horizontal">/i, 1)[0] ?? chunk;
    const billed = dlValue(body, 'Valor cobrado');
    if (!billed) continue;
    const documentRow = /summary="tabela de documentos fiscais"[\s\S]*?<tbody>\s*<tr>([\s\S]*?)<\/tr>/i.exec(body)?.[1] ?? '';
    const cells = [...documentRow.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => text(match[1]!));
    const download = /title="Solicita[^>]+href="([^"]+)"/i.exec(body)?.[1] ?? `row-${index}`;
    billings.push({
      id: download,
      description: dlValue(body, 'Descri[^<]* da Despesa') || null,
      billedAt: isoDate(dlValue(body, 'Data')),
      billedValueScaled: scaledDecimal(billed),
      penaltyValueScaled: scaledDecimal(dlValue(body, 'Multa')),
      glossValueScaled: scaledDecimal(dlValue(body, 'Glosa')),
      documentNumber: cells[0] || null,
      documentIssuedAt: isoDate(cells[1]),
      documentDueAt: isoDate(cells[2])
    });
  }
  const commitments: SenatePortalCommitment[] = [];
  const table = /id="empenhos"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i.exec(paymentsHtml)?.[1] ?? '';
  for (const row of table.matchAll(/<tr>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1]!.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map(match => text(match[1]!));
    const ne = /^NE\s*(\d+)\/(\d{4})$/i.exec(cells[0] ?? '');
    if (!ne) continue;
    commitments.push({ number: `NE ${ne[1]}/${ne[2]}`, year: Number(ne[2]), nature: cells[1] || null, committedValueScaled: scaledDecimal(cells[2]), liquidatedValueScaled: scaledDecimal(cells[3]), balanceValueScaled: scaledDecimal(cells[4]) });
  }
  return { contractNumber: title?.[1]?.trim() ?? null, contractYear: title ? Number(title[2]) : null, processNumber: manager?.[1]?.trim() ?? null, supplierName: signer ? text(signer[1]!) : null, supplierDocument: signer?.[2]?.trim() ?? null, object: object ? text(object[1]!) : null, signedAt: isoDate(dates?.[1]), publishedAt: isoDate(dates?.[2]), startAt: isoDate(dates?.[3]), currentEndAt: isoDate(dates?.[4]), tenderNumber: tender?.[1]?.trim() ?? null, currentValueScaled, billings, commitments };
}

export interface SenateContractDetailOptions { rawDirectory: string; ids?: string[]; limit?: number | null; dryRun?: boolean; force?: boolean; http?: InstitutionalHttp; progress?: (message: string) => void }
interface BillingChildren { commitments: Record<string,unknown>[]; documents: Record<string,unknown>[] }
interface CollectedContract { contract:Record<string,unknown>;externalId:string;fetchedAt:string;rawId:string;items:Record<string,unknown>[];amendments:Record<string,unknown>[];guarantees:Record<string,unknown>[];apiBillings:Record<string,unknown>[];billingChildren:Map<string,BillingChildren>;portal:SenatePortalDetails;completeness:string }
function pendingContracts(db: DatabaseSync, limit: number, force: boolean) {
  return db.prepare(`SELECT c.* FROM institutional_contracts c JOIN institutional_source_records origin ON origin.id=c.source_record_id WHERE c.source_system='senado_adm' AND c.source_contract_id LIKE 'contratos:%' ${force ? '' : `AND NOT EXISTS(SELECT 1 FROM institutional_source_records done WHERE done.source_system='senado_adm_detail' AND done.entity_type='contract_detail' AND done.external_key=substr(c.source_contract_id,11) AND done.fetched_at>=origin.fetched_at)`} ORDER BY c.source_updated_at DESC,c.contract_year DESC LIMIT ?`).all(limit);
}

export async function collectSenateContractDetails(db: DatabaseSync, options: SenateContractDetailOptions) {
  const selected = options.ids?.length ? options.ids.map(externalId => db.prepare("SELECT * FROM institutional_contracts WHERE source_system='senado_adm' AND (id=? OR source_contract_id=?)").get(externalId, `contratos:${externalId}`) ?? { id: stableInstitutionalId('contract', 'senado_adm', 'contratos', externalId), source_contract_id: `contratos:${externalId}`, supplier_id: null, fetched_at: null }) : pendingContracts(db, options.limit ?? 25, Boolean(options.force));
  if (!selected.length) return { skipped: true, reason: 'up-to-date' };
  const scope = 'contract-details', runId = startRun(db, 'senado'), metrics = emptyInstitutionalMetrics(), http = options.http ?? new InstitutionalHttp({ delayMs: 160 });
  startInstitutionalMetrics(db, runId, 'senate-contract-details', scope); checkpoint(db, 'senate-contract-details', scope, { status: 'running' });
  try {
    const collected: CollectedContract[] = [];
    for (const contract of selected) {
      const externalId = String(contract.source_contract_id).replace(/^contratos:/, '');
      const responses = await Promise.all([
        http.bytes(`${api}/contratos/${externalId}/itens`).catch(() => null),
        http.bytes(`${api}/contratos/${externalId}/aditivos`).catch(() => null),
        http.bytes(`${api}/contratos/${externalId}/garantias`).catch(() => null),
        http.bytes(`${api}/contratos/${externalId}/pagamentos`).catch(() => null),
        http.bytes(`${portal}/${externalId}` , { Accept: 'text/html' }),
        http.bytes(`${portal}/${externalId}/pagamentos/`, { Accept: 'text/html' }).catch(() => null)
      ]);
      const raws = responses.map(response => response ? persistInstitutionalRaw(db, runId, options.rawDirectory, response) : null);
      const items = responses[0]?requireArray(JSON.parse(new TextDecoder().decode(responses[0].bytes)), 'itens').map(row => requireRecord(row, 'item')):[];
      const amendments = responses[1]?requireArray(JSON.parse(new TextDecoder().decode(responses[1].bytes)), 'aditivos').map(row => requireRecord(row, 'aditivo')):[];
      const guarantees = responses[2] ? requireArray(JSON.parse(new TextDecoder().decode(responses[2].bytes)), 'garantias').map(row => requireRecord(row, 'garantia')) : [];
      const apiBillings = responses[3]?requireArray(JSON.parse(new TextDecoder().decode(responses[3].bytes)), 'pagamentos').map(row => requireRecord(row, 'pagamento')):[];
      const billingChildren=new Map<string,{commitments:Record<string,unknown>[];documents:Record<string,unknown>[]}>();
      for(const billing of apiBillings){const billingId=field(billing,'id');if(!billingId)continue;const [commitmentResponse,documentResponse]=await Promise.all([http.bytes(`${api}/contratos/${externalId}/pagamentos/${billingId}/empenhos`).catch(()=>null),http.bytes(`${api}/contratos/${externalId}/pagamentos/${billingId}/documentos_fiscais`).catch(()=>null)]),commitments=commitmentResponse?requireArray(JSON.parse(new TextDecoder().decode(commitmentResponse.bytes)),'empenhos').map(row=>requireRecord(row)):[],documents=documentResponse?requireArray(JSON.parse(new TextDecoder().decode(documentResponse.bytes)),'documentos fiscais').map(row=>requireRecord(row)):[];billingChildren.set(billingId,{commitments,documents});for(const response of [commitmentResponse,documentResponse])if(response){persistInstitutionalRaw(db,runId,options.rawDirectory,response);metrics.requests++;metrics.bytes+=response.bytes.length}metrics.recordsFetched+=commitments.length+documents.length}
      const portalDetails = parseSenateContractPortal(new TextDecoder().decode(responses[4]!.bytes), responses[5]?new TextDecoder().decode(responses[5].bytes):'');
      const completeness = apiBillings.length ? 'complete' : portalDetails.billings.length ? 'empty_but_portal_has_data' : 'api_empty';
      if (!apiBillings.length) metrics.apiEmptyResponses++;
      if (completeness === 'empty_but_portal_has_data') metrics.portalFallbacks++;
      collected.push({ contract, externalId, fetchedAt: responses[4]!.fetchedAt, rawId: raws[4]!.rawId, items, amendments, guarantees, apiBillings, billingChildren, portal: portalDetails, completeness });
      metrics.requests += responses.length; metrics.bytes += responses.reduce((sum, response) => sum + (response?.bytes.length ?? 0), 0); metrics.recordsFetched += items.length + amendments.length + guarantees.length + (apiBillings.length || portalDetails.billings.length) + portalDetails.commitments.length;
      options.progress?.(`${externalId}: ${items.length} itens, ${amendments.length} aditivos, ${apiBillings.length || portalDetails.billings.length} cobranças (${completeness})`);
    }
    if (options.dryRun) { finishInstitutionalMetrics(db, runId, 'senate-contract-details', scope, metrics, 'complete'); failRun(db, runId, 'dry-run'); checkpoint(db, 'senate-contract-details', scope, { status: 'pending', metadata: { dryRun: true } }); return { dryRun: true, contracts: collected.length, metrics }; }
    transaction(db, () => {
      const now = new Date().toISOString();
      db.prepare('INSERT INTO institutional_collection_batches VALUES (?,?,?,?,?,?,?,?,?,?)').run(runId, 'SENADO', 'senado_adm_detail', 'contract_details', null, null, now, collected.some(row => row.completeness !== 'complete') ? 'partial' : 'available', metrics.recordsFetched, JSON.stringify(metrics));
      for (const entry of collected) {
        const record = stageInstitutionalSourceRecord(db, { batchId: runId, sourceSystem: 'senado_adm_detail', entityType: 'contract_detail', externalKey: entry.externalId, payload: { items: entry.items, amendments: entry.amendments, guarantees: entry.guarantees, apiBillings: entry.apiBillings, billingChildren:Object.fromEntries(entry.billingChildren), portal: entry.portal, completeness: entry.completeness }, fetchedAt: entry.fetchedAt, rawId: entry.rawId });
        const supplier=resolveStrongSupplier(db,{document:entry.portal.supplierDocument,name:entry.portal.supplierName,source:'senado_portal',sourceRecordId:record.id,institution:'SENADO',role:'INSTITUTIONAL_CONTRACT',observedAt:entry.fetchedAt});
        const tenderId=entry.portal.tenderNumber?db.prepare("SELECT id FROM tenders WHERE institution='SENADO' AND tender_number=? LIMIT 1").get(entry.portal.tenderNumber)?.id??null:null;
        db.prepare(`INSERT INTO institutional_contracts(id,institution,source_system,source_contract_id,currency,value_scale,current_value_semantics,fetched_at,source_record_id) VALUES (?,'SENADO','senado_adm',?,'BRL',2,'registro histórico de suporte recuperado pelo detalhe oficial',?,?) ON CONFLICT(source_system,source_contract_id) DO NOTHING`).run(String(entry.contract.id),`contratos:${entry.externalId}`,entry.fetchedAt,record.id);
        db.prepare(`UPDATE institutional_contracts SET tender_id=coalesce(?,tender_id),supplier_id=coalesce(?,supplier_id),contract_number=coalesce(?,contract_number),contract_year=coalesce(?,contract_year),object=coalesce(?,object),process_number=coalesce(?,process_number),signed_at=coalesce(?,signed_at),published_at=coalesce(?,published_at),start_at=coalesce(?,start_at),current_end_at=coalesce(?,current_end_at),current_published_value_scaled=coalesce(?,current_published_value_scaled),current_value_semantics=CASE WHEN ? IS NULL THEN current_value_semantics ELSE 'valor global publicado na página oficial; não representa pagamento' END,fetched_at=? WHERE id=?`).run(tenderId==null?null:String(tenderId),supplier?.supplierId??null,entry.portal.contractNumber,entry.portal.contractYear,entry.portal.object,entry.portal.processNumber,entry.portal.signedAt,entry.portal.publishedAt,entry.portal.startAt,entry.portal.currentEndAt,entry.portal.currentValueScaled,entry.portal.currentValueScaled,entry.fetchedAt,String(entry.contract.id));
        for (const row of entry.items) { const sourceId = field(row, 'id'); if (!sourceId) continue; db.prepare(`INSERT INTO contract_items(id,contract_id,tender_item_id,source_system,source_item_id,description,quantity_scaled,quantity_scale,unit_value_scaled,total_value_scaled,value_scale,source_record_id) VALUES (?,?,NULL,'senado_adm_detail',?,?,?,0,NULL,NULL,2,?) ON CONFLICT(source_system,source_item_id) DO UPDATE SET description=excluded.description,quantity_scaled=excluded.quantity_scaled,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('contract_item', 'senado_adm', sourceId), String(entry.contract.id), sourceId, field(row, 'descricao'), scaledDecimal(field(row, 'quantidade'), 0), record.id); metrics.recordsInserted++; }
        for (const row of entry.amendments) { const sourceId = field(row, 'id'); if (!sourceId) continue; db.prepare(`INSERT INTO contract_amendments(id,contract_id,source_system,source_amendment_id,amendment_number,kind,description,signed_at,published_at,start_at,end_at,currency,added_value_scaled,suppressed_value_scaled,resulting_value_scaled,value_scale,source_record_id) VALUES (?,?,'senado_adm_detail',?,?,?,?,?, ?,NULL,NULL,'BRL',NULL,NULL,?,2,?) ON CONFLICT(source_system,source_amendment_id) DO UPDATE SET amendment_number=excluded.amendment_number,signed_at=excluded.signed_at,published_at=excluded.published_at,resulting_value_scaled=excluded.resulting_value_scaled,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('amendment', 'senado_adm', sourceId), String(entry.contract.id), sourceId, field(row, 'numero'), 'semântica do valor não publicada no DTO', null, safeDate(row.data_assinatura), safeDate(row.data_publicacao), scaledDecimal(field(row, 'valor')), record.id); metrics.recordsInserted++; }
        const billings = entry.apiBillings.length ? entry.apiBillings.map(row => ({ id: field(row, 'id')!, description: field(row, 'descricao_despesa'), billedAt: safeDate(row.data), billedValueScaled: scaledDecimal(field(row, 'valor_cobrado')), penaltyValueScaled: scaledDecimal(field(row, 'multa')), glossValueScaled: scaledDecimal(field(row, 'glosa')), documentNumber: null, documentIssuedAt: null })) : entry.portal.billings;
        for (const billing of billings) { if (!billing.id) continue; const billingId = stableInstitutionalId('billing', 'senado_adm', entry.externalId, billing.id); db.prepare(`INSERT INTO contract_billings(id,contract_id,source_system,source_billing_id,reference_period,billed_at,currency,billed_value_scaled,penalty_value_scaled,withheld_value_scaled,gloss_value_scaled,value_scale,status,source_record_id) VALUES (?,?,'senado_adm_detail',?,NULL,?,'BRL',?,?,NULL,?,2,?,?) ON CONFLICT(source_system,source_billing_id) DO UPDATE SET billed_at=excluded.billed_at,billed_value_scaled=excluded.billed_value_scaled,penalty_value_scaled=excluded.penalty_value_scaled,gloss_value_scaled=excluded.gloss_value_scaled,status=excluded.status,source_record_id=excluded.source_record_id`).run(billingId, String(entry.contract.id), `${entry.externalId}:${billing.id}`, billing.billedAt, billing.billedValueScaled, billing.penaltyValueScaled, billing.glossValueScaled, entry.completeness === 'complete' ? 'api' : 'portal_fallback', record.id); if ('documentNumber' in billing && billing.documentNumber) db.prepare(`INSERT INTO fiscal_documents(id,billing_id,contract_id,source_system,source_document_id,document_type,document_number,issued_at,currency,document_value_scaled,value_scale,official_url,source_record_id) VALUES (?,?,?,'senado_adm_detail',?,'documento fiscal',?,?,'BRL',NULL,2,NULL,?) ON CONFLICT(source_system,source_document_id) DO UPDATE SET billing_id=excluded.billing_id,issued_at=excluded.issued_at,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('fiscal', 'senado_adm', entry.externalId, billing.documentNumber), billingId, String(entry.contract.id), `${entry.externalId}:${billing.documentNumber}`, billing.documentNumber, billing.documentIssuedAt, record.id);const children=entry.billingChildren.get(billing.id);for(const document of children?.documents??[]){const documentId=field(document,'id','numero');if(!documentId)continue;db.prepare(`INSERT INTO fiscal_documents(id,billing_id,contract_id,source_system,source_document_id,document_type,document_number,issued_at,currency,document_value_scaled,value_scale,official_url,source_record_id) VALUES (?,?,?,'senado_adm_detail',?,'documento fiscal',?,?,'BRL',NULL,2,NULL,?) ON CONFLICT(source_system,source_document_id) DO UPDATE SET billing_id=excluded.billing_id,issued_at=excluded.issued_at,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('fiscal','senado_adm',entry.externalId,documentId),billingId,String(entry.contract.id),`${entry.externalId}:${documentId}`,field(document,'numero'),safeDate(document.data_emissao),record.id)}for(const commitment of children?.commitments??[]){const commitmentIdSource=field(commitment,'id','numero');if(!commitmentIdSource)continue;const number=field(commitment,'numero')??commitmentIdSource,year=Number(/20\d{2}/.exec(number)?.[0]??entry.contract.contract_year) || null;db.prepare(`INSERT INTO commitments(id,institution,source_system,source_commitment_id,contract_id,supplier_id,commitment_number,commitment_year,issued_at,currency,committed_value_scaled,value_scale,status,link_evidence,source_record_id) VALUES (?,'SENADO','senado_adm_detail',?,?,?,?,?,NULL,'BRL',?,2,'api',?,?) ON CONFLICT(source_system,source_commitment_id) DO UPDATE SET contract_id=excluded.contract_id,supplier_id=excluded.supplier_id,committed_value_scaled=excluded.committed_value_scaled,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('commitment','senado_adm',entry.externalId,commitmentIdSource),`${entry.externalId}:${commitmentIdSource}`,String(entry.contract.id),entry.contract.supplier_id==null?null:String(entry.contract.supplier_id),number,year,scaledDecimal(field(commitment,'valor_empenhado')),`${api}/contratos/${entry.externalId}/pagamentos/${billing.id}/empenhos`,record.id)} metrics.recordsInserted++; }
        for (const commitment of entry.portal.commitments) { const sourceId = `${entry.externalId}:${commitment.number}`; const commitmentId = stableInstitutionalId('commitment', 'senado_portal', sourceId); db.prepare(`INSERT INTO commitments(id,institution,source_system,source_commitment_id,contract_id,supplier_id,commitment_number,commitment_year,issued_at,currency,committed_value_scaled,value_scale,status,link_evidence,source_record_id) VALUES (?,'SENADO','senado_portal',?,?,?,?,?,NULL,'BRL',?,2,'portal_fallback',?,?) ON CONFLICT(source_system,source_commitment_id) DO UPDATE SET contract_id=excluded.contract_id,supplier_id=excluded.supplier_id,committed_value_scaled=excluded.committed_value_scaled,status=excluded.status,source_record_id=excluded.source_record_id`).run(commitmentId, sourceId, String(entry.contract.id), entry.contract.supplier_id==null?null:String(entry.contract.supplier_id), commitment.number, commitment.year, commitment.committedValueScaled, `${portal}/${entry.externalId}/pagamentos/`, record.id); if (commitment.liquidatedValueScaled !== null) db.prepare(`INSERT INTO financial_movements(id,commitment_id,source_system,source_movement_id,phase,movement_kind,movement_year,occurred_at,currency,amount_signed_scaled,value_scale,restos_a_pagar,source_record_id) VALUES (?,?,'senado_portal',?,'liquidation','agregado publicado no contrato',?,NULL,'BRL',?,2,0,?) ON CONFLICT(source_system,source_movement_id) DO UPDATE SET amount_signed_scaled=excluded.amount_signed_scaled,source_record_id=excluded.source_record_id`).run(stableInstitutionalId('movement','senado_portal',sourceId,'liquidated'),commitmentId,`${sourceId}:liquidated`,commitment.year,commitment.liquidatedValueScaled,record.id); metrics.recordsInserted++; }
      }
      db.prepare(`INSERT INTO active_institutional_publications VALUES ('SENADO','senado_adm_detail','contract_details',?) ON CONFLICT(institution,source_system,dataset) DO UPDATE SET batch_id=excluded.batch_id`).run(runId);
      db.prepare("UPDATE ingestion_runs SET status='published',finished_at=?,expected_count=?,roster_complete=1,reconciliation_json=? WHERE id=?").run(now, metrics.recordsFetched, JSON.stringify(metrics), runId); db.prepare('DELETE FROM job_locks WHERE run_id=?').run(runId);
    });
    finishInstitutionalMetrics(db, runId, 'senate-contract-details', scope, metrics, 'complete'); checkpoint(db, 'senate-contract-details', scope, { status: 'complete', metadata: { runId, contracts: collected.length } }); return { runId, contracts: collected.length, metrics };
  } catch (error) { const message = error instanceof Error ? error.message : String(error); try { finishInstitutionalMetrics(db, runId, 'senate-contract-details', scope, metrics, 'failed', message); } catch {} failRun(db, runId, message); checkpoint(db, 'senate-contract-details', scope, { status: 'failed', error: message }); throw error; }
}
