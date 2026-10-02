/** Shared public person projection used by every legislative surface. */
export function buildPublicPerson(profile: any, metrics: any = {}) {
  const p = profile ?? {};
  const array = (key: string) => Array.isArray(p[key]) ? p[key] : (Array.isArray(metrics[key]) ? metrics[key] : []);
  const exercises = array('exercises');
  const today = new Date().toISOString().slice(0, 10);
  const activeExercise = exercises.some((x: any) => String(x?.start ?? '').slice(0, 10) <= today && (!x?.end || String(x.end).slice(0, 10) >= today));
  return {
    ...p,
    personId: p.personId ?? p.person_id ?? null,
    source: p.source ?? null,
    externalId: p.externalId ?? p.external_id ?? null,
    name: p.name ?? p.fullName ?? '',
    fullName: p.fullName ?? p.name ?? '',
    photoUrl: p.photoUrl ?? p.photo_url ?? null,
    officialUrl: p.officialUrl ?? p.official_url ?? null,
    role: p.role ?? (p.source === 'senado' ? 'Senador(a)' : 'Deputado(a) federal'),
    uf: p.uf ?? null,
    party: p.party ?? null,
    situation: p.situation ?? (activeExercise ? 'Em exercício' : 'Cadastro atual'),
    historyAvailability: p.historyAvailability ?? 'available',
    mandates: array('mandates'),
    exercises,
    parties: array('parties'),
    events: array('events'),
    presence: metrics.presence ?? p.presence ?? null,
    participation: metrics.participation ?? p.participation ?? null,
    proposals: metrics.proposals ?? p.proposals ?? null,
    proposalCount: metrics.proposals ?? p.proposalCount ?? null,
    rapporteurships: metrics.rapporteurships ?? p.rapporteurships ?? 0,
    expenseCents: metrics.expenseCents ?? p.expenseCents ?? null,
    cabinetCents: metrics.cabinetCents ?? p.cabinetCents ?? null,
    totalCostCents: metrics.totalCostCents ?? p.totalCostCents ?? null,
    monthlyCostCents: metrics.monthlyCostCents ?? p.monthlyCostCents ?? null,
    costMonths: metrics.costMonths ?? p.costMonths ?? null,
    costPeriod: metrics.costPeriod ?? p.costPeriod ?? null,
    staff: metrics.staff ?? p.staff ?? null,
    assetsCents: metrics.assetsCents ?? p.assetsCents ?? null,
    assetYear: metrics.assetYear ?? p.assetYear ?? null,
  };
}

export function flattenComplement(row: any, source: string, personExternalId: string) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  const isInstitutionalSummary = String(row.kind ?? payload.kind ?? '') === 'reconciliation' || String(row.external_key ?? payload.externalKey ?? '').startsWith('house-operations:');
  return {
    ...payload,
    kind: String(row.kind ?? payload.kind ?? ''),
    externalKey: String(row.external_key ?? payload.externalKey ?? ''),
    proposalId: row.proposal_id == null ? (payload.proposalId ?? null) : String(row.proposal_id),
    deliberationId: row.deliberation_id == null ? (payload.deliberationId ?? null) : String(row.deliberation_id),
    bodyId: row.body_id == null ? (payload.bodyId ?? null) : String(row.body_id),
    occurredAt: row.occurred_at == null ? (payload.occurredAt ?? null) : String(row.occurred_at),
    source: payload.source ?? source,
    // Institutional reconciliation rows are deliberately not person-linked.
    // Falling back to the profile id here made a house-level summary look as
    // if it belonged to the viewed parliamentarian.
    personExternalId: isInstitutionalSummary ? null : (payload.personExternalId ?? personExternalId),
    rawId: payload.rawId ?? row.raw_id ?? null,
  };
}
