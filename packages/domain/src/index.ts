export const sources = ['senado', 'camara'] as const;
export type Source = typeof sources[number];
export type Availability = 'available' | 'partial' | 'unavailable' | 'stale' | 'not_applicable';
export type PeriodGrain = 'snapshot' | 'month' | 'year' | 'term' | 'unknown';
export interface DataPeriod { from: string | null; to: string | null; grain: PeriodGrain }
export interface DataCoverage {
  availability: Availability; source: Source | 'tse' | 'multiple'; period: DataPeriod;
  batchId: string | null; note: string; sampleSize: number | null;
}
export interface Metric<T> { value: T | null; coverage: DataCoverage }
export interface SeriesPoint<T = number> { period: string; value: T | null; coverage: DataCoverage }
export interface Distribution {
  count: number; min: number | null; p25: number | null; median: number | null;
  p75: number | null; max: number | null;
}
export const ufs = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));
export interface Issue { severity: 'error' | 'warning'; code: string; message: string; externalId: string | null; rawId: string | null }
export interface Origin { rawId: string }
export interface Interval extends Origin {
  key: string;
  start: string;
  end: string | null;
  endReason: 'reported' | 'not_reported' | 'next_event';
  precision: 'date' | 'local_datetime';
  basis: 'official' | 'derived';
}
export interface Mandate extends Origin {
  key: string; officialId: string | null; legislature: string; uf: string;
  role: string | null; titularId: string | null; start: string | null; end: string | null;
}
export interface Exercise extends Interval { mandateKey: string; state: string; cause: string | null }
export interface PartyMembership extends Interval { partyId: string | null; party: string; mandateKey: string | null }
export interface HistoryEvent extends Origin {
  key: string; legislature: string; at: string; state: string | null;
  role: string | null; party: string | null; partyId: string | null; description: string | null;
}
export interface Profile extends Origin {
  source: Source; externalId: string; name: string; fullName: string | null;
  uf: string; party: string; photoUrl: string | null; officialUrl: string;
  observedAt: string; historyAvailability: Availability;
  mandates: Mandate[]; exercises: Exercise[]; parties: PartyMembership[]; events: HistoryEvent[];
}
export interface Roster { profiles: Profile[]; issues: Issue[] }
export interface Expense {
  source: Source; externalId: string; year: number; month: number; recordKey: string;
  categoryCode: string; category: string; supplier: string | null; supplierDocument: string | null;
  documentNumber: string | null; documentId: string | null; documentUrl: string | null; issuedAt: string | null;
  grossCents: number | null; deductionCents: number; netCents: number; refundCents: number;
  installment: number | null; detail: string | null; rawId: string;
}
export interface Deliberation { source:Source; externalId:string; year:number; date:string; recordedAt:string|null; chamberBody:string; description:string; result:string|null; approved:boolean|null; secret:boolean; proposalId:string|null; proposalLabel:string|null; proposalSummary:string|null; officialUrl:string; rawId:string }
export interface Proposal { source:Source; externalId:string; type:string; number:string|null; year:number|null; label:string; summary:string|null; presentedAt:string|null; status:string|null; officialUrl:string; rawId:string }
export interface ProposalAuthor { proposalId:string; externalId:string|null; name:string; party:string|null; uf:string|null; kind:string; primary:boolean|null; order:number|null; rawId:string }
export interface LegislativeAppointment { source:Source; externalId:string; personExternalId:string; kind:'rapporteurship'|'commission'|'office'; bodyId:string|null; bodyLabel:string|null; role:string; start:string|null; end:string|null; status:string|null; proposalId:string|null; officialUrl:string; rawId:string }
export interface LawLink { proposalId:string; lawId:string; lawLabel:string; officialUrl:string; relationship:string; rawId:string }
export interface LegislativeSession { source:Source; externalId:string; date:string; startedAt:string|null; endedAt:string|null; kind:string; status:string; body:string; eligible:boolean; officialUrl:string; rawId:string }
export interface Attendance { source:Source; sessionId:string; externalId:string; state:string; justification:string|null; rawId:string }
export interface LegislativeComplement { source:Source; externalKey:string; kind:'reconciliation'|'matter_detail'|'author_detail'|'rapporteur_detail'|'amendment'|'situation'|'commission_vote'|'orientation'|'proposal_detail'|'theme'|'movement'|'body_member'|'leadership'; personExternalId:string|null; proposalId:string|null; deliberationId:string|null; bodyId:string|null; occurredAt:string|null; label:string; value:string|null; officialUrl:string; rawId:string }
export interface LegislativeVote { source:Source; deliberationId:string; externalId:string; vote:string; description:string|null; party:string|null; uf:string|null; recordedAt:string|null; rawId:string }
export type ElectoralAvailability = 'available'|'partial'|'unavailable';
export type ElectoralMatchStatus = 'pending'|'confirmed'|'ambiguous'|'rejected';
export interface CandidacyDetails { candidacyStatus:string|null; legalStatus:string|null; ballotStatus:string|null; diplomaStatus:string|null; reelection:boolean|null; declaredAssets:boolean|null; accountsSubmitted:boolean|null; substituteSequenceId:string|null; substituteOrder:number|null; campaignLimitCents:number|null }
export interface Candidacy { electionId:string; sequenceId:string; year:number; round:number; office:string; uf:string; name:string; ballotName:string; ballotNumber:string|null; party:string|null; votes:number|null; result:string|null; elected:boolean|null; matchStatus:ElectoralMatchStatus; personId:string|null; matchEvidence:string[]; officialUrl:string; rawId:string; electionCode?:string|null; electionDate?:string|null; socialName?:string|null; details?:CandidacyDetails|null; detailsRawId?:string|null }
export interface ElectoralAsset { sequenceId:string; assetId:string; description:string; kind:string|null; valueCents:number; version:string; rawId:string; updatedAt?:string|null }
export interface CampaignTransaction { sequenceId:string; transactionId:string; kind:'revenue'|'expense'; counterparty:string|null; counterpartyDocument:string|null; category:string|null; description:string|null; valueCents:number; date:string|null; version:string; rawId:string }
export interface ExpandedCost { source:Source; externalId:string; competence:string; rubric:string; nature:'expense'|'budget'|'occupancy'|'headcount'; valueCents:number|null; overlapGroup:string|null; label:string; count:number|null; availability:'available'|'partial'|'unavailable'; rawId:string }
export type StaffMatchStatus='confirmed'|'pending'|'ambiguous'|'rejected';
export interface FunctionalStaffAssignment { source:Source; staffKey:string; functionalId:string|null; name:string; relationship:string; position:string|null; role:string|null; unitId:string|null; unitLabel:string; appointedAt:string|null; startedAt:string|null; endedAt:string|null; observedAt:string; externalId:string|null; matchStatus:StaffMatchStatus; matchEvidence:string[]; rawId:string }
export interface CabinetMonthlyBudget { source:'camara'; externalId:string; year:number; month:number; availableCents:number|null; spentCents:number|null; rawId:string }

