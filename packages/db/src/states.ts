import type { DatabaseSync } from 'node:sqlite';
import {
  distribution,
  type DataCoverage,
  type Distribution,
  type LegislativeComplement,
  type Profile,
  type Source,
} from '@senadotracker/domain';
import { publishedExpenseYears, publishedParticipationRows } from './panorama.ts';
import { publishedCabinetSummaries } from './frontend-data.ts';

export interface StateRepresentative extends Profile {
  expenseCents: number | null;
  presence: number | null;
  participation: number | null;
  staff: number | null;
  cabinetFinancialCents: number | null;
  cabinetPeriod: string | null;
  cabinetKind: 'budget_spent' | 'identified_payroll';
}

export interface StateCabinetSummary { staff: Distribution; financialCents: Distribution; period: string | null; kind: 'budget_spent' | 'identified_payroll' }

export interface StateSummary {
  uf: string;
  senators: number;
  deputies: number;
  representatives: number;
  expenseCents: Distribution;
  presence: Distribution;
  participation: Distribution;
  staff: Distribution;
  cabinetByHouse: { senado: StateCabinetSummary; camara: StateCabinetSummary };
}

const period = (year: number) => ({ from: `${year}-01-01`, to: `${year}-12-31`, grain: 'year' as const });

function profilesForState(db: DatabaseSync, uf: string) {
  const result: Profile[] = [];
  for (const source of ['senado', 'camara'] as const) {
    for (const row of db.prepare(`SELECT p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=? AND p.uf=?`).all(source, uf)) {
      result.push(JSON.parse(String(row.payload)) as Profile);
    }
  }
  return result;
}

function representatives(db: DatabaseSync, uf: string, year: number) {
  const profiles = profilesForState(db, uf);
  const expenses = new Map<string, number>();
  const participation = new Map<string, ReturnType<typeof publishedParticipationRows>[string]>();
  for (const source of ['senado', 'camara'] as const) {
    const sourceProfiles = profiles.filter(item => item.source === source);
    const ids = sourceProfiles.map(item => item.externalId);
    const metrics = publishedParticipationRows(db, source, year, ids);
    for (const [id, metric] of Object.entries(metrics)) participation.set(`${source}:${id}`, metric);
    if (publishedExpenseYears(db, source).includes(year)) {
      for (const row of db.prepare(`SELECT e.external_id,sum(e.net_cents-e.refund_cents) value FROM expenses e JOIN active_expense_publications a ON a.batch_id=e.batch_id WHERE e.source=? AND e.year=? GROUP BY e.external_id`).all(source, year)) {
        expenses.set(`${source}:${row.external_id}`, Number(row.value));
      }
    }
  }
  const cabinets=new Map<string,ReturnType<typeof publishedCabinetSummaries>[string]>();
  for(const source of ['senado','camara'] as const){
    const ids=profiles.filter(item=>item.source===source).map(item=>item.externalId);
    for(const [id,item] of Object.entries(publishedCabinetSummaries(db,source,ids)))cabinets.set(`${source}:${id}`,item);
  }
  return profiles.map(profile => {
    const key = `${profile.source}:${profile.externalId}`;
    const metric = participation.get(key);
    const cabinet=cabinets.get(key)!;
    return {
      ...profile,
      expenseCents: expenses.get(key) ?? null,
      presence: metric?.presence.numerator !== null && metric?.presence.denominator ? metric.presence.numerator / metric.presence.denominator : null,
      participation: metric?.participation.numerator !== null && metric?.participation.denominator ? metric.participation.numerator / metric.participation.denominator : null,
      staff:cabinet.staff,
      cabinetFinancialCents:cabinet.financialCents,
      cabinetPeriod:cabinet.period,
      cabinetKind:cabinet.kind,
    } satisfies StateRepresentative;
  });
}

