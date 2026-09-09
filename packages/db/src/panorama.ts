import type { DatabaseSync } from 'node:sqlite';
import { distribution, type DataCoverage, type Distribution, type LegislativeSession, type Profile, type Source } from '@senadotracker/domain';

export interface HousePanorama {
  source: Source; year: number;
  roster: { parliamentarians: number; states: number; parties: number; coverage: DataCoverage };
  expenses: { distributionCents: Distribution; coverage: DataCoverage };
  cabinetPayroll: { distributionCents: Distribution; coverage: DataCoverage };
  presence: { distributionRatio: Distribution; coverage: DataCoverage };
  participation: { distributionRatio: Distribution; coverage: DataCoverage };
  activity: { proposals: number | null; rapporteurships: number | null; laws: number | null; coverage: DataCoverage };
  cabinet: { staffDistribution: Distribution; officeDistribution: Distribution; coverage: DataCoverage };
}

const period = (year:number) => ({ from:`${year}-01-01`, to:`${year}-12-31`, grain:'year' as const });

export function publishedExpenseYears(db: DatabaseSync, source: Source): number[] {
  return db.prepare('SELECT year FROM active_expense_publications WHERE source=? ORDER BY year DESC').all(source).map(row => Number(row.year));
}

export function publishedParticipationRows(db:DatabaseSync,source:Source,year:number,externalIds:string[]){if(!externalIds.length)return{};const marks=externalIds.map(()=>'?').join(',');const profiles=db.prepare(`SELECT p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=? AND p.external_id IN (${marks})`).all(source,...externalIds).map(row=>({externalId:String(row.external_id),profile:JSON.parse(String(row.payload)) as Profile}));const presenceBatch=db.prepare(`SELECT b.* FROM presence_batches b JOIN active_presence_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source,year);const sessions=presenceBatch?db.prepare('SELECT payload FROM legislative_sessions WHERE batch_id=? AND eligible=1').all(String(presenceBatch.id)).map(row=>JSON.parse(String(row.payload)) as LegislativeSession):[];const attendance=presenceBatch?db.prepare(`SELECT external_id,session_id FROM attendance WHERE batch_id=? AND external_id IN (${marks})`).all(String(presenceBatch.id),...externalIds):[];const attended=new Map<string,Set<string>>();for(const row of attendance){const id=String(row.external_id),set=attended.get(id)??new Set<string>();set.add(String(row.session_id));attended.set(id,set)}const legislativeBatch=db.prepare(`SELECT b.* FROM legislative_batches b JOIN active_legislative_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source,year);const deliberations=legislativeBatch?db.prepare(`SELECT external_id,date FROM deliberations WHERE batch_id=? AND json_extract(payload,'$.chamberBody')='PLEN'`).all(String(legislativeBatch.id)):[];const votes=legislativeBatch?db.prepare(`SELECT external_id,deliberation_id FROM legislative_votes WHERE batch_id=? AND external_id IN (${marks})`).all(String(legislativeBatch.id),...externalIds):[];const voted=new Map<string,Set<string>>();for(const row of votes){const id=String(row.external_id),set=voted.get(id)??new Set<string>();set.add(String(row.deliberation_id));voted.set(id,set)}const inExercise=(date:string,profile:Profile)=>(profile.exercises??[]).some(item=>date>=item.start.slice(0,10)&&(!item.end||date<=item.end.slice(0,10)));return Object.fromEntries(profiles.map(({externalId,profile})=>{const eligible=sessions.filter(item=>inExercise(item.date,profile));const eligibleVotes=deliberations.filter(item=>inExercise(String(item.date),profile));return[externalId,{year,presence:{availability:presenceBatch?String(presenceBatch.availability):'unavailable',numerator:presenceBatch?.availability==='available'?eligible.filter(item=>attended.get(externalId)?.has(item.externalId)).length:null,denominator:presenceBatch?.availability==='available'?eligible.length:null,note:presenceBatch?String(presenceBatch.note):'Lote de presença não publicado'},participation:{availability:eligibleVotes.length?'available':'unavailable',numerator:eligibleVotes.length?eligibleVotes.filter(item=>voted.get(externalId)?.has(String(item.external_id))).length:null,denominator:eligibleVotes.length||null,note:'Votações nominais plenárias durante períodos de exercício; não mede presença.'}}]}))}