/** Linear interpolation over sorted compatible observations (R-7 / Excel INC). */
export function quantile(values: number[], probability: number): number | null {
  if (!values.length) return null;
  if (!Number.isFinite(probability) || probability < 0 || probability > 1) throw new Error('Probabilidade inválida');
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.some(value => !Number.isFinite(value))) throw new Error('Distribuição contém valor inválido');
  const index = (sorted.length - 1) * probability;
  const lower = Math.floor(index); const upper = Math.ceil(index);
  return sorted[lower]! + (sorted[upper]! - sorted[lower]!) * (index - lower);
}
export function distribution(values: number[]): Distribution {
  return { count: values.length, min: quantile(values, 0), p25: quantile(values, .25), median: quantile(values, .5), p75: quantile(values, .75), max: quantile(values, 1) };
}
/** Builds an explicit series; absent observations remain null and are never inferred. */
export function historicalSeries<T>(periods: string[], observations: ReadonlyMap<string, T>, coverage: (period: string, available: boolean) => DataCoverage): SeriesPoint<T>[] {
  if (new Set(periods).size !== periods.length) throw new Error('Período histórico duplicado');
  return periods.map(period => {
    const available = observations.has(period);
    return { period, value: available ? observations.get(period)! : null, coverage: coverage(period, available) };
  });
}
export function decimalCents(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') throw new Error('Valor monetário ausente');
  const raw=String(value).trim().replace(/\s/g,'');
  let normalized=raw.includes(',')?raw.replace(/\./g,'').replace(',','.'):raw;
  if(normalized.startsWith('.'))normalized=`0${normalized}`;if(normalized.startsWith('-.'))normalized=normalized.replace('-.','-0.');
  if(!/^-?\d+(?:\.\d{1,2})?$/.test(normalized))throw new Error(`Valor monetário inválido: ${raw.slice(0,40)}`);
  const negative=normalized.startsWith('-');const [whole,fraction='']=normalized.replace('-','').split('.');
  const cents=Number(whole)*100+Number(fraction.padEnd(2,'0'));
  if(!Number.isSafeInteger(cents))throw new Error('Valor monetário fora da faixa segura');
  return negative?-cents:cents;
}