function summarize(uf: string, rows: StateRepresentative[]): StateSummary {
  const values = <K extends keyof StateRepresentative>(key: K) => rows.flatMap(row => typeof row[key] === 'number' ? [row[key] as number] : []);
  const cabinet=(source:Source):StateCabinetSummary=>{const house=rows.filter(item=>item.source===source),periods=[...new Set(house.flatMap(item=>item.cabinetPeriod?[item.cabinetPeriod]:[]))];return{staff:distribution(house.flatMap(item=>item.staff===null?[]:[item.staff])),financialCents:distribution(house.flatMap(item=>item.cabinetFinancialCents===null?[]:[item.cabinetFinancialCents])),period:periods.length===1?periods[0]!:null,kind:source==='camara'?'budget_spent':'identified_payroll'}};
  return {
    uf,
    senators: rows.filter(item => item.source === 'senado').length,
    deputies: rows.filter(item => item.source === 'camara').length,
    representatives: rows.length,
    expenseCents: distribution(values('expenseCents')),
    presence: distribution(values('presence')),
    participation: distribution(values('participation')),
    staff: distribution(values('staff')),
    cabinetByHouse:{senado:cabinet('senado'),camara:cabinet('camara')},
  };
}

export function publishedStateRepresentation(db: DatabaseSync, uf: string, year: number) {
  const rows = representatives(db, uf, year);
  const roster = db.prepare(`SELECT group_concat(a.batch_id) batches,max(b.published_at) published_at FROM active_publications a JOIN publication_batches b ON b.id=a.batch_id`).get();
  const coverage: DataCoverage = rows.length ? {
    availability: 'available', source: 'multiple',
    period: { from: String(roster?.published_at ?? ''), to: String(roster?.published_at ?? ''), grain: 'snapshot' },
    batchId: roster?.batches ? String(roster.batches) : null,
    note: 'Representantes dos cadastros ativos do Senado e da Câmara.', sampleSize: rows.length,
  } : {
    availability: 'unavailable', source: 'multiple', period: period(year), batchId: null,
    note: 'Não há representantes publicados para esta UF.', sampleSize: 0,
  };
  return { uf, year, summary: summarize(uf, rows), senators: rows.filter(item => item.source === 'senado'), deputies: rows.filter(item => item.source === 'camara'), coverage };
}

export function publishedStateComparison(db: DatabaseSync, year: number, ufs: string[]) {
  return ufs.map(uf => summarize(uf, representatives(db, uf, year))).filter(item => item.representatives > 0);
}

export function publishedStateTopics(db: DatabaseSync, uf: string) {
  const topics = new Map<string, { label: string; proposals: Set<string>; votes: Set<string> }>();
  for (const source of ['senado', 'camara'] as const) {
    const ids=profilesForState(db,uf).filter(item=>item.source===source).map(item=>item.externalId);
    if(!ids.length)continue;
    const marks=ids.map(()=>'?').join(',');
    const proposalThemes=db.prepare(`SELECT DISTINCT c.payload FROM proposal_authors x JOIN active_activity_publications aa ON aa.batch_id=x.batch_id JOIN legislative_complements c ON c.source=aa.source AND c.proposal_id=x.proposal_id JOIN active_complement_publications ac ON ac.batch_id=c.batch_id WHERE aa.source=? AND x.person_external_id IN (${marks}) AND c.kind='theme'`).all(source,...ids);
    const voteThemes=db.prepare(`SELECT DISTINCT c.payload FROM legislative_votes v JOIN active_legislative_publications al ON al.batch_id=v.batch_id JOIN legislative_complements c ON c.source=al.source AND c.deliberation_id=v.deliberation_id JOIN active_complement_publications ac ON ac.batch_id=c.batch_id WHERE al.source=? AND v.external_id IN (${marks}) AND c.kind='theme'`).all(source,...ids);
    for (const row of [...proposalThemes,...voteThemes]) {
      const item = JSON.parse(String(row.payload)) as LegislativeComplement;
      const label = item.label;
      if (!label) continue;
      const topic = topics.get(label) ?? { label, proposals: new Set<string>(), votes: new Set<string>() };
      if (item.proposalId) topic.proposals.add(`${source}:${item.proposalId}`);
      if (item.deliberationId) topic.votes.add(`${source}:${item.deliberationId}`);
      topics.set(label, topic);
    }
  }
  return [...topics.values()].map(item => ({ label: item.label, proposals: item.proposals.size, votes: item.votes.size })).sort((a, b) => b.proposals + b.votes - a.proposals - a.votes || a.label.localeCompare(b.label));
}