export function publishedHousePanorama(db: DatabaseSync, source: Source, year: number): HousePanorama {
  if (!Number.isInteger(year) || year < 2008 || year > 2100) throw new Error('Ano inválido');
  const roster = db.prepare(`SELECT a.batch_id,b.published_at,count(*) parliamentarians,count(DISTINCT p.uf) states,count(DISTINCT p.party) parties
    FROM active_publications a JOIN publication_batches b ON b.id=a.batch_id JOIN profiles p ON p.batch_id=a.batch_id
    WHERE a.source=? GROUP BY a.batch_id,b.published_at`).get(source);
  const expenseBatch = db.prepare(`SELECT a.batch_id,b.published_at,b.record_count FROM active_expense_publications a
    JOIN expense_batches b ON b.id=a.batch_id WHERE a.source=? AND a.year=?`).get(source,year);
  const expenseRows = expenseBatch ? db.prepare(`SELECT sum(e.net_cents-e.refund_cents) value FROM expenses e
    JOIN active_expense_publications a ON a.batch_id=e.batch_id
    JOIN active_publications ap ON ap.source=e.source JOIN profiles p ON p.batch_id=ap.batch_id AND p.external_id=e.external_id
    WHERE e.source=? AND e.year=? GROUP BY p.person_id`).all(source,year) : [];
  const expenseValues = expenseRows.map(row=>Number(row.value));
  const costBatch = db.prepare(`SELECT a.batch_id,b.published_at,b.availability,b.note FROM active_expanded_cost_publications a
    JOIN expanded_cost_batches b ON b.id=a.batch_id WHERE a.source=? AND a.year=?`).get(source,year);
  const costRows = costBatch ? db.prepare(`SELECT sum(c.value_cents) value FROM expanded_costs c
    JOIN active_expanded_cost_publications a ON a.batch_id=c.batch_id
    JOIN active_publications ap ON ap.source=c.source JOIN profiles p ON p.batch_id=ap.batch_id AND p.external_id=c.external_id
    WHERE c.source=? AND a.year=? AND c.rubric='cabinet_payroll_gross' AND c.value_cents IS NOT NULL GROUP BY p.person_id`).all(source,year) : [];
  const costValues=costRows.map(row=>Number(row.value));
  const costPeriod=costBatch?db.prepare('SELECT min(competence) first,max(competence) last FROM expanded_costs WHERE batch_id=?').get(String(costBatch.batch_id)):null;
  const unavailable=(note:string):DataCoverage=>({availability:'unavailable',source,period:period(year),batchId:null,note,sampleSize:0});
  const profiles=db.prepare(`SELECT p.external_id,p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(source).map(row=>({externalId:String(row.external_id),profile:JSON.parse(String(row.payload)) as Profile}));
  const presenceBatch=db.prepare(`SELECT b.* FROM presence_batches b JOIN active_presence_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source,year);
  const sessions=presenceBatch?db.prepare('SELECT payload FROM legislative_sessions WHERE batch_id=? AND eligible=1').all(String(presenceBatch.id)).map(row=>JSON.parse(String(row.payload)) as LegislativeSession):[];
  const attended=presenceBatch?db.prepare('SELECT external_id,session_id FROM attendance WHERE batch_id=?').all(String(presenceBatch.id)):[];
  const attendedByPerson=new Map<string,Set<string>>();for(const row of attended){const id=String(row.external_id);const set=attendedByPerson.get(id)??new Set<string>();set.add(String(row.session_id));attendedByPerson.set(id,set)}
  const legislativeBatch=db.prepare(`SELECT b.* FROM legislative_batches b JOIN active_legislative_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source,year);
  const deliberations=legislativeBatch?db.prepare(`SELECT external_id,date FROM deliberations WHERE batch_id=? AND json_extract(payload,'$.chamberBody')='PLEN'`).all(String(legislativeBatch.id)):[];
  const votes=legislativeBatch?db.prepare('SELECT external_id,deliberation_id FROM legislative_votes WHERE batch_id=?').all(String(legislativeBatch.id)):[];
  const votesByPerson=new Map<string,Set<string>>();for(const row of votes){const id=String(row.external_id);const set=votesByPerson.get(id)??new Set<string>();set.add(String(row.deliberation_id));votesByPerson.set(id,set)}
  const inExercise=(date:string,profile:Profile)=>(profile.exercises??[]).some(item=>date>=item.start.slice(0,10)&&(!item.end||date<=item.end.slice(0,10)));
  const presenceValues:number[]=[];const participationValues:number[]=[];for(const {externalId,profile} of profiles){const eligible=sessions.filter(item=>inExercise(item.date,profile));if(presenceBatch?.availability==='available'&&eligible.length)presenceValues.push(eligible.filter(item=>attendedByPerson.get(externalId)?.has(item.externalId)).length/eligible.length);const eligibleVotes=deliberations.filter(item=>inExercise(String(item.date),profile));if(eligibleVotes.length)participationValues.push(eligibleVotes.filter(item=>votesByPerson.get(externalId)?.has(String(item.external_id))).length/eligibleVotes.length)}
  const activityBatches=db.prepare('SELECT batch_id FROM active_activity_publications WHERE source=?').all(source).map(row=>String(row.batch_id));
  const placeholders=activityBatches.map(()=>'?').join(',');const activity=activityBatches.length?{proposals:Number(db.prepare(`SELECT count(DISTINCT proposal_id||':'||person_external_id) n FROM proposal_authors WHERE batch_id IN (${placeholders}) AND person_external_id IS NOT NULL`).get(...activityBatches)!.n),rapporteurships:Number(db.prepare(`SELECT count(*) n FROM legislative_appointments WHERE batch_id IN (${placeholders}) AND kind='rapporteurship'`).get(...activityBatches)!.n),laws:Number(db.prepare(`SELECT count(DISTINCT l.proposal_id||':'||a.person_external_id) n FROM law_links l JOIN proposal_authors a ON a.batch_id=l.batch_id AND a.proposal_id=l.proposal_id WHERE l.batch_id IN (${placeholders}) AND a.person_external_id IS NOT NULL`).get(...activityBatches)!.n)}:null;
  const expanded=costBatch?db.prepare(`SELECT payload FROM expanded_costs WHERE batch_id=? AND rubric IN ('cabinet_staff_normal_rows','cabinet_offices')`).all(String(costBatch.batch_id)).map(row=>JSON.parse(String(row.payload)) as {rubric:string;count:number|null}):[];
  const staffValues=expanded.filter(item=>item.rubric==='cabinet_staff_normal_rows'&&item.count!==null).map(item=>item.count!);const officeValues=expanded.filter(item=>item.rubric==='cabinet_offices'&&item.count!==null).map(item=>item.count!);
  return {
    source, year,
    roster:{parliamentarians:Number(roster?.parliamentarians??0),states:Number(roster?.states??0),parties:Number(roster?.parties??0),coverage:roster?{availability:'available',source,period:{from:String(roster.published_at),to:String(roster.published_at),grain:'snapshot'},batchId:String(roster.batch_id),note:'Cadastro publicado ativo.',sampleSize:Number(roster.parliamentarians)}:unavailable('Não há cadastro publicado ativo.')},
    expenses:{distributionCents:distribution(expenseValues),coverage:expenseBatch?{availability:expenseValues.length?'available':'partial',source,period:period(year),batchId:String(expenseBatch.batch_id),note:'Somente parlamentares com despesas vinculadas no lote anual; ausências não entram como zero.',sampleSize:expenseValues.length}:unavailable('Não há lote anual de cota publicado.')},
    cabinetPayroll:{distributionCents:distribution(costValues),coverage:costBatch?{availability:String(costBatch.availability) as DataCoverage['availability'],source,period:{from:costPeriod?.first?String(costPeriod.first):null,to:costPeriod?.last?String(costPeriod.last):null,grain:'month'},batchId:String(costBatch.batch_id),note:String(costBatch.note),sampleSize:costValues.length}:unavailable('Não há lote de folha de gabinete publicado.')},
    presence:{distributionRatio:distribution(presenceValues),coverage:presenceBatch?{availability:String(presenceBatch.availability) as DataCoverage['availability'],source,period:period(year),batchId:String(presenceBatch.id),note:String(presenceBatch.note),sampleSize:presenceValues.length}:unavailable('Não há lote de presença publicado.')},
    participation:{distributionRatio:distribution(participationValues),coverage:legislativeBatch?{availability:participationValues.length?'available':'partial',source,period:period(year),batchId:String(legislativeBatch.id),note:'Votações nominais plenárias em períodos de exercício; não mede presença.',sampleSize:participationValues.length}:unavailable('Não há lote de votações nominais publicado.')},
    activity:{proposals:activity?.proposals??null,rapporteurships:activity?.rapporteurships??null,laws:activity?.laws??null,coverage:activityBatches.length?{availability:'available',source,period:{from:null,to:null,grain:'unknown'},batchId:activityBatches.join(','),note:'Contagens dos escopos de atividade publicados, sem equiparar autoria, relatoria e lei.',sampleSize:profiles.length}:unavailable('Não há lote de atividade legislativa publicado.')},
    cabinet:{staffDistribution:distribution(staffValues),officeDistribution:distribution(officeValues),coverage:costBatch?{availability:String(costBatch.availability) as DataCoverage['availability'],source,period:{from:costPeriod?.first?String(costPeriod.first):null,to:costPeriod?.last?String(costPeriod.last):null,grain:'month'},batchId:String(costBatch.batch_id),note:String(costBatch.note),sampleSize:staffValues.length}:unavailable('Não há lote de gabinete publicado.')}
  };
}