export function externalId(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Identificador numérico inválido ou sem precisão');
    return String(value);
  }
  if (typeof value !== 'string' || !/^\d+$/.test(value) || !/[1-9]/.test(value)) throw new Error('Identificador externo inválido');
  return value;
}
export function identityKey(source: Source, value: unknown): string { return `${source}:${externalId(value)}`; }
export function civilDate(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Data civil inválida');
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error('Data civil inexistente');
  return value;
}
export function civilDateTime(value: unknown): string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) throw new Error('Data/hora civil inválida');
  civilDate(value.slice(0, 10));
  if (Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19) || 0) > 59) throw new Error('Hora civil inexistente');
  return value; // Deliberately no UTC conversion: source has no offset.
}
export function searchText(value: string): string { return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('pt-BR').trim(); }

export function validateProfile(profile: Profile): Issue[] {
  const issues: Issue[] = [];
  const add = (code: string, message: string, severity: 'error' | 'warning' = 'error') => issues.push({ code, message, severity, externalId: profile.externalId, rawId: profile.rawId });
  if (!ufs.has(profile.uf)) add('invalid_uf', `UF inválida: ${profile.uf}`);
  if (!profile.name.trim() || !profile.party.trim()) add('missing_identity', 'Nome ou partido ausente');
  if (!Number.isFinite(Date.parse(profile.observedAt))) add('invalid_observation', 'Instante de observação inválido');
  const mandates = new Set(profile.mandates.map(m => m.key));
  if (mandates.size !== profile.mandates.length) add('duplicate_mandate', 'Mandato duplicado');
  for (const mandate of profile.mandates) {
    if (!ufs.has(mandate.uf)) add('invalid_mandate_uf', 'UF do mandato inválida');
    if (mandate.start && mandate.end && mandate.start > mandate.end) add('invalid_mandate_interval', 'Limites do mandato invertidos');
  }
  for (const collection of [profile.exercises, profile.parties]) {
    if (new Set(collection.map(item => item.key)).size !== collection.length) add('duplicate_interval', 'Intervalo duplicado');
    for (const item of collection) {
      try { (item.precision === 'date' ? civilDate : civilDateTime)(item.start); if (item.end) (item.precision === 'date' ? civilDate : civilDateTime)(item.end); }
      catch { add('invalid_interval_date', 'Data de intervalo inválida'); }
      if (item.end && item.start > item.end) add('inverted_interval', 'Intervalo invertido');
      if (item.mandateKey && !mandates.has(item.mandateKey)) add('missing_mandate', 'Exercício/filiação sem mandato correspondente');
    }
  }
  // Overlap warnings quarantine historical interpretation, not the independently observed roster.
  for (const collection of [profile.exercises, profile.parties]) {
    const sorted = [...collection].sort((a, b) => a.start.localeCompare(b.start));
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!; const next = sorted[i]!;
      if (prev.mandateKey === next.mandateKey && (!prev.end || prev.end > next.start)) add('historical_overlap', 'Intervalos históricos sobrepostos; interpretação parcial', 'warning');
    }
  }
  return issues;
}


