/** Canonical state budget amendments (P23.1).
 *
 * This contract is deliberately separate from the federal Pix model.  The
 * two domains share financial vocabulary, but source keys, statuses and
 * revision boundaries are not interchangeable.
 */
export type StateBudgetHouse = 'ES' | 'MG' | 'RS';
export type StateBudgetActorType = 'INDIVIDUAL_DEPUTY' | 'BLOC' | 'BENCH' | 'COMMISSION' | 'EXECUTIVE_OR_OTHER' | 'UNKNOWN_SOURCE_ACTOR';
export type StateBudgetStage = 'COMMITTED' | 'LIQUIDATED' | 'PAID' | 'OTHER';
export type StateBudgetCanonicalStatus = 'NOT_STARTED' | 'COMMITTED' | 'LIQUIDATED' | 'PARTIALLY_PAID' | 'PAID' | 'BLOCKED_OR_IMPEDED' | 'CANCELLED' | 'UNKNOWN';
export interface StateBudgetProvenance { provider: string; resource: string; sourceUrl: string; rawId: string; fetchedAt: string; sha256: string; sourceUpdatedAt: string | null; }
export interface StateBudgetAmendment {
  house: StateBudgetHouse; fiscalYear: number; sourceProvider: string; sourceAmendmentKey: string;
  sourceAmendmentNumber: string | null; sourceAmendmentType: string | null; canonicalAmendmentType: string | null;
  description: string | null; sourceStatus: string | null; canonicalStatus: StateBudgetCanonicalStatus;
  sourceUrl: string; rawId: string; amountIndicatedCents: bigint | null; amountApprovedCents: bigint | null;
  amountCurrentCents: bigint | null; amountCommittedCents: bigint | null; amountLiquidatedCents: bigint | null;
  amountPaidCents: bigint | null; amountOutstandingPayableCents: bigint | null; amountUsedCents: bigint | null;
  semanticHash: string; provenance: StateBudgetProvenance;
}
export interface StateBudgetAuthor { amendmentKey: string; authorKey: string; actorType: StateBudgetActorType; actorRaw: string | null; sourceActorId: string | null; partyRaw: string | null; canonicalPersonId: string | null; linkageMethod: string | null; }
export interface StateBudgetDestination { amendmentKey: string; destinationKey: string; beneficiaryName: string | null; beneficiaryDocument: string | null; beneficiaryType: string | null; municipalitySourceCode: string | null; municipalityName: string | null; municipalityIbgeCode: string | null; executingAgency: string | null; budgetUnit: string | null; program: string | null; action: string | null; subaction: string | null; functionCode: string | null; subfunctionCode: string | null; expenseGroup: string | null; expenseElement: string | null; objectFinality: string | null; }
export interface StateBudgetExecutionItem { executionKey: string; amendmentKey: string | null; documentNumber: string | null; commitmentNumber: string | null; processNumber: string | null; occurredAt: string | null; financialStage: StateBudgetStage; amountCents: bigint | null; creditorDocument: string | null; creditorName: string | null; managementUnit: string | null; agency: string | null; procurementType: string | null; procurementNumber: string | null; contractNumber: string | null; agreementNumber: string | null; rawId: string; }
