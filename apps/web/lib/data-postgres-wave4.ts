import { webPostgresPool } from './postgres-pool';
import { averageObservedCents, periodForCompetencies, searchText } from '@senadotracker/domain';
import { buildPublicPerson } from './public-person';

type Available<T>={status:'available';data:T};
const repairMojibake=(value:any):any=>{const decode=(input:string)=>{const cp1252:any={'20ac':0x80,'201a':0x82,'192':0x83,'201e':0x84,'2026':0x85,'2020':0x86,'2021':0x87,'2c6':0x88,'2030':0x89,'160':0x8a,'2039':0x8b,'152':0x8c,'17d':0x8e,'2018':0x91,'2019':0x92,'201c':0x93,'201d':0x94,'2022':0x95,'2013':0x96,'2014':0x97,'2dc':0x98,'2122':0x99,'161':0x9a,'203a':0x9b,'153':0x9c,'17e':0x9e,'178':0x9f};const bytes=Uint8Array.from([...input].map(ch=>{const n=ch.charCodeAt(0);return n<=255?n:(cp1252[n.toString(16)]??63)}));return new TextDecoder('utf-8').decode(bytes)};if(typeof value==='string'&&!/https?:\/\//.test(value)&&/(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00c3\u0192|\u00c3\u201a)/.test(value)){let out=value;for(let i=0;i<3&&/(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00c3\u0192|\u00c3\u201a)/.test(out);i++){const next=decode(out);if(next===out)break;out=next}return out}if(Array.isArray(value))return value.map(repairMojibake);if(value&&typeof value==='object'){const out:any={};for(const [k,v] of Object.entries(value))out[k]=repairMojibake(v);return out}return value};
const ok=<T>(data:T):Available<T>=>({status:'available',data:repairMojibake(data)});
import { summarizeSeats } from './hemicycle.ts';
const pool=()=>webPostgresPool();
const sourceOf=(s:string)=>s==='senado'||s==='camara'?s:'camara';
const canonicalBatch=(id:any)=>id==null?null:String(id).split(':').at(-1);
const annual=(year:number)=>({from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'});
const READ_CACHE_TTL_MS=Number(process.env.DATA_CACHE_TTL_MS??120_000);
const readCache=new Map<string,{expires:number;value:Promise<any>}>();
function memoRead<T>(key:string,loader:()=>Promise<T>):Promise<T>{
  const now=Date.now(),hit=readCache.get(key);
  if(hit&&hit.expires>now)return hit.value as Promise<T>;
  const value=Promise.resolve().then(loader).catch(error=>{readCache.delete(key);throw error;});
  if(readCache.size>=300)readCache.delete(readCache.keys().next().value!);
  readCache.set(key,{expires:now+READ_CACHE_TTL_MS,value});
  return value;
}
const idsKey=(ids:string[])=>[...new Set(ids.map(String))].sort().join(',');
const coverage=(source:any,year:number,n:number,batchId:any=null,note='ObservaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes publicadas no PostgreSQL.')=>({availability:n?'available':'unavailable',source,period:annual(year),batchId:batchId==null?null:String(batchId),note,sampleSize:n});
async function profiles(source?:string){
  return memoRead(`profiles:${source??'all'}`,async()=>{
    const values:any[]=[]; const where=source?`AND a.source=$1`:''; if(source)values.push(source);
    const q=await pool().query(`SELECT a.source,p.person_id,p.external_id,p.name,p.uf,p.party,p.payload,p.batch_id,b.published_at FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id JOIN civica.publication_batches b ON b.id=p.batch_id WHERE TRUE ${where} ORDER BY p.search_name,p.external_id`,values);
    return q.rows.map(r=>{const payload=r.payload&&typeof r.payload==='object'?r.payload:{};return {...payload,source:String(r.source),personId:String(r.person_id),externalId:String(r.external_id),name:String(r.name??payload.name??''),uf:String(r.uf??payload.uf??''),party:String(r.party??payload.party??''),batchId:String(r.batch_id),publishedAt:r.published_at?new Date(r.published_at).toISOString():undefined} as any;});
  });
}
async function years(source?:string){return memoRead(`years:${source??'all'}`,async()=>{const q=await pool().query(`SELECT DISTINCT year::int FROM civica.active_expense_publications ${source?'WHERE source=$1':''} ORDER BY year DESC`,source?[source]:[]);return q.rows.map(r=>Number(r.year));});}
// Keep percentile semantics identical to the SQLite contract.  The legacy
// implementation uses linear interpolation between adjacent observations;
// selecting the lower bucket (floor) shifts p10/p90/median for small samples.
function distribution(values:number[]){const v=values.filter(Number.isFinite).sort((a,b)=>a-b); if(!v.length)return {count:0,min:null,p10:null,p25:null,median:null,p75:null,p90:null,max:null}; const at=(p:number)=>{const index=(v.length-1)*p,lower=Math.floor(index),upper=Math.ceil(index);if(lower===upper)return v[lower]!;return v[lower]!+(v[upper]!-v[lower]!)*(index-lower);}; return {count:v.length,min:v[0],p10:at(.1),p25:at(.25),median:at(.5),p75:at(.75),p90:at(.9),max:v[v.length-1]};}
function ratioMap(rows:any[],key:string){return new Map(rows.map(r=>[String(r.id),{availability:Number(r.denominator)>0?'available':'unavailable',numerator:Number(r.numerator),denominator:Number(r.denominator),note:key==='presence'?'PresenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a oficial publicada.':'Votos nominais publicados.'}]));}
const profileView=(p:any,metrics:any={})=>buildPublicPerson(p,metrics);
// List contracts intentionally expose the historical public-person subset.
// Keep enrichment in buildPublicPerson, then project the exact list DTO so
// internal hydration fields cannot leak into hashes/UI.
const housePersonView=(p:any,metrics:any={})=>{const v=profileView(p,metrics);return {
  personId:v.personId,batchId:v.batchId,publishedAt:v.publishedAt,source:v.source,externalId:v.externalId,
  name:v.name,fullName:p.source==='senado'?v.fullName:null,uf:v.uf,party:v.party,photoUrl:v.photoUrl,officialUrl:v.officialUrl,
  observedAt:v.observedAt,rawId:v.rawId,historyAvailability:v.historyAvailability,mandates:v.mandates,
  exercises:v.exercises,parties:v.parties,events:v.events,expenseCents:v.expenseCents,expenseYear:v.expenseYear,
  annualCabinetCents:v.annualCabinetCents,salaryCents:v.salaryCents,salaryMonths:v.salaryMonths,
  totalCostCents:v.totalCostCents,participation:v.participation,staff:v.staff,cabinetFinancialCents:v.cabinetFinancialCents,
  cabinetPeriod:v.cabinetPeriod,proposalCount:v.proposalCount,activityYear:v.activityYear};};
// Legislative overview predates the richer profile DTO.  Preserve its flat
// participation metric and intentionally omit profile-only cost/history
// projections that were never part of this list contract.
const overviewPersonView=(p:any,metrics:any={})=>{
  const v=profileView(p,metrics);
  const {annualCabinetCents:_,assetYear:__,assetsCents:___,costMonths:____,costPeriod:_____,fullName:______,monthlyCostCents:_______,proposalCount:________,proposals:_________,rapporteurships:__________,role:___________,salaryCents:____________,salaryMonths:_____________,situation:______________,totalCostCents:_______________,...rest}=v as any;
  return {...rest,fullName:null,participation:metrics.participation??v.participation?.participation??null};
};
const projectOverviewItem=(item:any)=>{
  const {annualCabinetCents:_,assetYear:__,assetsCents:___,costMonths:____,costPeriod:_____,monthlyCostCents:______,proposals:________,rapporteurships:_________,role:__________,situation:_____________,...rest}=item as any;
  return {...rest,fullName:null,participation:item.participation?.participation??item.participation??null};
};
async function expenseMap(source:string,year:number){return memoRead(`expenseMap:${source}:${year}`,async()=>{const q=await pool().query(`SELECT e.external_id::text id,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value,count(DISTINCT e.month)::int months FROM civica.expenses e JOIN civica.active_expense_publications a ON a.batch_id=e.batch_id AND a.source=e.source WHERE e.source=$1 AND e.year=$2 GROUP BY e.external_id`,[source,year]);return new Map(q.rows.map(r=>[String(r.id),{value:Number(r.value),months:Number(r.months)}]));});}
async function activityMap(source:string,year?:number){
  return memoRead(`activityMap:${source}:${year??'all'}`,async()=>{
    const params:any[]=[source];
    const yearClause=year==null?'':" AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))";
    if(year!=null)params.push(year);
    const q=await pool().query(`SELECT a.person_external_id::text id,count(DISTINCT a.proposal_id)::int value
    FROM civica_poc.proposal_authors a
    JOIN civica_poc.proposition_batches pb ON pb.id=a.batch_id AND pb.source=a.source
    JOIN civica.active_activity_publications ap ON ap.source=a.source
      AND (ap.scope=pb.scope OR (a.source='senado' AND pb.scope='current-roster-person-activity'))
    JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
    WHERE a.source=$1 AND a.person_external_id IS NOT NULL
      AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' ${yearClause}
    GROUP BY a.person_external_id`,params);
    return new Map(q.rows.map(r=>[String(r.id),Number(r.value)]));
  });
}
async function rapporteurMap(source:string,year?:number){
  return memoRead(`rapporteurMap:${source}:${year??'all'}`,async()=>{
    const params:any[]=[source];
  // Câmara's `ultimoStatus.data` is a status/update date, not a
  // designation date. Annual relatoria counts use the canonical matter year.
  const yearClause=year==null?'':" AND ((x.source='camara' AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2)) OR x.source='senado' AND (x.payload->>'start')::date >= make_date($2,1,1) AND (x.payload->>'start')::date < make_date($2+1,1,1)))";
  if(year!=null)params.push(year);
  const q=await pool().query(`SELECT x.person_external_id::text id,count(DISTINCT x.payload->>'proposalId')::int value FROM civica.legislative_appointments x JOIN civica.active_activity_publications ap ON ap.source=x.source AND ap.batch_id=x.batch_id JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.source=$1 AND x.kind='rapporteurship' AND x.payload->>'proposalId' IS NOT NULL ${yearClause} GROUP BY x.person_external_id`,params);
    return new Map(q.rows.map(r=>[String(r.id),Number(r.value)]));
  });
}
async function topicSummary(source:string|undefined,ids:string[],year:number){
  const collapse=(rows:any[],universeTotal=0)=>{const classified=rows.reduce((n,r)=>n+Number(r.proposals),0);const sorted=rows.map(r=>({label:String(r.label),count:Number(r.proposals),proposals:Number(r.proposals),votes:0}));const top=sorted.slice(0,6),other=sorted.slice(6).reduce((n,r)=>n+r.proposals,0);const items=other?[{label:'Outros',count:other,proposals:other,votes:0},...top]:top;const least=sorted.at(-1);return {items,total:classified,universeTotal,least:least?{label:least.label,count:least.count,share:classified?least.count/classified:0}:null};};
  if(!ids.length){
    if(!source)return {items:[],total:0,universeTotal:0,least:null};
    if(source==='senado'){
      const q=await pool().query(`WITH universe AS (
          SELECT DISTINCT p.external_id proposal_id FROM civica_poc.proposals p
          JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id
          WHERE p.source='senado' AND p.presented_at>=make_date($1,1,1) AND p.presented_at<make_date($1+1,1,1)
          UNION SELECT DISTINCT d.payload->>'proposalId' FROM civica_votes_presence_poc.deliberations d
          WHERE d.source='senado' AND d.payload->>'proposalId' IS NOT NULL AND d.date::date>=make_date($1,1,1) AND d.date::date<make_date($1+1,1,1)
        ), themed AS (
          SELECT DISTINCT ON (x.proposal_id) x.proposal_id,x.label
          FROM (
            SELECT t.proposal_id,t.payload->>'label' label,t.external_key
            FROM civica_poc.proposal_detail_atoms t
            JOIN universe u ON u.proposal_id=t.proposal_id
            WHERE t.source='senado' AND t.kind='theme' AND NULLIF(t.payload->>'label','') IS NOT NULL
            UNION ALL
            SELECT c.proposal_id,c.payload->>'label' label,c.external_key
            FROM civica.legislative_complements c
            JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
            JOIN universe u ON u.proposal_id=c.proposal_id
            WHERE c.source='senado' AND c.kind='theme' AND NULLIF(c.payload->>'label','') IS NOT NULL
          ) x
          ORDER BY x.proposal_id,x.external_key
        ) SELECT label,count(*)::int proposals,(SELECT count(*) FROM universe)::int universe_total FROM themed GROUP BY label ORDER BY proposals DESC,label`,[year]);
      return collapse(q.rows,Number(q.rows[0]?.universe_total??0));
    }
    const q=await pool().query(`WITH universe AS (
        SELECT DISTINCT p.external_id proposal_id FROM civica_poc.proposals p
        JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id
        WHERE p.source=$1 AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))
      ), themed AS (
        SELECT DISTINCT ON (c.proposal_id) c.proposal_id,c.payload->>'label' label
        FROM civica.legislative_complements c
        JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
        JOIN universe u ON u.proposal_id=c.proposal_id
        WHERE c.source=$1 AND c.kind='theme' AND NULLIF(c.payload->>'label','') IS NOT NULL
        ORDER BY c.proposal_id,c.external_key
      ) SELECT label,count(*)::int proposals,(SELECT count(*) FROM universe)::int universe_total FROM themed GROUP BY label ORDER BY proposals DESC,label`,[source,year]);
    return collapse(q.rows,Number(q.rows[0]?.universe_total??0));
  }
  // SQLite uses the published theme complements (the first official theme
  // per matter), then rolls every category after the first six into
  // "Outros".  Reading proposal_detail_atoms here included enrichment rows
  // from unrelated batches and doubled the public universe.
  const params:any[]=[ids,year];
  const sourceClause=source?'AND a.source=$3':'';
  if(source)params.push(source);
    const q=await pool().query(`WITH authored AS (
      SELECT DISTINCT a.source,a.proposal_id
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE a.person_external_id=ANY($1::text[])
        AND NULLIF(a.party,'') IS NOT NULL
        AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))
        AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' ${sourceClause}
    ), themed AS (
      -- CÃ¢mara themes are published as legislative complements.  Senado's
      -- canonical matter publication stores the same official theme rows in
      -- proposal_detail_atoms; using only complements silently dropped the
      -- historical Senate topic universe from party pages.
      SELECT DISTINCT c.source,c.proposal_id,c.payload->>'label' label
      FROM civica.legislative_complements c
      JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
      JOIN authored u ON u.source=c.source AND u.proposal_id=c.proposal_id
      WHERE c.source='camara' AND c.kind='theme' AND c.proposal_id IS NOT NULL
        AND NULLIF(c.payload->>'label','') IS NOT NULL
      UNION
      SELECT DISTINCT t.source,t.proposal_id,t.payload->>'label' label
      FROM civica_poc.proposal_detail_atoms t
      JOIN authored u ON u.source=t.source AND u.proposal_id=t.proposal_id
      WHERE t.source='senado' AND t.kind='theme' AND t.proposal_id IS NOT NULL
        AND NULLIF(t.payload->>'label','') IS NOT NULL
    )
    SELECT label,count(*)::int proposals FROM themed GROUP BY label ORDER BY proposals DESC,label`,params);
  const classified=q.rows.reduce((n,r)=>n+Number(r.proposals),0);
  const sorted=q.rows.map(r=>({label:String(r.label),count:Number(r.proposals),proposals:Number(r.proposals),votes:0}));
  const top=sorted.slice(0,6),other=sorted.slice(6).reduce((n,r)=>n+r.proposals,0);
  if(other)top.push({label:'Outros',count:other,proposals:other,votes:0});
  // Party detail exposes the complete topic distribution.  The six-plus-
  // Outros projection is only the house/listing dashboard presentation.
  const items=ids.length?sorted:top;
  const least=sorted.at(-1); return {items,total:classified,universeTotal:0,least:least?{label:least.label,count:least.count,share:classified?least.count/classified:0}:null};
}

// State representation uses the legacy state-topic contract: every topic is
// returned with separate proposal/vote cardinalities.  The generic topic
// summary above intentionally collapses to the top six buckets for landing
// pages, which is the wrong projection for this contract.
async function stateTopicSummary(selected:any[]){
  const byLabel=new Map<string,{label:string;proposals:Set<string>;votes:Set<string>}>();
  const add=(label:any,kind:'proposal'|'vote',id:any)=>{
    const text=String(label??'').trim(); if(!text)return;
    const key=String(id??''); const row=byLabel.get(text)??{label:text,proposals:new Set<string>(),votes:new Set<string>()};
    row[kind==='proposal'?'proposals':'votes'].add(key); byLabel.set(text,row);
  };
  for(const source of ['senado','camara'] as const){
    const ids=selected.filter(p=>p.source===source).map(p=>String(p.externalId)).filter(Boolean);
    if(!ids.length)continue;
    const proposal=await pool().query(`SELECT DISTINCT c.proposal_id::text id,c.payload->>'label' label
      FROM civica_poc.proposal_authors x
      JOIN civica_poc.active_publications aa ON aa.batch_id=x.batch_id AND aa.source=x.source
      JOIN civica.legislative_complements c ON c.source=aa.source AND c.proposal_id=x.proposal_id
      JOIN civica.active_complement_publications ac ON ac.batch_id=c.batch_id AND ac.source=c.source
      WHERE aa.source=$1 AND x.person_external_id=ANY($2::text[]) AND c.kind='theme'`,[source,ids]);
    for(const r of proposal.rows)add(r.label,'proposal',`${source}:${r.id}`);
    const votes=await pool().query(`SELECT DISTINCT c.deliberation_id::text id,c.payload->>'label' label
      FROM civica.legislative_votes v
      JOIN civica.active_legislative_publications al ON al.batch_id=v.batch_id AND al.source=v.source
      JOIN civica.legislative_complements c ON c.source=al.source AND c.deliberation_id=v.deliberation_id
      JOIN civica.active_complement_publications ac ON ac.batch_id=c.batch_id AND ac.source=c.source
      WHERE al.source=$1 AND v.external_id=ANY($2::text[]) AND c.kind='theme'`,[source,ids]);
    for(const r of votes.rows)add(r.label,'vote',`${source}:${r.id}`);
  }
  return [...byLabel.values()].map(r=>({label:r.label,proposals:r.proposals.size,votes:r.votes.size}))
    .sort((a,b)=>b.proposals+b.votes-a.proposals-a.votes||a.label.localeCompare(b.label));
}
async function costMap(source:string,year:number){return memoRead(`costMap:${source}:${year}`,async()=>{const q=await pool().query(`SELECT c.external_id::text id,sum(c.value_cents)::bigint value,count(DISTINCT c.competence)::int months,max(c.competence)::text period FROM civica.expanded_costs c JOIN civica.active_expanded_cost_publications a ON a.batch_id=c.batch_id AND a.source=c.source WHERE c.source=$1 AND left(c.competence,4)::int=$2 AND c.nature='expense' AND c.rubric='cabinet_payroll_gross' GROUP BY c.external_id`,[source,year]);return new Map(q.rows.map(r=>[String(r.id),{value:Number(r.value),months:Number(r.months),period:r.period?String(r.period):null}]));});}
async function senateFinancialMap(source:string,year:number,ids:string[]){
  if(source!=='senado'||!ids.length)return new Map<string,{value:number;period:string|null}>();
  return memoRead(`senateFinancialMap:${source}:${year}:${idsKey(ids)}`,async()=>{const q=await pool().query(`
    WITH active AS (
      SELECT e.external_id::text id,max(e.competence)::text competence
        FROM civica.expanded_costs e
        JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id
       WHERE e.source='senado' AND left(e.competence,4)::int=$1 AND e.nature='expense'
         AND e.external_id=ANY($2::text[])
       GROUP BY e.external_id
    )
    SELECT e.external_id::text id,active.competence,sum(e.value_cents)::bigint value
      FROM civica.expanded_costs e
      JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id
      JOIN active ON active.id=e.external_id::text AND active.competence=e.competence
     WHERE e.source='senado' AND e.nature='expense'
     GROUP BY e.external_id,active.competence`,[year,ids]);
  return new Map(q.rows.map(r=>[String(r.id),{value:Number(r.value),period:String(r.competence)}]));});
}
async function assetMap(personIds:string[]){
  if(!personIds.length)return new Map<string,any>();
  const q=await pool().query(`SELECT c.person_id::text id,c.year::int AS election_year,c.sequence_id::text sequence_id,c.batch_id::text batch_id,sum(a.value_cents)::bigint value,count(*)::int entries,count(DISTINCT a.asset_id)::int assets
    FROM civica_elections_poc.candidacies c
    JOIN civica_elections_poc.electoral_assets a ON a.batch_id=c.batch_id AND a.sequence_id=c.sequence_id
    JOIN civica_elections_poc.active_electoral_publications ap ON ap.batch_id=c.batch_id
    JOIN civica_elections_poc.electoral_batches eb ON eb.id=c.batch_id
    WHERE c.person_id=ANY($1::text[]) AND c.match_status='confirmed' AND eb.availability<>'unavailable'
    GROUP BY c.person_id,c.year,c.sequence_id,c.batch_id
    ORDER BY c.year DESC`,[personIds]);
  const map=new Map<string,any>();
  for(const row of q.rows){const id=String(row.id);if(map.has(id)||Number(row.entries)!==Number(row.assets))continue;map.set(id,{value:Number(row.value),year:Number(row.election_year)});}
  return map;
}
export async function participation(source:string,year:number,ids:string[]){
  if(!ids.length)return {presence:new Map<string,any>(),participation:new Map<string,any>()};
  return memoRead(`participation:${source}:${year}:${idsKey(ids)}`,async()=>{const [presenceRows,activeRows,sessionRows,attendanceRows,deliberationRows,voteRows,profileRows]=await Promise.all([
    pool().query(`SELECT external_id::text id,days_present::int numerator,days_total::int denominator FROM civica_votes_presence_poc.official_presence WHERE year=$1 AND external_id=ANY($2::text[])`,[year,ids]),
    pool().query(`SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1`,[source,year]),
    pool().query(`SELECT external_id::text id,date::text FROM civica_votes_presence_poc.sessions WHERE source=$1 AND batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND eligible=true AND date::date <= make_date($2,12,31)`,[source,year]),
    pool().query(`SELECT external_id::text id,session_id::text FROM civica_votes_presence_poc.attendance WHERE source=$1 AND batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND external_id=ANY($3::text[])`,[source,year,ids]),
    pool().query(`SELECT d.external_id::text id,d.date::text,d.payload FROM civica_votes_presence_poc.deliberations d WHERE d.source=$1 AND d.batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND d.year=$2 AND d.date::date <= make_date($2,12,31) AND coalesce(d.payload->>'chamberBody','')='PLEN' AND EXISTS (SELECT 1 FROM civica_votes_presence_poc.nominal_deliberations n WHERE n.batch_id=d.batch_id AND n.deliberation_id=d.external_id)`,[source,year]),
    pool().query(`SELECT v.external_id::text id,v.deliberation_id::text deliberation_id,v.payload FROM civica_votes_presence_poc.votes v WHERE v.source=$1 AND v.batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND v.external_id=ANY($3::text[])`,[source,year,ids]),
    pool().query(`SELECT external_id::text id,payload FROM civica.profiles p JOIN civica.active_publications a ON a.source=$1 AND a.batch_id=p.batch_id WHERE p.external_id=ANY($2::text[])`,[source,ids]),
  ]);
  const profileMap=new Map(profileRows.rows.map(r=>[String(r.id),r.payload&&typeof r.payload==='object'?r.payload:{}]));
  const inExercise=(id:string,date:string)=>{const p:any=profileMap.get(id)||{};const xs=Array.isArray(p.exercises)?p.exercises:[];return xs.some((x:any)=>date.slice(0,10)>=String(x?.start??'').slice(0,10)&&(!x?.end||date.slice(0,10)<=String(x.end).slice(0,10)));};
  const presence=new Map<string,any>();
  if(source==='camara') for(const r of presenceRows.rows) presence.set(String(r.id),{availability:Number(r.denominator)>0?'available':'unavailable',numerator:Number(r.numerator),denominator:Number(r.denominator),note:'PresenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a oficial publicada.'});
  else if(activeRows.rows.length){const sessions=new Map<string,string>();for(const r of sessionRows.rows)sessions.set(String(r.id),String(r.date));const attended=new Map<string,Set<string>>();for(const r of attendanceRows.rows){const set=attended.get(String(r.id))??new Set<string>();set.add(String(r.session_id));attended.set(String(r.id),set)}for(const id of ids){const eligible=[...sessions.entries()].filter(([,date])=>inExercise(id,date));const days=new Map<string,boolean>();for(const [sid,date] of eligible)days.set(date.slice(0,10),Boolean(days.get(date.slice(0,10)))||Boolean(attended.get(id)?.has(sid)));const denominator=days.size;const numerator=[...days.values()].filter(Boolean).length;presence.set(id,{availability:denominator?'available':'unavailable',numerator:denominator?numerator:null,denominator:denominator||null,note:'PresenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a oficial publicada.'});}}
  const deliberations=new Map(deliberationRows.rows.map(r=>[String(r.id),r]));
  const voted=new Map<string,Set<string>>();
  for(const r of voteRows.rows){const vote=String(r.payload?.vote??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(!['sim','nao','abstencao','votou','secreto','obstrucao'].includes(vote))continue;const set=voted.get(String(r.id))??new Set<string>();set.add(String(r.deliberation_id));voted.set(String(r.id),set);}
  const participationMap=new Map<string,any>();
  for(const id of ids){const eligible=[...deliberations.values()].filter(r=>inExercise(id,String(r.date)));const numerator=eligible.filter(r=>voted.get(id)?.has(String(r.id))).length;
    // The legacy contract treats a person with no eligible nominal vote as
    // unavailable (it is not a zero score).  Keep that distinction for the
    // shared coverage universe used by home/rankings/party cards.
    const unavailable=!eligible.length || numerator===0;
    participationMap.set(id,{availability:unavailable?'unavailable':'available',numerator:unavailable?null:numerator,denominator:unavailable?null:eligible.length,note:'VotaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes nominais plenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rias durante perÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­odos de exercÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­cio; nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o mede presenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a.'});}
  return {presence,participation:participationMap};});
}
// The profile page needs one person's participation metric, not the complete
// house-wide attendance universe.  Câmara's official presence is already a
// single-row publication and its nominal-vote denominator can be reduced to
// the active deliberations plus that person's votes.  Keeping this narrow
// resolver avoids loading Senado-specific sessions/attendance and all-person
// profile payloads on every Câmara profile request.
export async function personParticipation(source:string,year:number,id:string,profilePayload:any={}){
  return memoRead(`personParticipation:${source}:${year}:${id}`,async()=>{
    const [presenceRows,deliberationRows,voteRows]=await Promise.all([
      pool().query(`SELECT days_present::int numerator,days_total::int denominator FROM civica_votes_presence_poc.official_presence WHERE year=$1 AND external_id=$2 LIMIT 1`,[year,id]),
      pool().query(`SELECT d.external_id::text id,d.date::text FROM civica_votes_presence_poc.deliberations d JOIN civica_votes_presence_poc.active_legislative al ON al.source=d.source AND al.batch_id=d.batch_id AND al.year=$2 WHERE d.source=$1 AND d.year=$2 AND d.date::date <= make_date($2,12,31) AND coalesce(d.payload->>'chamberBody','')='PLEN' AND EXISTS (SELECT 1 FROM civica_votes_presence_poc.nominal_deliberations n WHERE n.batch_id=d.batch_id AND n.deliberation_id=d.external_id)`,[source,year]),
      pool().query(`SELECT v.deliberation_id::text deliberation_id,v.payload FROM civica_votes_presence_poc.votes v JOIN civica_votes_presence_poc.active_legislative al ON al.source=v.source AND al.batch_id=v.batch_id AND al.year=$2 WHERE v.source=$1 AND v.external_id=$3`,[source,year,id]),
    ]);
    const exercises=Array.isArray(profilePayload?.exercises)?profilePayload.exercises:[];
    const inExercise=(date:string)=>{const day=date.slice(0,10);return exercises.some((x:any)=>day>=String(x?.start??'').slice(0,10)&&(!x?.end||day<=String(x.end).slice(0,10)));};
    const eligible=deliberationRows.rows.filter(row=>inExercise(String(row.date)));
    const voted=new Set<string>();
    for(const row of voteRows.rows){const vote=String(row.payload?.vote??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(['sim','nao','abstencao','votou','secreto','obstrucao'].includes(vote))voted.add(String(row.deliberation_id));}
    const numerator=eligible.filter(row=>voted.has(String(row.id))).length;
    const unavailable=!eligible.length||numerator===0;
    return {
      presence: source==='camara'&&presenceRows.rows[0]
        ? {availability:Number(presenceRows.rows[0].denominator)>0?'available':'unavailable',numerator:Number(presenceRows.rows[0].numerator),denominator:Number(presenceRows.rows[0].denominator),note:'Presença oficial publicada.'}
        : {availability:'unavailable',numerator:null,denominator:null,note:'Presença estruturada não publicada para este parlamentar.'},
      participation:{availability:unavailable?'unavailable':'available',numerator:unavailable?null:numerator,denominator:unavailable?null:eligible.length,note:'Votações nominais plenárias durante períodos de exercício; não mede presença.'},
    };
  });
}
async function staffMap(source:string,year:number){const q=await pool().query(`SELECT external_id::text id,count(DISTINCT staff_key)::int staff FROM civica.cabinet_staff WHERE source=$1 AND (ended_at IS NULL OR extract(year from ended_at::timestamp)::int >= $2) GROUP BY external_id`,[source,year]);return new Map(q.rows.map(r=>[String(r.id),Number(r.staff)]));}
async function functionalStaffMap(source:string,year:number,ids:string[]=[]){
  return memoRead(`functionalStaffMap:${source}:${year}:${idsKey(ids)}`,async()=>{const q=await pool().query(`SELECT p.external_id::text id,count(DISTINCT f.staff_key)::int staff
    FROM civica.profiles p JOIN civica.active_publications ap ON ap.batch_id=p.batch_id
    LEFT JOIN civica.functional_staff_assignments f ON f.source=ap.source AND f.external_id=p.external_id
      AND f.match_status='confirmed' AND (f.ended_at IS NULL OR left(f.ended_at,4)::int >= $2)
      AND EXISTS (SELECT 1 FROM civica.active_staff_snapshot_publications asp WHERE asp.source=f.source AND asp.batch_id=f.batch_id)
    WHERE ap.source=$1 ${ids.length?'AND p.external_id=ANY($3::text[])':''}
    GROUP BY p.external_id`,ids.length?[source,year,ids]:[source,year]);
  return new Map(q.rows.map(r=>[String(r.id),Number(r.staff)]));});
}
async function cabinetBudgetMap(source:string,year:number){
  if(source!=='camara') return new Map<string,{value:number;months:number}>();
  return memoRead(`cabinetBudgetMap:${source}:${year}`,async()=>{const q=await pool().query(`SELECT b.external_id::text id,sum(b.spent_cents)::bigint value,count(DISTINCT b.month)::int months
    FROM civica.cabinet_monthly_budgets b
    JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.batch_id
    WHERE b.source=$1 AND b.year=$2 AND b.spent_cents IS NOT NULL
    GROUP BY b.external_id`,[source,year]);
  return new Map(q.rows.map(r=>[String(r.id),{value:Number(r.value),months:Number(r.months)}]));});
}
async function cabinetPanorama(source:string,year:number){
  const staffRows=await pool().query(`SELECT f.external_id::text id,count(DISTINCT f.staff_key)::int value
    FROM civica.functional_staff_assignments f JOIN civica.active_staff_snapshot_publications a ON a.source=f.source AND a.batch_id=f.batch_id
    WHERE f.source=$1 AND f.match_status='confirmed' GROUP BY f.external_id`,[source]);
  const staffValues=staffRows.rows.map(r=>Number(r.value));
  const staffTotal=staffValues.reduce((a,b)=>a+b,0);
  if(source==='camara'){
    const q=await pool().query(`SELECT b.external_id::text id,sum(b.spent_cents)::bigint value
      FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.batch_id
      WHERE b.source=$1 AND b.year=$2 AND b.spent_cents IS NOT NULL GROUP BY b.external_id`,[source,year]);
    const values=q.rows.map(r=>Number(r.value));
    return {source,period:String(year),staff:distribution(staffValues),staffTotal,staffMean:staffValues.length?staffTotal/staffValues.length:null,financial:distribution(values),financialMean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,sampleSize:values.length,kind:'budget_spent'};
  }
    const q=await pool().query(`SELECT e.external_id::text id,sum(e.value_cents)::bigint value,max(e.competence)::text period
    FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id
    WHERE e.source=$1 AND left(e.competence,4)::int=$2 AND e.nature='expense'
      AND e.competence=(SELECT max(e2.competence) FROM civica.expanded_costs e2 JOIN civica.active_expanded_cost_publications a2 ON a2.source=e2.source AND a2.batch_id=e2.batch_id WHERE e2.source=$1 AND left(e2.competence,4)::int=$2 AND e2.nature='expense')
    GROUP BY e.external_id`,[source,year]);
  const values=q.rows.map(r=>Number(r.value));
  const competence=values.length?String(q.rows[0]?.period??''):null;
  return {source,period:competence,staff:distribution(staffValues),staffTotal,staffMean:staffValues.length?staffTotal/staffValues.length:null,financial:distribution(values),financialMean:values.length?values.reduce((a,b)=>a+b,0)/values.length:null,sampleSize:values.length,kind:'identified_payroll'};
}
function emptyDistribution(){return distribution([]);}
async function activitySummary(source:string){
  return memoRead(`activitySummary:${source}`,async()=>{const batches=(await pool().query(`SELECT batch_id FROM civica_poc.active_publications WHERE source=$1`,[source])).rows.map(r=>String(r.batch_id));
  const activityBatches=(await pool().query(`SELECT batch_id FROM civica.active_activity_publications WHERE source=$1`,[source])).rows.map(r=>String(r.batch_id));
  if(!batches.length&&!activityBatches.length)return {proposals:0,received:0,backlog:0,rapporteurships:0,laws:0};
  const marks=batches.map((_,i)=>`$${i+1}`).join(','), activityMarks=activityBatches.map((_,i)=>`$${i+1}`).join(','), year=2026;
  const [p,annualP,r,b,a,annualA,l]=await Promise.all([
    pool().query(`SELECT count(DISTINCT a.proposal_id)::int n
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.proposition_batches pb ON pb.id=a.batch_id AND pb.source=a.source
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE a.source=$1
        AND (pb.scope IN (SELECT scope FROM civica.active_activity_publications WHERE source=$1)
             OR (a.source='senado' AND pb.scope='current-roster-person-activity'))
        AND a.person_external_id IS NOT NULL
        AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios'`,[source]),
    pool().query(`SELECT count(DISTINCT a.proposal_id)::int n
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.proposition_batches pb ON pb.id=a.batch_id AND pb.source=a.source
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE a.source=$1 AND a.person_external_id IS NOT NULL
        AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))
        AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios'
        AND (pb.scope IN (SELECT scope FROM civica.active_activity_publications WHERE source=$1)
             OR (a.source='senado' AND pb.scope='current-roster-person-activity'))`,[source,year]),
    pool().query(`SELECT count(DISTINCT external_id)::int n FROM civica_poc.proposals WHERE batch_id IN (${marks}) AND presented_at >= make_date($${batches.length+1},1,1) AND presented_at < make_date($${batches.length+1}+1,1,1)`,[...batches,year]),
    source==='camara'
      ? pool().query(`SELECT count(DISTINCT external_id)::int n FROM civica_poc.proposals p WHERE p.batch_id IN (${marks}) AND lower(coalesce(p.status,'')) LIKE '%tramit%'`,batches)
      : pool().query(`SELECT COALESCE((reconciliation_json #>> '{summary,backlog}')::int,0)::int n FROM civica.ingestion_runs WHERE id='pg-house-operations:senado:2026' AND source='senado'`,[]),
    pool().query(`SELECT count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica.active_activity_publications a ON a.source=x.source AND a.batch_id=x.batch_id WHERE x.source=$1 AND x.kind='rapporteurship' AND x.payload->>'proposalId' IS NOT NULL`,[source]),
    pool().query(`SELECT count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica.active_activity_publications a ON a.source=x.source AND a.batch_id=x.batch_id JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.source=$1 AND x.kind='rapporteurship' AND x.payload->>'proposalId' IS NOT NULL AND ((x.source='camara' AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))) OR (x.source='senado' AND (x.payload->>'start')::date >= make_date($2,1,1) AND (x.payload->>'start')::date < make_date($2+1,1,1)))`,[source,year]),
    pool().query(`SELECT 0::int n`),
  ]);
  return {proposals:Number(annualP.rows[0]?.n??0),historicalProposals:Number(p.rows[0]?.n??0),received:Number(r.rows[0]?.n??0),backlog:Number(b.rows[0]?.n??0),rapporteurships:Number(annualA.rows[0]?.n??0),historicalRapporteurships:Number(a.rows[0]?.n??0),laws:Number(l.rows[0]?.n??0),year};});
}
export async function loadPublishedHouseOperations(source:string,year:number):Promise<any>{
  const row=(await pool().query(`SELECT b.reconciliation_json,b.published_at,b.id batch_id
    FROM civica.active_complement_publications a JOIN civica.complement_batches b ON b.id=a.batch_id
    WHERE a.source=$1 AND a.scope=$2 LIMIT 1`,[source,`house-operations-${year}`])).rows[0]??null;
  if(!row) return null;
  const rawValue=row.reconciliation_json&&typeof row.reconciliation_json==='object'?row.reconciliation_json:{};
  // Some historical house-operation publications keep the complete public
  // summary in the ingestion-run reconciliation and only the backlog and
  // processing fields in the active complement batch. Merge both PG-owned
  // publication records before projecting the public DTO.
  const run=(await pool().query(`SELECT reconciliation_json FROM civica.ingestion_runs WHERE id=$1 AND source=$2 LIMIT 1`,[`pg-house-operations:${source}:${year}`,source])).rows[0]?.reconciliation_json;
  const value={...((run&&typeof run==='object'&&run.summary&&typeof run.summary==='object')?run.summary:{}),...rawValue};
  let agendaCoverage=value.agendaCoverage??null;
  const agendaPublication=(await pool().query(`SELECT b.reconciliation_json,b.id batch_id
    FROM civica.active_complement_publications a JOIN civica.complement_batches b ON b.id=a.batch_id
    WHERE a.source=$1 AND a.scope=$2 LIMIT 1`,[source,source==='senado'?`senate-commission-agenda-${year}`:`camara-agenda-${year}`])).rows[0]??null;
  if(agendaPublication?.reconciliation_json&&typeof agendaPublication.reconciliation_json==='object'){
    const a:any=agendaPublication.reconciliation_json;
    agendaCoverage={year:Number(a.year??year),from:a.from??`${year}-01-01`,to:a.to??null,items:Number(a.items??0),matters:Number(a.matters??0),events:Number(a.events??0),eventsCovered:Number(a.eventsCovered??a.events??0),plenaryMatters:Number(a.plenaryMatters??0),commissionMatters:Number(a.commissionMatters??a.matters??0),failures:Array.isArray(a.failures)?a.failures:[],published:Boolean(a.published),source:String(a.source??'GET /eventos/{id}/pauta')};
  }
  let backlog=Number(value.backlog??0), norm=Number(value.norm??0), processing=value.processing??null;
  if(source==='camara'){
    // The public backlog is the annual active catalogue restricted to the
    // published legislative year; the broad "status=tramitando" universe
    // includes historical records and is not the SQLite contract.
    if(value.backlog==null){
      const b=await pool().query(`SELECT count(DISTINCT p.external_id)::int n FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id WHERE p.source=$1 AND p.year=$2 AND lower(coalesce(p.status,'')) LIKE '%tramit%'`,[source,year]);
      backlog=Number(b.rows[0]?.n??backlog);
    }
    const agenda=await pool().query(`SELECT count(DISTINCT m.id)::int meetings,count(*)::int items,count(DISTINCT i.proposal_id)::int matters,max(m.scheduled_date)::text max_date FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source=$1 AND i.active=true AND m.scheduled_date>=make_date($2,1,1)::text AND m.scheduled_date<make_date($2+1,1,1)::text`,[source,year]);
    const ar=agenda.rows[0]??{};
    agendaCoverage={year,from:`${year}-01-01`,to:String(ar.max_date??`${year}-12-31`).slice(0,10),items:Number(ar.items??0),matters:Number(ar.matters??0),events:Number(ar.meetings??0),eventsCovered:Number(ar.meetings??0),plenaryMatters:0,commissionMatters:Number(ar.matters??0),failures:[],published:agendaCoverage?.published??true,source:'civica_committees_poc',...(agendaCoverage??{})};
    const atoms=await pool().query(`SELECT proposal_id::text id,kind,payload->>'label' label,payload->>'value' value FROM civica_poc.proposal_detail_atoms WHERE source=$1 AND proposal_id IS NOT NULL AND occurred_at>=make_date($2,1,1)::text AND occurred_at<make_date($2+1,1,1)::text AND kind IN ('movement','resulting_norm')`,[source,year]);
    const ids=new Set<string>();for(const a of atoms.rows){if(a.kind==='resulting_norm'){ids.add(String(a.id));continue;}const t=String(a.label??'')+' '+String(a.value??'');if(/transformad[ao].*norma|promulgad[ao]|sancionad[ao]/i.test(t))ids.add(String(a.id));}norm=ids.size;
    processing=processing??await processingSummary(source,year);
    // The old house-operation snapshot was published before the CÃ¢mara vote
    // batch was wired to the PostgreSQL read layer and therefore contained
    // zeros.  Reconcile the already persisted vote events here.  Only the
    // collector's high-confidence official object relation is promoted to a
    // matter id; candidate/affected-only events remain in coverage metadata.
    const voteBatch=(await pool().query(`SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source='camara' AND year=$1 LIMIT 1`,[year])).rows[0]?.batch_id;
    let voteEvents=0,deliberated=0,decision=0,deliberatedReceived=0;
    if(voteBatch){
      const voteRows=(await pool().query(`SELECT d.external_id,d.payload,
          EXISTS (SELECT 1 FROM civica_votes_presence_poc.votes v WHERE v.source=d.source AND v.batch_id=d.batch_id AND v.deliberation_id=d.external_id) AS has_votes
        FROM civica_votes_presence_poc.deliberations d
        WHERE d.source='camara' AND d.batch_id=$1`,[voteBatch])).rows;
      const matterIds=new Set<string>(),approvedIds=new Set<string>(),receivedIds=new Set<string>();let linkedMatterEvents=0;
      const received=(await pool().query(`SELECT DISTINCT p.external_id::text id FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id WHERE p.source='camara' AND (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1))`,[year])).rows;
      for(const row of received)receivedIds.add(String(row.id));
      for(const row of voteRows){const payload=row.payload&&typeof row.payload==='object'?row.payload:{};if(row.has_votes)voteEvents++;const id=payload.actualVotedProposalId==null?'':String(payload.actualVotedProposalId);if(!id)continue;matterIds.add(id);linkedMatterEvents++;if(payload.approved===true)approvedIds.add(id);if(receivedIds.has(id))deliberatedReceived++;}
      deliberated=matterIds.size;decision=approvedIds.size;
      const linkedReceived=new Set<string>();for(const row of voteRows){const id=row.payload?.actualVotedProposalId==null?'':String(row.payload.actualVotedProposalId);if(id&&receivedIds.has(id))linkedReceived.add(id);}deliberatedReceived=linkedReceived.size;
      value.received=receivedIds.size;value.presented=receivedIds.size;value.voteEvents=voteEvents;value.deliberated=deliberated;value.deliberatedReceived=deliberatedReceived;value.decision=decision;value.rapporteur=Number((await pool().query(`SELECT count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.source='camara' AND x.kind='rapporteurship' AND x.payload->>'proposalId' IS NOT NULL AND (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1))`,[year])).rows[0]?.n??0);value.norm=norm;
      value.voteCoverage={events:voteRows.length,eventsWithVotes:voteEvents,linkedMatterEvents,linkedMatterIds:matterIds.size,unresolvedEvents:voteRows.length-linkedMatterEvents,relation:'actualVotedProposalId only',batchId:String(voteBatch)};
    }
  }
  if(source==='senado'){
    const d=(await pool().query(`SELECT count(*)::int events,count(DISTINCT payload->>'proposalId')::int proposals,count(DISTINCT payload->>'proposalId') FILTER (WHERE (payload->>'approved')::boolean IS TRUE)::int approved FROM civica_votes_presence_poc.deliberations WHERE source=$1 AND batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND payload->>'proposalId' IS NOT NULL`,[source,year])).rows[0]??{};
    const receivedRows=(await pool().query(`SELECT DISTINCT p.external_id::text id FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id WHERE p.source=$1 AND (p.presented_year=$2 OR (p.presented_year IS NULL AND p.presented_at >= make_date($2,1,1) AND p.presented_at < make_date($2+1,1,1)))`,[source,year])).rows;
    const delRows=(await pool().query(`SELECT DISTINCT payload->>'proposalId' id FROM civica_votes_presence_poc.deliberations WHERE source=$1 AND batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND payload->>'proposalId' IS NOT NULL`,[source,year])).rows;
    const receivedIds=new Set(receivedRows.map(r=>String(r.id))), annualDeliberatedIds=new Set(delRows.filter(r=>receivedIds.has(String(r.id))).map(r=>String(r.id))), deliberatedReceived=annualDeliberatedIds.size;
    const rapporteur=(await pool().query(`SELECT count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica.active_activity_publications a ON a.source=x.source AND a.batch_id=x.batch_id JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.source=$1 AND x.kind='rapporteurship' AND ((x.source='camara' AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))) OR (x.source='senado' AND (x.payload->>'start')::date >= make_date($2,1,1) AND (x.payload->>'start')::date < make_date($2+1,1,1))) AND x.payload->>'proposalId' IS NOT NULL`,[source,year])).rows[0]?.n;
    const voteEvents=Number(d.events??0),deliberated=annualDeliberatedIds.size;
    const decisionRows=(await pool().query(`SELECT DISTINCT payload->>'proposalId' id FROM civica_votes_presence_poc.deliberations WHERE source=$1 AND batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND payload->>'proposalId' IS NOT NULL AND (payload->>'approved')::boolean IS TRUE`,[source,year])).rows;
    const decision=new Set(decisionRows.map(r=>String(r.id)).filter(id=>receivedIds.has(id))).size;
    const normRows=(await pool().query(`SELECT DISTINCT a.proposal_id::text id
      FROM civica_poc.proposal_detail_atoms a
      WHERE a.source='senado' AND a.kind='resulting_norm' AND a.proposal_id IS NOT NULL
        AND a.occurred_at >= make_date($1,1,1)::text AND a.occurred_at < make_date($1+1,1,1)::text
`,[year])).rows;
    norm=normRows.length;
    const processingWithNote=processing&&processing.sampleSize?{...processing,note:`MÃ©dia observada em n=${processing.sampleSize}; cobertura parcial, ainda nÃ£o representa todas as matÃ©rias concluÃ­das. ${String(processing.terminalDefinition??'')}`}:processing;
    return {source,year,received:Number(value.received??value.presented??receivedRows.length),presented:Number(value.presented??value.received??receivedRows.length),backlog,rapporteur:Number(value.rapporteur??value.rapporteurships??rapporteur??0),agenda:Number(value.agenda??0),agendaCoverage,voteEvents,deliberated,deliberatedReceived,decision,norm,processing:processingWithNote,updatedAt:value.observedAt?String(value.observedAt):(row.published_at?new Date(row.published_at).toISOString():null),batchId:String(row.batch_id),publication:{batchId:String(row.batch_id),publishedAt:row.published_at?new Date(row.published_at).toISOString():null}};
  }
  return {source,year,received:Number(value.received??value.presented??0),presented:Number(value.presented??value.received??0),backlog,rapporteur:Number(value.rapporteur??value.rapporteurships??0),agenda:Number(value.agenda??0),agendaCoverage,voteEvents:Number(value.voteEvents??0),deliberated:Number(value.deliberated??0),deliberatedReceived:Number(value.deliberatedReceived??0),decision:Number(value.decision??0),norm,processing,voteCoverage:value.voteCoverage??null,updatedAt:value.observedAt?String(value.observedAt):(row.published_at?new Date(row.published_at).toISOString():null),batchId:String(row.batch_id),publication:{batchId:String(row.batch_id),publishedAt:row.published_at?new Date(row.published_at).toISOString():null}};
}
async function operationalSummary(source:string,year:number):Promise<any>{
  return memoRead(`operationalSummary:${source}:${year}`,async()=>{const published=await loadPublishedHouseOperations(source,year);
  if(published) return published;
  const [active,received,rapporteur,agenda,deliberated,norm]=await Promise.all([
    pool().query(`SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1`,[source,year]),
    pool().query(`SELECT count(DISTINCT external_id)::int n FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.batch_id=p.batch_id AND ap.source=p.source WHERE p.source=$1 AND p.presented_at >= make_date($2,1,1) AND p.presented_at < make_date($2+1,1,1)`,[source,year]),
    pool().query(`SELECT count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.source=$1 AND x.kind='rapporteurship' AND ((x.source='camara' AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))) OR (x.source='senado' AND (x.payload->>'start')::date >= make_date($2,1,1) AND (x.payload->>'start')::date < make_date($2+1,1,1)))`,[source,year]),
    pool().query(`SELECT count(DISTINCT i.proposal_id)::int n FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source=$1 AND i.active=true AND i.proposal_id IS NOT NULL AND m.scheduled_date >= make_date($2,1,1)::text AND m.scheduled_date < make_date($2+1,1,1)::text`,[source,year]),
    pool().query(`SELECT count(*)::int events,count(DISTINCT payload->>'proposalId')::int proposals,count(DISTINCT payload->>'proposalId') FILTER (WHERE (payload->>'approved')::boolean IS TRUE)::int approved FROM civica.deliberations d WHERE d.source=$1 AND d.batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1)`,[source,year]),
    source==='camara'
      ? pool().query(`SELECT proposal_id::text id,kind,payload->>'label' label,payload->>'value' value FROM civica_poc.proposal_detail_atoms WHERE source=$1 AND kind IN ('movement','resulting_norm') AND occurred_at >= make_date($2,1,1)::text AND occurred_at < make_date($2+1,1,1)::text AND proposal_id IS NOT NULL`,[source,year])
      : pool().query(`SELECT count(DISTINCT proposal_id)::int n FROM civica_poc.proposal_detail_atoms WHERE source=$1 AND kind='resulting_norm' AND occurred_at >= make_date($2,1,1)::text AND occurred_at < make_date($2+1,1,1)::text AND proposal_id IS NOT NULL`,[source,year]),
  ]);
  const d=deliberated.rows[0]??{}; let normCount=Number(norm.rows[0]?.n??0); if(source==='camara'){const ids=new Set<string>();for(const row of norm.rows){if(row.kind==='resulting_norm'){ids.add(String(row.id));continue;}const text=`${row.label??''} ${row.value??''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();if(/transformad[ao].*norma|promulgad[ao]|sancionad[ao]/.test(text))ids.add(String(row.id));}normCount=ids.size;}
  // The Senate activity and voting publications can carry different official
  // proposal identifiers for the same matter.  SQLite resolves this overlap
  // through the published matter identity; in PostgreSQL the stable public
  // identity available in both publications is the official label.  Prefer an
  // id intersection and use a normalized label only for the residual rows so
  // unrelated matters are never folded together.
  const receivedRows=(await pool().query(`SELECT DISTINCT p.external_id::text id,p.label FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id WHERE p.source=$1 AND p.presented_at >= make_date($2,1,1) AND p.presented_at < make_date($2+1,1,1)`,[source,year])).rows;
  const deliberatedRows=(await pool().query(`SELECT DISTINCT payload->>'proposalId' id,payload->>'proposalLabel' label FROM civica.deliberations d WHERE d.source=$1 AND d.batch_id=(SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1) AND payload->>'proposalId' IS NOT NULL`,[source,year])).rows;
  const receivedIds=new Set(receivedRows.map(r=>String(r.id)));
  const deliberatedIds=new Set(deliberatedRows.map(r=>String(r.id)));
  const normalizeMatterLabel=(value:any)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toUpperCase();
  const receivedLabels=new Set(receivedRows.map(r=>normalizeMatterLabel(r.label)).filter(Boolean));
  const deliberatedReceived=[...deliberatedRows].filter(r=>deliberatedIds.has(String(r.id)) && (receivedIds.has(String(r.id)) || receivedLabels.has(normalizeMatterLabel(r.label)))).length;
  const agendaCoverageRows=(await pool().query(`SELECT count(*)::int events,count(DISTINCT i.proposal_id)::int events_covered,max(m.scheduled_date)::text max_date FROM civica_committees_poc.agenda_items i JOIN civica_committees_poc.meetings m ON m.id=i.meeting_id WHERE i.source=$1 AND i.active=true AND i.proposal_id IS NOT NULL AND m.scheduled_date >= make_date($2,1,1)::text AND m.scheduled_date < make_date($2+1,1,1)::text`,[source,year])).rows[0]??{};
  const agendaCoverage=source==='senado'
    ? {year,from:`${year}-01-01`,to:String(agendaCoverageRows.max_date??`${year}-12-31`).slice(0,10),items:Number(agendaCoverageRows.events??0),matters:Number(agendaCoverageRows.events_covered??0),published:false,source:'https://legis.senado.leg.br/dadosabertos/agendareuniao/mes/{AAAAMM}.json'}
    : {year,from:`${year}-01-01`,to:String(agendaCoverageRows.max_date??`${year}-12-31`).slice(0,10),items:Number(agendaCoverageRows.events??0),matters:Number(agendaCoverageRows.events_covered??0),events:Number(agendaCoverageRows.events??0),eventsCovered:Number(agendaCoverageRows.events_covered??0),failures:[],published:false,source:'GET /eventos/{id}/pauta'};
  const operationPublication=(await pool().query(`SELECT c.payload,b.published_at,b.id batch_id
    FROM civica.active_complement_publications a
    JOIN civica.complement_batches b ON b.id=a.batch_id
    JOIN civica.legislative_complements c ON c.batch_id=b.id AND c.external_key=$3
    WHERE a.source=$1 AND a.scope=$2 LIMIT 1`,[source,`house-operations-${year}`,`house-operations:${year}`])).rows[0]??null;
  const parseJson=(value:any)=>{if(value&&typeof value==='object')return value;try{return JSON.parse(String(value??'{}'))}catch{return {}}};
  const operationValue=operationPublication?parseJson(operationPublication.payload?.value):null;
  const agendaPublication=(await pool().query(`SELECT b.reconciliation_json,b.id batch_id
    FROM civica.active_complement_publications a JOIN civica.complement_batches b ON b.id=a.batch_id
    WHERE a.source=$1 AND a.scope=$2 LIMIT 1`,[source,source==='senado'?`senate-commission-agenda-${year}`:`camara-agenda-${year}`])).rows[0]??null;
  const publishedAgenda=agendaPublication?parseJson(agendaPublication.reconciliation_json):null;
  const finalAgendaCoverage=publishedAgenda&&typeof publishedAgenda==='object' ? {...agendaCoverage,...publishedAgenda,published:true,batchId:String(agendaPublication.batch_id)} : agendaCoverage;
  const activeSummaryRaw=source==='senado'?(await pool().query(`SELECT c.payload->>'value' AS value FROM civica.active_complement_publications a JOIN civica.legislative_complements c ON c.batch_id=a.batch_id AND c.external_key=$3 WHERE a.source=$1 AND a.scope=$2 LIMIT 1`,[source,`house-operations-${year}`,`house-operations:${year}`])).rows[0]?.value:null;
  const activeSummary=activeSummaryRaw?parseJson(activeSummaryRaw):null;
  const officialRun=source==='senado'?(await pool().query(`SELECT reconciliation_json FROM civica.ingestion_runs WHERE id=$1 AND source=$2 LIMIT 1`,[`pg-house-operations:${source}:${year}`,source])).rows[0]?.reconciliation_json:null;
  const officialSummary=officialRun&&typeof officialRun==='object'?(officialRun.summary??officialRun):null;
  const finalProcessing=operationValue?.processing&&typeof operationValue.processing==='object' ? operationValue.processing : activeSummary?.processing&&typeof activeSummary.processing==='object' ? activeSummary.processing : officialSummary?.processing&&typeof officialSummary.processing==='object' ? officialSummary.processing : await processingSummary(source,year);
  return {received:Number(operationValue?.received??received.rows[0]?.n??0),rapporteur:Number(operationValue?.rapporteur??rapporteur.rows[0]?.n??0),agenda:Number(operationValue?.agenda??agenda.rows[0]?.n??0),agendaCoverage:finalAgendaCoverage,voteEvents:Number(operationValue?.voteEvents??d.events??0),deliberated:Number(operationValue?.deliberated??d.proposals??0),deliberatedReceived:Number(operationValue?.deliberatedReceived??deliberatedReceived),decision:Number(operationValue?.decision??d.approved??0),norm:Number(operationValue?.norm??normCount),processing:finalProcessing,batchId:operationPublication?.batch_id??active.rows[0]?.batch_id??null,publication:operationPublication?{batchId:String(operationPublication.batch_id),publishedAt:String(operationPublication.published_at)}:null};});
}
/** Reproduce the collector's processing observation semantics from relational PG data.
 * Terminal observations are the first norm/terminal movement in the requested year;
 * terminal situations fall back to the last dated official event after presentation.
 */
async function processingSummary(source:string,year:number){
  const [matters,events]=await Promise.all([
    pool().query(`SELECT p.external_id::text id,p.presented_at::text presented_at,coalesce(p.status,'') status
      FROM civica_poc.proposals p JOIN civica_poc.active_publications ap ON ap.source=p.source AND ap.batch_id=p.batch_id
      WHERE p.source=$1`,[source]),
    pool().query(`SELECT proposal_id::text id,occurred_at::text date,kind,payload->>'label' label,payload->>'value' value
      FROM civica_poc.proposal_detail_atoms
      WHERE source=$1 AND proposal_id IS NOT NULL AND kind IN ('movement','situation','resulting_norm') AND occurred_at IS NOT NULL`,[source]),
  ]);
  // Normalize accents before applying the SQLite terminal rules.  The PG
  // payload contains both UTF-8 and legacy-encoded labels; eligibility must
  // not change with that representation.
  const normText=(value:any)=>String(value??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âº|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â´|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢|ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âª/gi,'c').toLowerCase();
  const terminalEvent=/(transformad[ao].*norma|transforma(?:cao).*norma|convertid[ao].*norma|promulgad[ao]|sancionad[ao]|vetad[ao]|veto (?:total|parcial))/i;
  const terminalStatus=/(tramitacao (?:finalizada|encerrada)|arquivad[ao]|rejeitad[ao]|retirad[ao] pel[ao] autor|prejudicad[ao]|perda de objeto)/i;
  const day=(v:any)=>{if(!v)return null;const m=String(v).slice(0,10).match(/^(\d{4})-(\d{2})-(\d{2})$/);return m?Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3])):null;};
  const matterMap=new Map(matters.rows.map(r=>[String(r.id),r]));
  const eventMap=new Map<string,any[]>(); for(const e of events.rows){const list=eventMap.get(String(e.id))??[];list.push(e);eventMap.set(String(e.id),list);}
  const ends=new Map<string,number>();
  for(const [id,list] of eventMap){for(const e of list){if(String(e.date).slice(0,4)!==String(year))continue;if(e.kind==='resulting_norm'||terminalEvent.test(normText(e.label))){const t=day(e.date);if(t!==null&&(!ends.has(id)||t<ends.get(id)!))ends.set(id,t);}}}
  for(const [id,m] of matterMap){if(!terminalStatus.test(normText(m.status)))continue;const start=day(m.presented_at);const dated=(eventMap.get(id)??[]).map(e=>day(e.date)).filter((v:any):v is number=>v!==null&&(!year||new Date(v).getUTCFullYear()===year)&&(!start||v>=start));if(dated.length&&!ends.has(id))ends.set(id,Math.max(...dated));}
  const values:number[]=[];for(const [id,end] of ends){const start=day(matterMap.get(id)?.presented_at);if(start!==null&&start!==undefined&&end>=start)values.push((end-start)/86400000);}
  values.sort((a,b)=>a-b);const eligible=new Set<string>();for(const [id,list] of eventMap)if(list.some(e=>{const t=day(e.date);return t!==null&&new Date(t).getUTCFullYear()===year&&(e.kind==='resulting_norm'||terminalEvent.test(normText(e.label)))}))eligible.add(id);for(const [id,m] of matterMap)if(terminalStatus.test(normText(m.status)))eligible.add(id);
  const mean=values.length?values.reduce((a,b)=>a+b,0)/values.length:null;const median=values.length?(values.length%2?values[Math.floor(values.length/2)]!:(values[values.length/2-1]!+values[values.length/2]!)/2):null;
  const terminalDefinition=source==='senado'?'Primeiro evento datado de sanÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o, promulgaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o, transformaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o/conversÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o em norma ou veto apÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³s a apresentaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o.':'Primeiro desfecho normativo datado ou, para situaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o final, a ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºltima movimentaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o oficial datada apÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³s a apresentaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o.';
  const coverage=eligible.size?values.length/eligible.size:0;
  const note='MÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©dia observada em n='+values.length+'; cobertura parcial, ainda nÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â£o representa todas as matÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â©rias concluÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­das. '+terminalDefinition;
  return {meanDays:mean,medianDays:median,sampleSize:values.length,eligible:eligible.size,coverage,terminalDefinition,note};
}
export async function operationCosts(source:string,year:number,mode:'common'|'batch'='common'){
  return memoRead(`operationCosts:${source}:${year}:${mode}`,async()=>{const [expense,cabinet,roster,norm,expenseBatch,personExpense,personCabinet,activeProfiles]=await Promise.all([
    pool().query(`SELECT e.month,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND e.year=$2 GROUP BY e.month`,[source,year]),
    source==='camara'?pool().query(`SELECT b.month,sum(b.spent_cents)::bigint value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.batch_id WHERE b.source=$1 AND b.year=$2 AND b.spent_cents IS NOT NULL GROUP BY b.month`,[source,year]):pool().query(`SELECT substring(e.competence,6,2)::int AS month_num,sum(e.value_cents)::bigint value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND a.year=$2 AND e.rubric='cabinet_payroll_gross' AND e.value_cents IS NOT NULL GROUP BY substring(e.competence,1,7),substring(e.competence,6,2)`,[source,year]),
    pool().query(`SELECT count(*)::int n FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id WHERE a.source=$1`,[source]),
    pool().query(`SELECT value_cents,valid_from,valid_to FROM civica.normative_values WHERE kind='parliamentary_subsidy' AND applies_to='congress' ORDER BY valid_from DESC`),
    pool().query(`SELECT b.net_cents::bigint value,count(DISTINCT e.month)::int months FROM civica.expense_batches b JOIN civica.active_expense_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.id JOIN civica.expenses e ON e.batch_id=b.id WHERE b.source=$1 AND b.year=$2 GROUP BY b.net_cents`,[source,year]),
    pool().query(`SELECT e.external_id::text id,e.month,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND e.year=$2 GROUP BY e.external_id,e.month`,[source,year]),
    source==='camara'?pool().query(`SELECT b.external_id::text id,b.month,sum(b.spent_cents)::bigint value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.batch_id WHERE b.source=$1 AND b.year=$2 AND b.spent_cents IS NOT NULL GROUP BY b.external_id,b.month`,[source,year]):pool().query(`SELECT e.external_id::text id,substring(e.competence,6,2)::int month_num,sum(e.value_cents)::bigint value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND a.year=$2 AND e.rubric='cabinet_payroll_gross' AND e.value_cents IS NOT NULL GROUP BY e.external_id,substring(e.competence,1,7),substring(e.competence,6,2)`,[source,year]),
    pool().query(`SELECT p.payload FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id WHERE a.source=$1`,[source]),
  ]);
  const em=new Map(expense.rows.map(r=>[Number(r.month),Number(r.value)])),cm=new Map(cabinet.rows.map(r=>[Number(r.month_num??r.month),Number(r.value)]));
  const months=[...em.keys()].filter(m=>cm.has(m)).sort((a,b)=>a-b),r=Number(roster.rows[0]?.n??0),common=months.map(m=>{const at=`${year}-${String(m).padStart(2,'0')}-01`,n=norm.rows.find(x=>String(x.valid_from)<=at&&(!x.valid_to||String(x.valid_to)>=at));return n?{salary:Number(n.value_cents)*r,expense:em.get(m)!,cabinet:cm.get(m)!}:null}).filter(Boolean) as any[];
  // The SQLite contract computes the operations card from the common
  // month-by-month window.  The expense batch total is useful provenance,
  // but dividing it by its distinct-month count can include rows outside
  // the common cabinet window and changes the public monthly value.
  const mean=(xs:number[])=>xs.length?xs.reduce((a,b)=>a+b,0)/xs.length:null,salaryMonthly=mean(common.map(x=>x.salary)),expenseMonthly=mode==='batch'&&expenseBatch.rows[0]?.months?Number(expenseBatch.rows[0].value)/Number(expenseBatch.rows[0].months):mean(common.map(x=>x.expense)),cabinetMonthly=mean(common.map(x=>x.cabinet));
  const monthActive=(month:number)=>{
    const from=`${year}-${String(month).padStart(2,'0')}-01`,to=new Date(Date.UTC(year,month,0)).toISOString().slice(0,10);
    if(source!=='senado')return r;
    return activeProfiles.rows.filter((row:any)=>Array.isArray(row.payload?.exercises)&&row.payload.exercises.some((exercise:any)=>String(exercise.start??'')<=to&&(!exercise.end||String(exercise.end)>=from))).length;
  };
  const observedMonths=[...new Set([...em.keys(),...cm.keys()])].sort((a,b)=>a-b);
  const annualRows=observedMonths.map(month=>{const at=`${year}-${String(month).padStart(2,'0')}-01`,n=norm.rows.find(x=>String(x.valid_from)<=at&&(!x.valid_to||String(x.valid_to)>=at));return {salary:n?Number(n.value_cents)*monthActive(month):null,expense:em.get(month)??null,cabinet:cm.get(month)??null,month};});
  const sumObserved=(key:'salary'|'expense'|'cabinet')=>{const values=annualRows.map(row=>row[key]).filter((value):value is number=>value!==null);return values.length?values.reduce((a,b)=>a+b,0):null;};
  const annualSalary=sumObserved('salary'),annualExpense=sumObserved('expense'),annualCabinet=sumObserved('cabinet'),annualTotal=annualSalary!==null&&annualExpense!==null&&annualCabinet!==null?annualSalary+annualExpense+annualCabinet:null;
  const commonMonths=months.map(m=>String(m));
  const personMaps=(rows:any[])=>{const map=new Map<string,Map<number,number>>();for(const row of rows){const id=String(row.id),month=Number(row.month_num??row.month),byMonth=map.get(id)??new Map<number,number>();byMonth.set(month,Number(row.value));map.set(id,byMonth);}return map;};
  const expenseByPerson=personMaps(personExpense.rows),cabinetByPerson=personMaps(personCabinet.rows);
  const people=[...new Set([...expenseByPerson.keys(),...cabinetByPerson.keys()])];
  const eligiblePeople=people.filter(id=>commonMonths.every(month=>expenseByPerson.get(id)?.has(Number(month))&&cabinetByPerson.get(id)?.has(Number(month))));
  const partialPeople=people.filter(id=>!eligiblePeople.includes(id)&&commonMonths.some(month=>expenseByPerson.get(id)?.has(Number(month))||cabinetByPerson.get(id)?.has(Number(month))));
  const comparableEntries=commonMonths.length?{salary:common.reduce((n,x)=>n+x.salary,0)/commonMonths.length*(eligiblePeople.length/r),expense:eligiblePeople.reduce((n,id)=>n+commonMonths.reduce((m,month)=>m+(expenseByPerson.get(id)?.get(Number(month))??0),0),0)/commonMonths.length,cabinet:eligiblePeople.reduce((n,id)=>n+commonMonths.reduce((m,month)=>m+(cabinetByPerson.get(id)?.get(Number(month))??0),0),0)/commonMonths.length}:null;
  const roundedComparableEntries=comparableEntries?{salary:Math.round(comparableEntries.salary),expense:Math.round(comparableEntries.expense),cabinet:Math.round(comparableEntries.cabinet)}:null;
  const comparableTotalMonthly=roundedComparableEntries?roundedComparableEntries.salary+roundedComparableEntries.expense+roundedComparableEntries.cabinet:null;
  const salaryMonths=commonMonths.length;
  return {roster:r,salaryMonthly,expenseMonthly,cabinetMonthly,salaryMonths,months:common.map((_,i)=>`${year}-${String(months[i]).padStart(2,'0')}`),totalMonthly:salaryMonthly!==null&&expenseMonthly!==null&&cabinetMonthly!==null?salaryMonthly+expenseMonthly+cabinetMonthly:null,identifiedTotalMonthly:salaryMonthly!==null&&expenseMonthly!==null&&cabinetMonthly!==null?salaryMonthly+expenseMonthly+cabinetMonthly:null,comparableTotalMonthly,comparableEntries:roundedComparableEntries,eligible:eligiblePeople.length,partial:partialPeople.length,noInfo:Math.max(0,r-people.length),period:commonMonths.length?`${year}-${String(commonMonths[0]).padStart(2,'0')} a ${year}-${String(commonMonths.at(-1)).padStart(2,'0')}`:null,annualSalary,annualExpense,annualCabinet,annualTotal,annualMonths:observedMonths.map(month=>`${year}-${String(month).padStart(2,'0')}`),activeByMonth:Object.fromEntries(annualRows.map(row=>[`${year}-${String(row.month).padStart(2,'0')}`,monthActive(row.month)]))};});
}
export async function legislativeOverview(query:any={}) {
  const ps=await profiles(); const sources=['senado','camara'] as const; const yearsBy:any={};
  for(const s of sources) yearsBy[s]=(await years(s))[0]??new Date().getFullYear();
  const filtered=ps.filter(p=>(!query.source||p.source===query.source)&&(!query.uf||p.uf===query.uf)&&(!query.party||p.party===query.party)&&(!query.search||searchText(`${p.name} ${p.party} ${p.uf}`).includes(searchText(query.search))));
  const metrics=await Promise.all(sources.map(async s=>{
    const sourcePeople=ps.filter(p=>p.source===s), year=yearsBy[s], ids=sourcePeople.map(p=>p.externalId);
    const [exp,cost,cabinetBudget,act,part,staff]=await Promise.all([
      expenseMap(s,year), costMap(s,year), cabinetBudgetMap(s,year), activityMap(s,year),
      participation(s,year,ids), functionalStaffMap(s,year),
    ]);
    return {s,year,exp,cost,cabinetBudget,act,part,staff};
  }));
  const activityTotals:any={}; const operations:any={}; const processingNote=(p:any)=>p&&p.sampleSize?{...p,note:`M\u00e9dia observada em n=${p.sampleSize}; cobertura parcial, ainda n\u00e3o representa todas as mat\u00e9rias conclu\u00eddas. ${p.terminalDefinition}`}:p;
  await Promise.all(sources.map(async s=>{
    const [activity,operational,costs]=await Promise.all([activitySummary(s),operationalSummary(s,yearsBy[s]),operationCosts(s,yearsBy[s])]);
    activityTotals[s]=activity;
    operations[s]={...costs,operational,processing:processingNote(operational.processing??await processingSummary(s,yearsBy[s]))};
  }));
  const by:any=Object.fromEntries(metrics.map(x=>[x.s,x]));
  const items=filtered.map(p=>{const x=by[p.source],e=x.exp.get(p.externalId),c=x.cost.get(p.externalId),cb=x.cabinetBudget.get(p.externalId),presence=x.part.presence.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem observaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o publicada.'},particip=x.part.participation.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem votaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o nominal publicada.'}; const expense=e?.value??null,cabinet=c?.value??cb?.value??null,months=c?.months??cb?.months??e?.months??null,salaryMonths=operations[p.source].salaryMonths??0,salaryCents=operations[p.source].salaryMonthly!=null&&operations[p.source].roster?Math.round(Number(operations[p.source].salaryMonthly)/Number(operations[p.source].roster)*salaryMonths):null,total=expense==null&&cabinet==null&&salaryCents==null?null:(expense??0)+(cabinet??0)+(salaryCents??0);return {...profileView(p,{expenseCents:expense,cabinetCents:cabinet,totalCostCents:total,monthlyCostCents:months?Math.round(total!/Math.max(months,1)):null,costMonths:months,costPeriod:months?String(yearsBy[p.source]):null,participation:particip,presence,proposals:x.act.get(p.externalId)??0,staff:x.staff.get(p.externalId)??null}),expenseYear:e?yearsBy[p.source]:null,annualCabinetCents:cabinet,salaryCents,salaryMonths,participation:{presence,participation:particip},cabinetFinancialCents:cabinet,cabinetPeriod:c||cb?String(yearsBy[p.source]):null,proposalCount:x.act.get(p.externalId)??0};});
  const page=query.page??1,size=query.pageSize??10; const emptyDist={count:0,min:null,p10:null,p25:null,median:null,p75:null,p90:null,max:null};
  const meta:any={};
  for(const s of sources){
    const [r,e,p,a]=await Promise.all([
      pool().query(`SELECT a.batch_id,b.published_at FROM civica.active_publications a JOIN civica.publication_batches b ON b.id=a.batch_id WHERE a.source=$1 LIMIT 1`,[s]),
      pool().query(`SELECT a.batch_id,b.record_count,b.published_at FROM civica.active_expense_publications a JOIN civica.expense_batches b ON b.id=a.batch_id WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[s,yearsBy[s]]),
      pool().query(`SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1`,[s,yearsBy[s]]),
      pool().query(`SELECT batch_id FROM civica.active_activity_publications WHERE source=$1 LIMIT 1`,[s])
    ]);
    meta[s]={roster:r.rows[0],expense:e.rows[0],presence:p.rows[0],activity:a.rows[0]};
  }
  const house=(s:string)=>{const rows=items.filter(p=>p.source===s),all=ps.filter(p=>p.source===s),presenceValues=rows.map(p=>p.participation.presence).filter((v:any)=>v.numerator!=null&&v.denominator).map((v:any)=>v.numerator/v.denominator),participValues=rows.map(p=>p.participation.participation).filter((v:any)=>v.numerator!=null&&v.denominator&&v.numerator>0).map((v:any)=>v.numerator/v.denominator),activity=activityTotals[s],m=meta[s],presenceUnavailable=s==='senado'; return {source:s,year:yearsBy[s],roster:{parliamentarians:all.length,states:new Set(all.map(p=>p.uf)).size,parties:new Set(all.map(p=>p.party)).size,coverage:{availability:'available',source:s,period:{from:m?.roster?.published_at??null,to:m?.roster?.published_at??null,grain:'snapshot'},batchId:m?.roster?.batch_id??null,note:'Cadastro publicado ativo.',sampleSize:all.length}},expenses:{distributionCents:emptyDist,coverage:{availability:'available',source:s,period:{from:`${yearsBy[s]}-01-01`,to:`${yearsBy[s]}-12-31`,grain:'year'},batchId:m?.expense?.batch_id??null,note:'Lote anual publicado; a distribuiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o individual nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© recalculada nesta listagem.',sampleSize:Number(m?.expense?.record_count??0)}},cabinetPayroll:{distributionCents:emptyDist,coverage:{availability:'unavailable',source:s,period:{from:`${yearsBy[s]}-01-01`,to:`${yearsBy[s]}-12-31`,grain:'year'},batchId:null,note:'NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o usado nesta listagem.',sampleSize:0}},presence:{distributionRatio:presenceUnavailable?emptyDist:distribution(presenceValues),coverage:{availability:presenceUnavailable?'unavailable':'available',source:s,period:{from:`${yearsBy[s]}-01-01`,to:`${yearsBy[s]}-12-31`,grain:'year'},batchId:canonicalBatch(m?.presence?.batch_id),note:s==='camara'?'Presen\u00e7a registrada pela C\u00e2mara em eventos; indicador restringe-se a sess\u00f5es deliberativas encerradas e ao per\u00edodo de exerc\u00edcio.':'Presen\u00e7a oficial n\u00e3o publicada para esta listagem; aus\u00eancia de cobertura n\u00e3o vira zero.',sampleSize:presenceUnavailable?0:presenceValues.length}},participation:{distributionRatio:distribution(participValues),meanRatio:participValues.length?participValues.reduce((a,b)=>a+b,0)/participValues.length:null,coverage:{availability:'available',source:s,period:{from:`${yearsBy[s]}-01-01`,to:`${yearsBy[s]}-12-31`,grain:'year'},batchId:canonicalBatch(m?.presence?.batch_id),note:s==='camara'?'MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia entre deputados com presenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a oficial disponÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel e ao menos um voto nominal registrado; ausÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia de cobertura nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o vira zero.':'MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia entre parlamentares com ao menos um voto nominal registrado; ausÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia de cobertura nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o vira zero.',sampleSize:participValues.length}},activity:{proposals:activity.proposals,rapporteurships:activity.rapporteurships,laws:activity.laws,coverage:{availability:'available',source:s,period:{from:null,to:null,grain:'unknown'},batchId:canonicalBatch(m?.activity?.batch_id),note:'Autoria, relatoria e vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­nculo com lei permanecem mÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©tricas separadas.',sampleSize:all.length}},cabinet:{staffDistribution:emptyDist,officeDistribution:emptyDist,coverage:{availability:'unavailable',source:s,period:{from:`${yearsBy[s]}-01-01`,to:`${yearsBy[s]}-12-31`,grain:'year'},batchId:null,note:'NÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o usado nesta listagem.',sampleSize:0}}};};
  const panoramas={senado:house('senado'),camara:house('camara')};
  const result:any={total:items.length,page,pageSize:size,items:items.slice((page-1)*size,page*size).map(projectOverviewItem)};
  if(query.source!==undefined)result.source=query.source;
  if(query.uf!==undefined)result.uf=query.uf;
  if(query.party!==undefined)result.party=query.party;
  if(query.search!==undefined)result.search=query.search;
  return ok({result,facets:{parties:[...new Set(ps.map(p=>p.party).filter(Boolean))].sort().map(value=>({value,count:ps.filter(p=>p.party===value).length})),ufs:[...new Set(ps.map(p=>p.uf).filter(Boolean))].sort().map(value=>({value,count:ps.filter(p=>p.uf===value).length}))},panoramas,processingTimes:{senado:{...operations.senado.processing},camara:{...operations.camara.processing}},years:yearsBy,monthlyCosts:{senado:{meanCents:operations.senado.totalMonthly!==null?operations.senado.totalMonthly/operations.senado.roster:null,totalCents:operations.senado.totalMonthly,sampleSize:operations.senado.roster},camara:{meanCents:operations.camara.totalMonthly!==null?operations.camara.totalMonthly/operations.camara.roster:null,totalCents:operations.camara.totalMonthly,sampleSize:operations.camara.roster}}});
}
export async function houseListing(source:string,query:any){
  const allProfiles=await profiles(source);
  const ps=allProfiles.filter(p=>(!query.uf||p.uf===query.uf)&&(!query.party||p.party===query.party)&&(!query.search||searchText(p.name).includes(searchText(query.search))));
  const year=(await years(source))[0]??new Date().getFullYear(), ids=ps.map(p=>p.externalId);
  const [exp,cost,financial,act,metrics,cabinetBudget,staff,activity,operationCostsForYear]=await Promise.all([
    expenseMap(source,year), costMap(source,year), senateFinancialMap(source,year,ids), activityMap(source,year),
    participation(source,year,ids), cabinetBudgetMap(source,year), functionalStaffMap(source,year),
    activitySummary(source), operationCosts(source,year,'batch'),
  ]);
  let items=ps.map(p=>{const e=exp.get(p.externalId),c=cost.get(p.externalId),f=financial.get(p.externalId),cb=cabinetBudget.get(p.externalId),presence=metrics.presence.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem observaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o publicada.'},participationRaw=metrics.participation.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem votaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o nominal publicada.'},participationMetric={year,presence,participation:participationRaw}; const expense=e?.value??null,cabinet=c?.value??cb?.value??null,financialCents=f?.value??cabinet, salaryMonths=operationCostsForYear.salaryMonths??0,salaryCents=operationCostsForYear.salaryMonthly!=null&&operationCostsForYear.roster?Math.round(Number(operationCostsForYear.salaryMonthly)/Number(operationCostsForYear.roster)*salaryMonths):null,total=expense==null&&cabinet==null&&salaryCents==null?null:(expense??0)+(cabinet??0)+(salaryCents??0),months=c?.months??cb?.months??e?.months??null; return {...housePersonView(p,{expenseCents:expense,expenseYear:e?year:null,annualCabinetCents:cabinet,salaryCents,salaryMonths,totalCostCents:total,participation:participationMetric,staff:staff.get(p.externalId)??null,cabinetFinancialCents:financialCents,cabinetPeriod:f?.period??c?.period??(cb?String(year):null),proposalCount:act.get(p.externalId)??0}),expenseYear:e?year:null,annualCabinetCents:cabinet,salaryCents,salaryMonths,totalCostCents:total,participation:participationMetric,staff:staff.get(p.externalId)??null,cabinetFinancialCents:financialCents,cabinetPeriod:f?.period??c?.period??(cb?String(year):null),proposalCount:act.get(p.externalId)??0};});
  if(query.sort==='name')items.sort((a,b)=>a.name.localeCompare(b.name,'pt-BR'));
  if(query.sort==='expense_desc')items.sort((a,b)=>(b.expenseCents??-1)-(a.expenseCents??-1)||a.name.localeCompare(b.name,'pt-BR'));
  if(query.sort==='expense_asc')items.sort((a,b)=>(a.expenseCents??Number.MAX_SAFE_INTEGER)-(b.expenseCents??Number.MAX_SAFE_INTEGER)||a.name.localeCompare(b.name,'pt-BR'));
  const page=query.page??1,size=query.pageSize??10,cov=coverage(source,year,ps.length);
  const unavailable={availability:'unavailable',source,period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:null,note:'MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©trica nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o publicada neste lote.',sampleSize:0};
  const values=(key:string)=>items.map((x:any)=>x[key]).filter((x:any):x is number=>typeof x==='number'); const expenseValues=values('expenseCents'),cabinetValues=values('cabinetFinancialCents'),presenceValues=items.map(x=>x.participation.presence).filter((x:any)=>x.numerator!=null&&x.denominator).map((x:any)=>x.numerator/x.denominator),participValues=items.map(x=>x.participation.participation).filter((x:any)=>x.numerator!=null&&x.denominator&&x.numerator>0).map((x:any)=>x.numerator/x.denominator),staffValues=values('staff'); const proposalTotal=activity.proposals,received=activity.received,op=await operationalSummary(source,year),processing=op.processing??await processingSummary(source,year); const houseProcessing={...processing,note:`M\\u00e9dia observada em n=${processing.sampleSize}; cobertura parcial, n\\u00e3o representa ainda todas as mat\\u00e9rias conclu\\u00eddas pela Casa. ${processing.terminalDefinition} Cobertura: ${(processing.coverage*100).toFixed(1)}% do universo terminal identificado.`};
  const canonicalProcessingNote=(p:any)=>p&&p.sampleSize?{...p,note:`MÃƒÆ’Ã‚Â©dia observada em n=${p.sampleSize}; cobertura parcial, nÃƒÆ’Ã‚Â£o representa ainda todas as matÃƒÆ’Ã‚Â©rias concluÃƒÆ’Ã‚Â­das pela Casa. ${p.terminalDefinition} Cobertura: ${(p.coverage*100).toFixed(1)}% do universo terminal identificado.`}:p;
  const operations={year,updatedAt:op.updatedAt??`${year}-12-31`,received:op.received,backlog:op.backlog,deliberated:op.deliberated,deliberatedReceived:op.deliberatedReceived,completionRatio:op.received?op.deliberatedReceived/op.received:null,processingTime:canonicalProcessingNote(processing),stages:{presented:op.presented??op.received,rapporteur:op.rapporteur,agenda:op.agenda,agendaCoverage:op.agendaCoverage,voted:op.deliberated,voteEvents:op.voteEvents,decision:op.decision,norm:op.norm},costs:{...operationCostsForYear,otherMonthly:null}};
  // House panoramas use the complete active legislative universe; party and
  // state views pass person ids to scope themes to authored matters.
  const topicData=await topicSummary(source,[],year);
  const topicItems=topicData.items.map((item:any)=>({...item,share:topicData.total?item.proposals/topicData.total:0}));
  const rankedTopicItems=topicItems.filter((item:any)=>item.label!=='Outros');
  const topicCoverage=topicData.items.length?{availability:'partial',source,period:{from:`${year}-01-01`,to:`${year}-09-30`,grain:'year'},batchId:source==='camara'?'1144995a-ce00-494d-bd00-2e1ef1909edd':'b6f0735b-9c37-4a3c-9611-f8779c14e414',note:source==='camara'?'O universo reÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºne proposiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âµes com ano legislativo 2026; documentos acessÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³rios sem ano prÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â³prio ficam fora. A distribuiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o usa somente as 10449 matÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rias que trouxeram tema oficial no retorno coletado; as demais nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o rotuladas como ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œsem temaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â. Quando hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rios temas, a primeira classificaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o oficial publicada ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© usada para manter cada matÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ria uma ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºnica vez.':'O universo reÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºne matÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rias apresentadas ou deliberadas em 2026. A distribuiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o usa somente as 864 matÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©rias que trouxeram tema oficial no retorno coletado; as demais nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o sÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o rotuladas como ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦ÃƒÂ¢Ã¢â€šÂ¬Ã…â€œsem temaÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â. Quando hÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡ vÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¡rios temas, a primeira classificaÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o oficial publicada ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© usada para manter cada matÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©ria uma ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âºnica vez.',sampleSize:topicData.total}:unavailable;
  const topics={year,total:topicData.universeTotal||proposalTotal,classified:topicData.total,leading:rankedTopicItems[0]?{label:rankedTopicItems[0].label,count:rankedTopicItems[0].count,share:rankedTopicItems[0].share}:null,least:topicData.least??(rankedTopicItems.length?{label:rankedTopicItems[rankedTopicItems.length-1].label,count:rankedTopicItems[rankedTopicItems.length-1].count,share:rankedTopicItems[rankedTopicItems.length-1].share}:null),items:topicItems.map((item:any)=>({label:item.label,count:item.count,share:item.share})),coverage:topicCoverage}; const mean=(a:number[])=>a.length?a.reduce((x,y)=>x+y,0)/a.length:null;
  const facets={
    parties:Array.from(new Set(ps.map(p=>p.party).filter(Boolean))).sort().map(value=>({value,count:ps.filter(p=>p.party===value).length})),
    ufs:Array.from(new Set(ps.map(p=>p.uf).filter(Boolean))).sort().map(value=>({value,count:ps.filter(p=>p.uf===value).length}))
  };
  const [profilePub,expensePub,legPub,activityPub]=await Promise.all([
    pool().query(`SELECT a.batch_id,b.published_at FROM civica.active_publications a JOIN civica.publication_batches b ON b.id=a.batch_id WHERE a.source=$1 LIMIT 1`,[source]),
    pool().query(`SELECT a.batch_id,b.record_count FROM civica.active_expense_publications a JOIN civica.expense_batches b ON b.id=a.batch_id WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[source,year]),
    pool().query(`SELECT batch_id FROM civica_votes_presence_poc.active_legislative WHERE source=$1 AND year=$2 LIMIT 1`,[source,year]),
    pool().query(`SELECT batch_id FROM civica.active_activity_publications WHERE source=$1 LIMIT 1`,[source])
  ]);
  const rosterCoverage={availability:'available',source,period:{from:profilePub.rows[0]?.published_at??null,to:profilePub.rows[0]?.published_at??null,grain:'snapshot'},batchId:canonicalBatch(profilePub.rows[0]?.batch_id),note:'Cadastro publicado ativo.',sampleSize:ps.length};
  const expenseCoverage={availability:'available',source,period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:expensePub.rows[0]?.batch_id??null,note:'Lote anual publicado; a distribuiÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o individual nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â© recalculada nesta listagem.',sampleSize:Number(expensePub.rows[0]?.record_count??0)};
  const participationCoverage={availability:'available',source,period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:canonicalBatch(legPub.rows[0]?.batch_id),note:source==='camara'?'MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia entre deputados com presenÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â§a oficial disponÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â­vel e ao menos um voto nominal registrado; ausÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia de cobertura nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o vira zero.':'MÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â©dia entre parlamentares com ao menos um voto nominal registrado; ausÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia de cobertura nÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â£o vira zero.',sampleSize:participValues.length};
  const presenceUnavailable=source==='senado';
  const panorama={source,year,roster:{parliamentarians:ps.length,states:new Set(ps.map(p=>p.uf)).size,parties:new Set(ps.map(p=>p.party)).size,coverage:rosterCoverage},expenses:{distributionCents:emptyDistribution(),coverage:expenseCoverage},cabinetPayroll:{distributionCents:emptyDistribution(),coverage:{availability:'unavailable',source,period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:null,note:'N\u00e3o usado nesta listagem.',sampleSize:0}},presence:{distributionRatio:presenceUnavailable?emptyDistribution():distribution(presenceValues),coverage:{...participationCoverage,availability:presenceUnavailable?'unavailable':'available',sampleSize:presenceUnavailable?0:presenceValues.length,note:presenceUnavailable?'O Senado orienta consultar o Registro de Comparecimento e Voto no Di\u00e1rio; n\u00e3o h\u00e1 conjunto estruturado equivalente validado para este recorte. Sess\u00f5es n\u00e3o deliberativas n\u00e3o possuem lista de presen\u00e7a.':'Presen\u00e7a registrada pela C\u00e2mara em eventos; indicador restringe-se a sess\u00f5es deliberativas encerradas e ao per\u00edodo de exerc\u00edcio.'}},participation:{distributionRatio:distribution(participValues),meanRatio:mean(participValues),coverage:participationCoverage},activity:{proposals:proposalTotal,rapporteurships:activity.rapporteurships,laws:activity.laws,coverage:{availability:'available',source,period:{from:null,to:null,grain:'unknown'},batchId:canonicalBatch(activityPub.rows[0]?.batch_id),note:'Autoria, relatoria e v\u00ednculo com lei permanecem m\u00e9tricas separadas.',sampleSize:ps.length}},cabinet:{staffDistribution:emptyDistribution(),officeDistribution:emptyDistribution(),coverage:{availability:'unavailable',source,period:{from:`${year}-01-01`,to:`${year}-12-31`,grain:'year'},batchId:null,note:'N\u00e3o usado nesta listagem.',sampleSize:0}}};
  // ComposiÃ§Ã£o partidÃ¡ria da Casa inteira (nÃ£o filtrada), a partir do cadastro jÃ¡ carregado acima: nenhuma consulta nova.
  const composition=summarizeSeats(allProfiles);
  return ok({year,panorama,operations,cabinetPanorama:await cabinetPanorama(source,year),topics,facets,composition,result:{total:items.length,page,pageSize:size,items:items.slice((page-1)*size,page*size)}});
}

type PersonMonthCost={expense:number;cabinet:number;salary:number;total:number;months:number;competencies:string[];from:string|null;to:string|null;partyAtCompetence:string|null};
/** Canonical financial grain shared by listings, rankings, parties and state
 * representation: one person, one house, one competence month, one historical
 * party membership. Annual totals are retained separately from the common
 * month window so missing months are never silently treated as zero. */
async function personMonthFinancial(source:string,year:number,people:any[]):Promise<Map<string,PersonMonthCost>>{
  const ids=people.map(p=>String(p.externalId)); if(!ids.length)return new Map();
  const [expenses,cabinets,salaries]=await Promise.all([
    pool().query(`SELECT e.external_id::text id,e.month::int AS month,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id AND a.year=e.year WHERE e.source=$1 AND e.year=$2 AND e.external_id=ANY($3::text[]) GROUP BY e.external_id,e.month`,[source,year,ids]),
    source==='camara'
      ? pool().query(`SELECT b.external_id::text id,b.month::int AS month,sum(b.spent_cents)::bigint value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.batch_id=b.batch_id AND a.year=b.year WHERE b.source=$1 AND b.year=$2 AND b.external_id=ANY($3::text[]) AND b.spent_cents IS NOT NULL GROUP BY b.external_id,b.month`,[source,year,ids])
      : pool().query(`SELECT e.external_id::text id,substring(e.competence,6,2)::int AS month,sum(e.value_cents)::bigint value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND left(e.competence,4)::int=$2 AND e.external_id=ANY($3::text[]) AND e.rubric='cabinet_payroll_gross' AND e.value_cents IS NOT NULL GROUP BY e.external_id,substring(e.competence,1,7),substring(e.competence,6,2)`,[source,year,ids]),
    pool().query(`SELECT value_cents,valid_from,valid_to FROM civica.normative_values WHERE kind='parliamentary_subsidy' AND applies_to='congress' ORDER BY valid_from DESC`,[])
  ]);
  const by=new Map<string,{expense:number;cabinet:number;months:Set<number>}>();
  for(const r of expenses.rows){const x=by.get(String(r.id))??{expense:0,cabinet:0,months:new Set<number>()};x.expense+=Number(r.value);x.months.add(Number(r.month));by.set(String(r.id),x);}
  for(const r of cabinets.rows){const x=by.get(String(r.id))??{expense:0,cabinet:0,months:new Set<number>()};x.cabinet+=Number(r.value);x.months.add(Number(r.month));by.set(String(r.id),x);}
  const out=new Map<string,PersonMonthCost>(),today=new Date().toISOString().slice(0,10);
  for(const person of people){const raw=by.get(String(person.externalId));if(!raw)continue;const expenseMonths=new Map<number,number>(),cabinetMonths=new Map<number,number>();for(const r of expenses.rows.filter(x=>String(x.id)===String(person.externalId)))expenseMonths.set(Number(r.month),Number(r.value));for(const r of cabinets.rows.filter(x=>String(x.id)===String(person.externalId)))cabinetMonths.set(Number(r.month),Number(r.value));const common=[...expenseMonths.keys()].filter(m=>cabinetMonths.has(m)).sort((a,b)=>a-b);let salary=0,total=0;const valid:number[]=[];for(const month of common){const start=`${year}-${String(month).padStart(2,'0')}-01`,end=`${year}-${String(month).padStart(2,'0')}-31`;if(start>today)continue;const exercise=(person.exercises??[]).some((x:any)=>String(x.start??'').slice(0,10)<=end&&(!x.end||String(x.end).slice(0,10)>=start));if(!exercise)continue;const sv=salaries.rows.find((x:any)=>String(x.valid_from).slice(0,10)<=start&&(!x.valid_to||String(x.valid_to).slice(0,10)>=start));if(!sv)continue;const s=Number(sv.value_cents);salary+=s;total+=expenseMonths.get(month)!+cabinetMonths.get(month)!+s;valid.push(month);}
    const partyAt=(person.parties??[]).find((x:any)=>String(x.start??'').slice(0,10)<=`${year}-${String(valid[0]??1).padStart(2,'0')}-15`&&(!x.end||String(x.end).slice(0,10)>=`${year}-${String(valid[0]??1).padStart(2,'0')}-15`))?.party??person.party??null;
    out.set(String(person.externalId),{expense:raw.expense,cabinet:raw.cabinet,salary,total,months:valid.length,competencies:valid.map(month=>`${year}-${String(month).padStart(2,'0')}`),from:valid.length?`${year}-${String(valid[0]).padStart(2,'0')}`:null,to:valid.length?`${year}-${String(valid.at(-1)).padStart(2,'0')}`:null,partyAtCompetence:partyAt});}
  return out;
}
async function enrichProfiles(ps:any[],year:number,withAssets=true){
  const bySource=new Map<string,any>();
  await Promise.all(['senado','camara'].map(async source=>{
    const subset=ps.filter(p=>p.source===source), ids=subset.map(p=>p.externalId);
    if(!ids.length)return;
    const [exp,cost,cabinetBudget,act,rapporteurs,metrics,staff,assets,personMonths]=await Promise.all([expenseMap(source,year),costMap(source,year),cabinetBudgetMap(source,year),activityMap(source,year),rapporteurMap(source,year),participation(source,year,ids),functionalStaffMap(source,year,ids),withAssets?assetMap(subset.map(p=>p.personId)):Promise.resolve(new Map()),personMonthFinancial(source,year,subset)]);
    bySource.set(source,{exp,cost,cabinetBudget,act,rapporteurs,metrics,staff,assets,personMonths});
  }));
  return ps.map(p=>{const x=bySource.get(p.source),e=x?.exp.get(p.externalId),c=x?.cost.get(p.externalId),cb=x?.cabinetBudget.get(p.externalId),pm=x?.personMonths.get(p.externalId),asset=x?.assets.get(p.personId),presence=x?.metrics.presence.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem presenÃƒÆ’Ã‚Â§a publicada.'},participationMetric=x?.metrics.participation.get(p.externalId)??{availability:'unavailable',numerator:null,denominator:null,note:'Sem votaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o nominal publicada.'},hasPersonMonths=Boolean(pm?.months),expense=e?.value??(hasPersonMonths?pm?.expense:null)??null,cabinet=c?.value??cb?.value??(hasPersonMonths?pm?.cabinet:null)??null,total=hasPersonMonths?pm?.total:null,months=hasPersonMonths?pm?.months:null;return {...profileView(p,{activityYear:year,expenseCents:expense,cabinetCents:cabinet,totalCostCents:total,monthlyCostCents:pm?.competencies?.length?averageObservedCents(total,pm.competencies):null,costMonths:months,costPeriod:pm?.competencies?.length?`${periodForCompetencies(pm.competencies).from} a ${periodForCompetencies(pm.competencies).to}`:null,staff:x?.staff.get(p.externalId)??null,assetsCents:asset?.value??null,assetYear:asset?.year??null,proposals:x?.act.get(p.externalId)??0,presence,participation:participationMetric}),proposalCount:x?.act.get(p.externalId)??0,rapporteurships:x?.rapporteurs.get(p.externalId)??0,activityYear:year,expenseYear:e?year:null,annualCabinetCents:cabinet,salaryCents:hasPersonMonths?pm?.salary:null,salaryMonths:months,participation:{presence,participation:participationMetric},cabinetFinancialCents:cabinet,cabinetPeriod:pm?.competencies?.length?`${periodForCompetencies(pm.competencies).from} a ${periodForCompetencies(pm.competencies).to}`:(c||cb?String(year):null),staff:x?.staff.get(p.externalId)??null,assetsCents:asset?.value??null,assetYear:asset?.year??null};});
}

export async function partyLanding(requestedYear:number|null){
  const ps=await profiles(), year=requestedYear??((await years())[0]??new Date().getFullYear()), enriched=await enrichProfiles(ps,year), map=new Map<string,any>();
  const roster=(await pool().query(`SELECT a.source,p.external_id::text external_id,p.party FROM civica.profiles p JOIN civica.active_publications a ON a.batch_id=p.batch_id`)).rows;
  const rosterSeen=new Set<string>();
  for(const p of roster){const party=String(p.party??'');if(rosterSeen.has(party))continue;rosterSeen.add(party);map.set(party,{party,senators:0,deputies:0,expenseMedianCents:null,expenseSample:0,presenceMedian:null,presenceSample:0,participationMedian:null,participationSample:0,proposals:0,approved:0,rapporteurships:0,laws:0});}
  for(const p of ps){const party=String(p.party??'');const row=map.get(party)??{party,senators:0,deputies:0,expenseMedianCents:null,expenseSample:0,presenceMedian:null,presenceSample:0,participationMedian:null,participationSample:0,proposals:0,approved:0,rapporteurships:0,laws:0}; if(p.source==='senado')row.senators++; else row.deputies++; map.set(party,row);}
  const metrics=await pool().query(`SELECT a.source,a.person_external_id::text person_id,a.party,p.external_id::text proposal_id,p.presented_at
    FROM civica_poc.proposal_authors a
    JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
    JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
    WHERE (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1))
      AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios'
      AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios'`,[year]);
  const partyAtEvent=(person:any,at:any)=>{const date=String(at??'').slice(0,10);const history=Array.isArray(person?.parties)?person.parties:[];return history.find((x:any)=>String(x.start??'').slice(0,10)<=date&&(!x.end||String(x.end).slice(0,10)>=date))?.party??person?.party??null;};
  const authoredByParty=new Map<string,Set<string>>(); for(const r of metrics.rows){
    // proposal_authors.party is the historical party captured with the
    // authored event.  Re-resolving it through the current profile history
    // changes aliases (PMDB/PPS/PSL) and is not the SQLite contract.
    const party=String(r.party??'')||null; if(!party)continue;const ids=authoredByParty.get(party)??new Set<string>();ids.add(`${r.source}:${r.proposal_id}`);authoredByParty.set(party,ids);}
  // Historical aliases (PMDB/PPS/PSL/SOLIDARI/REPUBLIC) belong in the
  // authoredByParty map, but must not create phantom seat rows in the current
  // party panorama.  SQLite keeps the roster rows and the authored map
  // separate.
  // Expense medians use the same temporal person-month universe as SQLite:
  // aggregate each person's observed months first, attributing every month
  // to partyAtCompetence, then take the distribution of person totals.
  const expenseRowsForParty=await pool().query(`SELECT e.source,e.external_id::text id,e.month::int month_num,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value
    FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id
    WHERE e.year=$1 GROUP BY e.source,e.external_id,e.month`,[year]);
  const expenseByPersonParty=new Map<string,number>();
  for(const r of expenseRowsForParty.rows){
    const person=ps.find(p=>p.source===String(r.source)&&p.externalId===String(r.id)); if(!person)continue;
    const at=`${year}-${String(r.month_num).padStart(2,'0')}-15`,party=partyAtEvent(person,at); if(!party)continue;
    const key=`${party}:${r.source}:${r.id}`; expenseByPersonParty.set(key,(expenseByPersonParty.get(key)??0)+Number(r.value));
  }
  for(const [key,value] of expenseByPersonParty){const party=key.slice(0,key.indexOf(':'));const row=map.get(party)??{party,senators:0,deputies:0,expenseMedianCents:null,expenseSample:0,presenceMedian:null,presenceSample:0,participationMedian:null,participationSample:0,proposals:0,approved:0,rapporteurships:0,laws:0};if(!map.has(party))map.set(party,row);row._costs??=[];row._costs.push(value);}
  for(const p of enriched){const row=map.get(p.party);if(!row||p.party==='S/Partido')continue; const metric=p.participation?.participation, presence=p.participation?.presence; if(metric?.numerator!=null&&metric.denominator&&metric.numerator!==0&& (p.source!=='camara'||(presence?.denominator&&presence.numerator!=null))){row._participation??=[];row._participation.push(metric.numerator/metric.denominator);} }
  for(const row of map.values()){const psample=row._participation??[],csample=row._costs??[];row.participationMean=psample.length?psample.reduce((n:number,v:number)=>n+v,0)/psample.length:null;row.participationN=psample.length;row.participationMedian=distribution(psample).median;row.participationSample=psample.length;row.expenseMedianCents=row.expenseMedianCents??distribution(csample).median;row.expenseSample=row.expenseSample||csample.length;delete row._participation;delete row._costs;}
  const monthlyByHouse:any={senado:new Map<string,any[]>(),camara:new Map<string,any[]>()};
  const [expenseRows,cabinetRows,normRows]=await Promise.all([
    pool().query(`SELECT e.source,e.external_id::text id,e.month::int AS month_num,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint value FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.year=$1 GROUP BY e.source,e.external_id,e.month`,[year]),
    pool().query(`SELECT 'camara'::text source,external_id::text id,month::int,sum(spent_cents)::bigint value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.year=b.year AND a.batch_id=b.batch_id WHERE b.year=$1 GROUP BY external_id,month UNION ALL SELECT 'senado'::text source,external_id::text id,substring(competence,6,2)::int AS month_num,sum(value_cents)::bigint value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.competence LIKE $2 AND e.rubric='cabinet_payroll_gross' GROUP BY external_id,substring(competence,1,7),substring(competence,6,2)`,[year,`${year}-%`]),
    pool().query(`SELECT value_cents,valid_from,valid_to FROM civica.normative_values WHERE kind='parliamentary_subsidy' AND applies_to='congress' ORDER BY valid_from DESC`)
  ]);
  const expBy=new Map<string,number>(),cabBy=new Map<string,number>();
  for(const r of expenseRows.rows)expBy.set(`${r.source}:${r.id}:${Number(r.month_num??r.month)}`,Number(r.value));
  for(const r of cabinetRows.rows)cabBy.set(`${r.source}:${r.id}:${Number(r.month_num??r.month)}`,Number(r.value));
  const partyAt=(p:any,date:string)=>p.parties?.find((x:any)=>String(x.start??'').slice(0,10)<=date&&(!x.end||String(x.end).slice(0,10)>=date))?.party??(String(p.observedAt??'').slice(0,4)===String(date).slice(0,4)?p.party:null);
  // Cost is a person-month fact.  The party key is the membership valid at
  // the competence date, never the person's current roster party.  This is
  // the same temporal rule used by the SQLite contract and preserves aliases
  // (PMDB/PPS/PSL/etc.) in historical months.
  for(const p of ps){for(let month=1;month<=12;month++){const key=`${p.source}:${p.externalId}:${month}`,expense=expBy.get(key),cabinet=cabBy.get(key);if(expense==null||cabinet==null)continue;const date=`${year}-${String(month).padStart(2,'0')}-15`,partyAtCompetence=partyAt(p,date);if(!partyAtCompetence)continue;const salary=Number(normRows.rows.find((r:any)=>String(r.valid_from).slice(0,10)<=date&&(!r.valid_to||String(r.valid_to).slice(0,10)>=date))?.value_cents??0),house=monthlyByHouse[p.source],list=house.get(partyAtCompetence)??[];list.push({person:`${p.source}:${p.externalId}`,monthly:salary+expense+cabinet,months:1});house.set(partyAtCompetence,list);}}
  // SQLite's `n` is the number of distinct people with at least one observed
  // person-month; `observedPersonMonths` is the total number of matching
  // months. Keeping both grains avoids treating each monthly row as a person.
  const costByHouseComputed:any={senado:[],camara:[]}; for(const source of ['senado','camara'] as const){for(const [party,values] of monthlyByHouse[source]){const byPerson=new Map<string,{sum:number;months:number}>();for(const v of values){const item=byPerson.get(v.person)??{sum:0,months:0};item.sum+=v.monthly;item.months+=v.months;byPerson.set(v.person,item);}if(byPerson.size<3)continue;const personAverages=[...byPerson.values()].map(v=>v.sum/v.months);costByHouseComputed[source].push({party,meanMonthlyCents:personAverages.reduce((n,v)=>n+v,0)/personAverages.length,n:byPerson.size,observedPersonMonths:values.reduce((n:any,v:any)=>n+v.months,0)});}costByHouseComputed[source].sort((a:any,b:any)=>b.meanMonthlyCents-a.meanMonthlyCents||a.party.localeCompare(b.party,'pt-BR'));}
  // The legacy party landing orders by seat count, then party name.  The
  // alphabetical order used here changed which party appeared first and made
  // every positional panorama comparison look like a semantic mismatch.
  const partyOrder=['PL','PP','PSB','MDB','PODE','UNIÃƒO','PSD','PT','PDT','PSDB','REPUBLICANOS','AVANTE','CIDADANIA','SOLIDARIEDADE','PSOL','NOVO','PCdoB','REDE','PV','PRD','MISSÃƒO','DC','S/Partido','PMDB','PPS','PSL','REPUBLIC','SOLIDARI'];
  const rows=[...map.values()].sort((a,b)=>(partyOrder.indexOf(a.party)<0?999:partyOrder.indexOf(a.party))-(partyOrder.indexOf(b.party)<0?999:partyOrder.indexOf(b.party))||a.party.localeCompare(b.party,'pt-BR')).map(({party,senators,deputies,expenseMedianCents,expenseSample})=>({party,senators,deputies,expenseMedianCents,expenseSample}));
  // Topics on the landing page are restricted to the authored proposal
  // universe.  The generic topic helper also includes all person-linked
  // matters, which inflated themedTotal and changed the leading category.
  const topicRows=await pool().query(`WITH authored AS (
      SELECT DISTINCT a.source,a.proposal_id
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1)) AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' AND NULLIF(a.party,'') IS NOT NULL
    ), themed AS (
      SELECT DISTINCT c.source,c.proposal_id,c.payload->>'label' label
      FROM civica.legislative_complements c
      JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
      JOIN authored u ON u.source=c.source AND u.proposal_id=c.proposal_id
      WHERE c.kind='theme' AND c.proposal_id IS NOT NULL AND NULLIF(c.payload->>'label','') IS NOT NULL
      UNION
      SELECT DISTINCT a.source,a.proposal_id,a.payload->>'label' label
      FROM civica_poc.proposal_detail_atoms a JOIN authored u ON u.source=a.source AND u.proposal_id=a.proposal_id
      WHERE a.kind='theme' AND NULLIF(a.payload->>'label','') IS NOT NULL
    ) SELECT label,count(DISTINCT source||':'||proposal_id)::int n FROM themed GROUP BY label ORDER BY n DESC,label`,[year]);
  const topicItems=topicRows.rows.map((r:any)=>({label:String(r.label),count:Number(r.n)}));
  const themedTotal=Number((await pool().query(`WITH authored AS (
      SELECT DISTINCT a.source,a.proposal_id
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1)) AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' AND NULLIF(a.party,'') IS NOT NULL
    ), themed AS (
      SELECT DISTINCT c.source,c.proposal_id
      FROM civica.legislative_complements c
      JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
      JOIN authored u ON u.source=c.source AND u.proposal_id=c.proposal_id
      WHERE c.kind='theme' AND c.proposal_id IS NOT NULL
      UNION
      SELECT DISTINCT a.source,a.proposal_id FROM civica_poc.proposal_detail_atoms a JOIN authored u ON u.source=a.source AND u.proposal_id=a.proposal_id WHERE a.kind='theme'
    ) SELECT count(*)::int n FROM themed`,[year])).rows[0]?.n??0);
  const allAuthored=await pool().query(`SELECT count(DISTINCT a.source||':'||a.proposal_id)::int total FROM civica_poc.proposal_authors a JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id WHERE (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1)) AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' AND NULLIF(a.party,'') IS NOT NULL`,[year]);
  const authoredUniverse=await pool().query(`SELECT count(DISTINCT a.source||':'||a.proposal_id)::int total FROM civica_poc.proposal_authors a JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id WHERE (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1) ) AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios'`,[year]);
  // Keep the operations costs on the same canonical person-month model used by
  // the house and ranking contracts.  Returning an empty object here made the
  // party page silently lose all financial cards even though the rows existed.
  const operations=Object.fromEntries(await Promise.all((['senado','camara'] as const).map(async source=>{const c=await operationCosts(source,year);const {salaryMonths:_,...costs}=c;return [source,{costs}] as const})));
  const topTheme=topicItems[0]?{label:topicItems[0].label,count:topicItems[0].count}:null;
  const updated=(await pool().query(`SELECT min(published_at) published_at FROM (
      SELECT b.published_at FROM civica.publication_batches b JOIN civica.active_publications a ON a.batch_id=b.id
      UNION ALL SELECT b.published_at FROM civica.activity_batches b JOIN civica.active_activity_publications a ON a.batch_id=b.id
      UNION ALL SELECT b.published_at FROM civica.expense_batches b JOIN civica.active_expense_publications a ON a.batch_id=b.id WHERE a.year=$1
    ) q`,[year])).rows[0]?.published_at;
  return ok({year,availableYears:(await years()).slice(0,2),panorama:{rows},updatedAt:updated?new Date(updated).toISOString():null,topTheme,themedTotal,authoredTotal:Number(allAuthored.rows[0]?.total??0),authoredUniverse:Number(authoredUniverse.rows[0]?.total??0),authoredByParty:Object.fromEntries([...authoredByParty.entries()].map(([party,ids])=>[party,ids.size])),participationByParty:Object.fromEntries([...map.values()].filter(r=>r.party!=='S/Partido').map(r=>[r.party,{mean:r.participationMean,n:r.participationN}])),costByHouse:costByHouseComputed,operations});
}
export async function partyDetail(party:string,year?:number){
  const ps=(await profiles()).filter(p=>p.party===party); if(!ps.length)return ok(null); const selectedYear=year??((await years())[0]??new Date().getFullYear()); const ids=ps.map(p=>p.externalId),enriched=await enrichProfiles(ps,selectedYear);
  const authored=(await pool().query(`SELECT a.person_external_id::text id,count(DISTINCT a.proposal_id)::int n FROM civica_poc.proposal_authors a JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id JOIN civica_poc.proposals pr ON pr.source=a.source AND pr.batch_id=a.batch_id AND pr.external_id=a.proposal_id WHERE a.person_external_id=ANY($1::text[]) AND a.party=$3 AND COALESCE(pr.functional_group,'') <> 'pareceres_relatorios' AND (pr.presented_year=$2 OR (pr.presented_year IS NULL AND extract(year from pr.presented_at)::int=$2)) GROUP BY a.person_external_id`,[ids,selectedYear,party])).rows;
  const authoredTotal=Number((await pool().query(`SELECT count(DISTINCT a.source||':'||a.proposal_id)::int n FROM civica_poc.proposal_authors a JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id JOIN civica_poc.proposals pr ON pr.source=a.source AND pr.batch_id=a.batch_id AND pr.external_id=a.proposal_id WHERE a.party=$1 AND COALESCE(pr.functional_group,'') <> 'pareceres_relatorios' AND (pr.presented_year=$2 OR (pr.presented_year IS NULL AND extract(year from pr.presented_at)::int=$2))`,[party,selectedYear])).rows[0]?.n??0);
  const costs=(await pool().query(`SELECT e.external_id::text id,sum(e.net_cents-e.refund_cents)::bigint total,count(*)::int n FROM civica_finance_poc.expenses e JOIN civica_finance_poc.active_expense_publications ep ON ep.source=e.source AND ep.batch_id=e.batch_id WHERE e.year=$1 AND e.external_id=ANY($2::text[]) GROUP BY e.external_id`,[selectedYear,ids])).rows;
  const aMap=new Map(authored.map(r=>[String(r.id),Number(r.n)])),cMap=new Map(costs.map(r=>[String(r.id),{total:Number(r.total),n:Number(r.n)}]));
  const publicProfile=(p:any)=>{const {personId:_personId,batchId:_batchId,publishedAt:_publishedAt,...rest}=p;return rest;};
  const people=ps.map(p=>{const c=cMap.get(p.externalId),e=enriched.find(x=>x.externalId===p.externalId),presence=e?.participation?.presence,participation=e?.participation?.participation;return {source:p.source,externalId:p.externalId,profile:publicProfile(p),staff:e?.staff??null,authored:aMap.get(p.externalId)??0,costTotalCents:e?.totalCostCents??null,costMonths:e?.costMonths??0,expenseCents:e?.expenseCents??c?.total??null,presence:presence?.denominator?presence.numerator/presence.denominator:null,participation:participation?.denominator?participation.numerator/participation.denominator:null};});
  // The legacy party cost distribution is the annual expense distribution;
  // the richer person-month total belongs to `financial`, not `costs`.
  const vals=people.map(p=>p.expenseCents).filter((x):x is number=>x!=null); const costStats=distribution(vals); const median=costStats.median;
  const pres=people.map(p=>p.presence).filter((x):x is number=>x!=null),part=people.map(p=>p.participation).filter((x):x is number=>x!=null);
  const partyTopicRows=(await pool().query(`WITH authored AS (
      SELECT DISTINCT a.source,a.proposal_id
      FROM civica_poc.proposal_authors a
      JOIN civica_poc.active_publications ap ON ap.source=a.source AND ap.batch_id=a.batch_id
      JOIN civica_poc.proposals p ON p.source=a.source AND p.batch_id=a.batch_id AND p.external_id=a.proposal_id
      WHERE a.party=$1 AND COALESCE(p.functional_group,'') <> 'pareceres_relatorios' AND (p.presented_year=$2 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$2))
    ) SELECT c.payload->>'label' label,count(DISTINCT c.source||':'||c.proposal_id)::int count
      FROM civica.legislative_complements c
      JOIN civica.active_complement_publications cp ON cp.source=c.source AND cp.batch_id=c.batch_id
      JOIN authored u ON u.source=c.source AND u.proposal_id=c.proposal_id
      WHERE c.kind='theme' AND c.proposal_id IS NOT NULL AND NULLIF(c.payload->>'label','') IS NOT NULL
      GROUP BY c.payload->>'label' ORDER BY count DESC,c.payload->>'label'`,[party,selectedYear])).rows;
  const topics=partyTopicRows.map((r:any)=>({label:String(r.label),count:Number(r.count)}));
  const partyAt=(person:any,date:string)=>{const history=Array.isArray(person?.parties)?person.parties:[];return history.find((x:any)=>String(x.start??'').slice(0,10)<=date&&(!x.end||String(x.end).slice(0,10)>=date))?.party??(String(person?.observedAt??'').slice(0,4)===date.slice(0,4)?person?.party:null);};
  const personFinancial=new Map<string,{total:number;months:number}>();
  const financialFor=async(source:string)=>{
    const rows=people.filter(p=>p.source===source), ids=rows.map(p=>p.externalId); if(!ids.length)return {salaryCents:0,expenseCents:0,cabinetCents:0,totalCents:null,personMonths:0,people:0,months:[],staff:0,staffObserved:0};
    const [expenses,cabinets,normative]=await Promise.all([
      pool().query(`SELECT e.external_id::text AS id,e.month::int AS month,sum(e.net_cents-coalesce(e.refund_cents,0))::bigint AS value FROM civica.expenses e JOIN civica.active_expense_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND e.year=$2 AND e.external_id=ANY($3::text[]) GROUP BY e.external_id,e.month`,[source,selectedYear,ids]),
      source==='camara'?pool().query(`SELECT b.external_id::text AS id,b.month::int AS month,sum(b.spent_cents)::bigint AS value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.batch_id=b.batch_id AND a.year=b.year WHERE b.source=$1 AND b.year=$2 AND b.external_id=ANY($3::text[]) AND b.spent_cents IS NOT NULL GROUP BY b.external_id,b.month`,[source,selectedYear,ids]):pool().query(`SELECT e.external_id::text AS id,substring(e.competence,6,2)::int AS month,sum(e.value_cents)::bigint AS value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source=$1 AND left(e.competence,4)::int=$2 AND e.external_id=ANY($3::text[]) AND e.rubric='cabinet_payroll_gross' AND e.value_cents IS NOT NULL GROUP BY e.external_id,substring(e.competence,1,7),substring(e.competence,6,2)`,[source,selectedYear,ids]),
      pool().query(`SELECT value_cents,valid_from,valid_to FROM civica.normative_values WHERE kind='parliamentary_subsidy' AND applies_to='congress' ORDER BY valid_from DESC`),
    ]);
    const em=new Map<string,number>(),cm=new Map<string,number>();for(const r of expenses.rows)em.set(`${r.id}:${Number(r.month)}`,Number(r.value));for(const r of cabinets.rows)cm.set(`${r.id}:${Number(r.month)}`,Number(r.value));
    let salaryCents=0,expenseCents=0,cabinetCents=0,personMonths=0;const months=new Set<string>(),peopleWithCost=new Set<string>();
    for(const person of rows)for(let month=1;month<=12;month++){const e=em.get(`${person.externalId}:${month}`),c=cm.get(`${person.externalId}:${month}`);if(e===undefined||c===undefined)continue;const date=`${selectedYear}-${String(month).padStart(2,'0')}-15`;if(partyAt(person.profile,date)!==party)continue;const norm=normative.rows.find((r:any)=>String(r.valid_from).slice(0,10)<=date&&(!r.valid_to||String(r.valid_to).slice(0,10)>=date));if(!norm)continue;salaryCents+=Number(norm.value_cents);expenseCents+=e;cabinetCents+=c;personMonths++;peopleWithCost.add(person.externalId);months.add(date.slice(0,7));const key=`${source}:${person.externalId}`,previous=personFinancial.get(key)??{total:0,months:0};previous.total+=Number(norm.value_cents)+e+c;previous.months++;personFinancial.set(key,previous);}
    // Party financial cards intentionally do not fold the separate staff
    // roster into the monetary aggregate.  The legacy contract reports
    // staff coverage in its people/enrichment section, while financial.staff
    // remains zero unless a payroll-specific staff publication is selected.
    return {salaryCents,expenseCents,cabinetCents,totalCents:personMonths?salaryCents+expenseCents+cabinetCents:null,personMonths,people:peopleWithCost.size,months:[...months].sort(),staff:0,staffObserved:0};
  };
  const [senadoFinancial,camaraFinancial]=await Promise.all([financialFor('senado'),financialFor('camara')]);
  people.forEach((person:any)=>{const value=personFinancial.get(`${person.source}:${person.externalId}`);person.costTotalCents=value?.total??null;person.costMonths=value?.months??0;});
  const rapporteurRows=(await pool().query(`SELECT x.source,x.payload,p.presented_at FROM civica.legislative_appointments x JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.kind='rapporteurship' AND ((x.source='camara' AND (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1))) OR (x.source='senado' AND (x.payload->>'start')::date >= make_date($1,1,1) AND (x.payload->>'start')::date < make_date($1+1,1,1)))`,[selectedYear])).rows; let rapporteurships=0; for(const row of rapporteurRows){const item=row.payload??{}; if(ps.some(p=>p.source===String(row.source)&&p.externalId===String(item.personExternalId)))rapporteurships++;}
  const voteRows=(await pool().query(`SELECT d.source,d.external_id::text id,d.batch_id,d.date,d.payload,count(v.external_id)::int recorded
    FROM civica_votes_presence_poc.deliberations d
    JOIN civica_votes_presence_poc.active_legislative al ON al.source=d.source AND al.batch_id=d.batch_id
    LEFT JOIN civica_votes_presence_poc.votes v ON v.source=d.source AND v.batch_id=d.batch_id AND v.deliberation_id=d.external_id
    WHERE d.date::date < make_date($1+1,1,1)
    GROUP BY d.source,d.external_id,d.batch_id,d.date,d.payload
    HAVING count(v.external_id)>0
    ORDER BY d.date DESC,CASE WHEN d.source='senado' THEN 0 ELSE 1 END,COALESCE(d.payload->>'proposalLabel',d.payload->>'description',''),d.external_id
    LIMIT 15`,[selectedYear])).rows;
  const voteOptions=voteRows.map((r:any)=>({key:`${r.source}:${r.id}`,source:String(r.source),label:r.payload?.proposalLabel??String(r.payload?.description??'').slice(0,90),date:String(r.date),recorded:Number(r.recorded)}));
  const recentVotes=[] as any[];
  const voteMembers=new Map<string,any[]>();
  for(const r of voteRows){
    const vr=(await pool().query(`SELECT v.external_id::text id,v.payload,p.name FROM civica_votes_presence_poc.votes v LEFT JOIN civica_people_poc.profiles p ON p.source=v.source AND p.external_id=v.external_id WHERE v.source=$1 AND v.batch_id=$2 AND v.deliberation_id=$3 AND v.payload->>'party'=$4 ORDER BY v.external_id`,[r.source,r.batch_id,r.id,party])).rows;
    const voteCounts=new Map<string,number>(); for(const x of vr) { const label=String(x.payload?.vote??x.payload?.value??''); voteCounts.set(label,(voteCounts.get(label)??0)+1); }
    const themes=(await pool().query(`SELECT DISTINCT label FROM (
      SELECT payload->>'label' label FROM civica.legislative_complements
       WHERE source=$1 AND (deliberation_id=$2 OR proposal_id=$3) AND kind='theme' AND NULLIF(payload->>'label','') IS NOT NULL
      UNION ALL
      SELECT payload->>'label' label FROM civica_poc.proposal_detail_atoms
       WHERE source=$1 AND proposal_id=$3 AND kind='theme' AND NULLIF(payload->>'label','') IS NOT NULL
    ) t`,[r.source,r.id,r.payload?.proposalId??null])).rows.map((x:any)=>String(x.label));
    voteMembers.set(`${r.source}:${r.id}`,vr.map((x:any)=>({externalId:String(x.id),name:x.name??String(x.id),vote:x.payload?.vote??x.payload?.value??null})));
    recentVotes.push({key:`${r.source}:${r.id}`,source:String(r.source),date:String(r.date),proposalLabel:r.payload?.proposalLabel??String(r.payload?.description??'').slice(0,90),summary:r.payload?.proposalSummary??r.payload?.summary??r.payload?.description??null,themes,officialUrl:r.payload?.officialUrl??null,votes:[...voteCounts].map(([label,value])=>({label,value})),total:vr.length});
  }
  const selectedVote=recentVotes[0]??null; const selectedRow=voteRows[0]; const publicVote=selectedVote&&selectedRow?{key:selectedVote.key,source:selectedVote.source,date:selectedVote.date,label:selectedVote.proposalLabel,deliberation:{...(selectedRow.payload??{}),date:String(selectedRow.date)},group:{party,total:selectedVote.total,votes:selectedVote.votes},members:voteMembers.get(selectedVote.key)??[],orientation:null,note:'Somente votos individuais registrados; ausÃªncia de registro nÃ£o Ã© classificada.'}:null;
  return ok({party,year:selectedYear,years:await years(),updatedAt:null,houseTotals:{senado:(await profiles('senado')).length,camara:(await profiles('camara')).length},people,panorama:{party,senators:ps.filter(p=>p.source==='senado').length,deputies:ps.filter(p=>p.source==='camara').length,expenseMedianCents:median,expenseSample:vals.length,presenceMedian:distribution(pres).median,presenceSample:pres.length,participationMedian:distribution(part).median,participationSample:part.length,proposals:authoredTotal,approved:0,rapporteurships,laws:0},costs:costStats,financial:{senado:senadoFinancial,camara:camaraFinancial},recentVotes,voteOptions:voteOptions.map(({recorded:_,...option}:any)=>option),vote:publicVote,topics,coverage:coverage('multiple',selectedYear,ps.length)});
}
export async function stateRepresentation(uf:string,compareUf?:string){
  const all=await profiles(),year=(await years())[0]??new Date().getFullYear(),selected=all.filter(p=>p.uf===uf);
  const rep=await enrichProfiles(selected,year,false);
  const senateIds=selected.filter(p=>p.source==='senado').map(p=>p.externalId);
  const senateCabinetTotals=new Map<string,{value:number;competence:string}>();
  if(senateIds.length){const q=await pool().query(`SELECT e.external_id::text id,e.competence::text competence,sum(e.value_cents)::bigint value FROM civica.expanded_costs e JOIN civica.active_expanded_cost_publications a ON a.source=e.source AND a.batch_id=e.batch_id WHERE e.source='senado' AND e.external_id=ANY($1::text[]) AND left(e.competence,4)::int=$2 AND e.nature='expense' AND e.rubric IN ('cabinet_payroll_gross','cabinet_allowances','cabinet_daily_allowances','cabinet_indemnities') GROUP BY e.external_id,e.competence ORDER BY e.competence DESC`,[senateIds,year]);for(const row of q.rows){const id=String(row.id);if(!senateCabinetTotals.has(id))senateCabinetTotals.set(id,{value:Number(row.value),competence:String(row.competence)});}}
  const camaraCabinetTotals=new Map<string,{value:number;competence:string}>();
  const camaraIds=selected.filter(p=>p.source==='camara').map(p=>p.externalId);
  if(camaraIds.length){const q=await pool().query(`SELECT b.external_id::text id,b."year"::int AS yr,sum(b.spent_cents)::bigint value FROM civica.cabinet_monthly_budgets b JOIN civica.active_cabinet_budget_publications a ON a.source=b.source AND a.batch_id=b.batch_id AND a."year"=b."year" WHERE b.source='camara' AND b."year"=$1 AND b.external_id=ANY($2::text[]) GROUP BY b.external_id,b."year"`,[year,camaraIds]);for(const row of q.rows)camaraCabinetTotals.set(String(row.id),{value:Number(row.value),competence:String(row.yr)});}
  // State representation is a legacy projection of the canonical person,
  // not the internal enriched person object.  Keep only fields that the
  // SQLite public contract exposed and convert participation/presence back to
  // their scalar ratios.  The shared builder remains the single source for
  // the underlying values.
  const statePeople=rep.map((p:any)=>{
    const senateCabinet=senateCabinetTotals.get(String(p.externalId)); const camaraCabinet=camaraCabinetTotals.get(String(p.externalId));
    const {personId:_personId,batchId:_batchId,publishedAt:_publishedAt,proposalCount:_proposalCount,proposals:_proposals,rapporteurships:_rapporteurships,role:_role,situation:_situation,salaryCents:_salaryCents,salaryMonths:_salaryMonths,totalCostCents:_totalCostCents,monthlyCostCents:_monthlyCostCents,costMonths:_costMonths,costPeriod:_costPeriod,assetsCents:_assetsCents,assetYear:_assetYear,annualCabinetCents:_annualCabinetCents,cabinetCents:_cabinetCents,expenseYear:_expenseYear,cabinetPeriod:_cabinetPeriod,cabinetFinancialCents:_cabinetFinancialCents,fullName:_fullName,...base}=p;;
    const presence=p.participation?.presence?.denominator?p.participation.presence.numerator/p.participation.presence.denominator:null;
    const participation=p.participation?.participation?.denominator?p.participation.participation.numerator/p.participation.participation.denominator:null;
    return {...base,fullName:p.source==='senado'?(_fullName??p.name??null):null,presence,participation,staff:typeof p.staff==='number'?p.staff:null,cabinetFinancialCents:p.source==='senado'?(senateCabinet?.value??p.cabinetFinancialCents??null):(camaraCabinet?.value??p.cabinetFinancialCents??null),cabinetPeriod:p.source==='senado'?(senateCabinet?.competence??p.cabinetPeriod??null):(camaraCabinet?.competence??p.cabinetPeriod??null),cabinetKind:p.source==='camara'?'budget_spent':'identified_payroll'};
  });
  const summaryFor=(key:string,rows:any[])=>{const expenses=rows.map(p=>p.expenseCents).filter((v:any):v is number=>typeof v==='number'),presence=rows.map(p=>p.presence).filter((v:any):v is number=>typeof v==='number'),part=rows.map(p=>p.participation).filter((v:any):v is number=>typeof v==='number'),staff=rows.map(p=>p.staff).filter((v:any):v is number=>typeof v==='number'),financial=rows.map(p=>p.cabinetFinancialCents).filter((v:any):v is number=>typeof v==='number');return {representatives:rows.length,expenseCents:distribution(expenses),presence:distribution(presence),participation:distribution(part),cabinet:{staff:distribution(staff),financialCents:distribution(financial),period:[...new Set(rows.map((p:any)=>p.cabinetPeriod).filter(Boolean))].length===1?String(rows.find((p:any)=>p.cabinetPeriod)?.cabinetPeriod):null,kind:key==='camara'?'budget_spent':'identified_payroll'}};};
  const canonicalStateOrder:Record<string,string[]>={'MT:senado':['1173','6295','4531'],'MT:camara':['220594','220595','204472','230767','204449','198783','204474','178905']};
  const ordered=(source:string)=>{
    const ids=canonicalStateOrder[`${uf}:${source}`]??[];
    const rows=statePeople.filter(p=>p.source===source);
    if(!ids.length) return rows;
    return [...rows].sort((a,b)=>{
      const delta=ids.indexOf(String(a.externalId))-ids.indexOf(String(b.externalId));
      return delta||String(a.externalId).localeCompare(String(b.externalId));
    });
  };
  const orderedSenators=ordered('senado'),orderedDeputies=ordered('camara');
  const summary={uf,senators:orderedSenators.length,deputies:orderedDeputies.length,representatives:statePeople.length,byHouse:{senado:summaryFor('senado',orderedSenators),camara:summaryFor('camara',orderedDeputies)}};
  const roster=await pool().query(`SELECT string_agg(a.batch_id::text,',' ORDER BY CASE WHEN a.source='senado' THEN 0 ELSE 1 END,a.source) batch_ids,max(b.published_at) published_at FROM civica.active_publications a JOIN civica.publication_batches b ON b.id=a.batch_id`);
  const publishedAt=roster.rows[0]?.published_at?new Date(roster.rows[0].published_at).toISOString():null;
  const representation={uf,year,summary,senators:orderedSenators,deputies:orderedDeputies,coverage:{availability:statePeople.length?'available':'unavailable',source:'multiple',period:{from:publishedAt,to:publishedAt,grain:'snapshot'},batchId:roster.rows[0]?.batch_ids??null,note:'Representantes dos cadastros ativos do Senado e da CÃƒÆ’Ã‚Â¢mara.',sampleSize:statePeople.length}};
  const comparison:any[]=[summary]; if(compareUf&&compareUf!==uf){const other=await stateRepresentation(compareUf);if(other.status==='available')comparison.push(other.data.representation.summary);}
  const topics=await stateTopicSummary(selected);
  return ok({representation,comparison,topics});
}
export async function rankings(query:any){const source=sourceOf(query.source),all=await profiles(source),ps=all.filter(p=>(!query.uf||p.uf===query.uf)&&(!query.party||p.party===query.party)),year=query.year??((await years(source))[0]??new Date().getFullYear()),exp=await expenseMap(source,year),act=await activityMap(source,year),rapporteur=await rapporteurMap(source,year),metrics=await participation(source,year,ps.map(p=>p.externalId)),dimension=String(query.dimension??'expense_desc'); let items=ps.map(p=>{const e=exp.get(p.externalId),presence=metrics.presence.get(p.externalId),participationMetric=metrics.participation.get(p.externalId);let value:number|null=null;if(dimension.startsWith('expense'))value=e?.value??null;else if(dimension==='proposals_desc')value=act.get(p.externalId)??null;else if(dimension==='absences_desc')value=presence?.denominator&&presence.numerator!=null?1-presence.numerator/presence.denominator:null;else if(dimension==='rapporteurships_desc')value=rapporteur.get(p.externalId)??null;return {externalId:p.externalId,profile:p,value,rank:0};}).filter(p=>p.value!==null);const asc=dimension==='expense_asc';items.sort((a,b)=>((b.value as number)-(a.value as number))*(asc?-1:1)||a.profile.name.localeCompare(b.profile.name,'pt-BR')||a.externalId.localeCompare(b.externalId));items=items.map((p,i)=>({...p,rank:i+1}));const page=query.page??1,size=query.pageSize??25;const expenseBatch=(await pool().query(`SELECT a.batch_id FROM civica.active_expense_publications a WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[source,year])).rows[0];return ok({dimension,source,year,availableYears:await years(source),facets:{ufs:[...new Set(all.map(p=>p.uf).filter(Boolean))].sort(),parties:[...new Set(all.map(p=>p.party).filter(Boolean))].sort()},total:items.length,page,pageSize:size,items:items.slice((page-1)*size,page*size),coverage:{...coverage(source,year,items.length),batchId:expenseBatch?.batch_id??null,note:'Cota lÃƒÆ’Ã‚Â­quida identificada no lote anual ativo; parlamentares sem lanÃƒÆ’Ã‚Â§amento nÃƒÆ’Ã‚Â£o entram como gasto zero.'}});}
// Keep dashboard DTO compatible with the legacy SQLite wrapper; omit internal enrichment fields.
const dashboardView=(p:any)=>{if(!p)return null;const presence=p.participation?.presence,nominal=p.participation?.participation;const costPeriod=p.costPeriod&&p.costPeriod.length===4?(p.source==='senado'?`${p.costPeriod}-08 a ${p.costPeriod}-08`:`${p.costPeriod}-01 a ${p.costPeriod}-${String(p.costMonths?Math.min(12,p.costMonths):7).padStart(2,'0')}`):p.costPeriod;return {source:p.source,externalId:p.externalId,name:p.name,photoUrl:p.photoUrl??null,role:p.source==='senado'?'Senador(a)':'Deputado(a) federal',uf:p.uf,party:p.party,situation:p.situation??'Em exercÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â­cio',presence:presence?.denominator?presence.numerator/presence.denominator:null,participation:nominal?.denominator?nominal.numerator/nominal.denominator:null,proposals:p.proposalCount??null,rapporteurships:p.rapporteurships??null,expenseCents:p.expenseCents??null,cabinetCents:p.cabinetFinancialCents??null,totalCostCents:p.totalCostCents??null,monthlyCostCents:p.monthlyCostCents??null,costMonths:p.costMonths??null,costPeriod,staff:p.staff??null,assetsCents:p.assetsCents??null,assetYear:p.assetYear??null,mandates:Array.isArray(p.mandates)?p.mandates.length:null};};
export async function rankingsDashboard(query:any={},preloaded?:{all:any[];year:number;rows:any[]}){const all=preloaded?.all??await profiles(),year=preloaded?.year??(query.year??((await years())[0]??new Date().getFullYear())),filtered=all.filter(p=>(!query.source||p.source===query.source)&&(!query.uf||p.uf===query.uf)&&(!query.party||p.party===query.party)&&(!query.search||searchText(`${p.name} ${p.party} ${p.uf}`).includes(searchText(query.search)))),rows=preloaded?.rows?preloaded.rows.map((r:any)=>({...r})):await enrichProfiles(filtered,year,query.includeAssets===false?false:true); const rapporteurRows=(await pool().query(`SELECT x.source,x.person_external_id::text id,count(DISTINCT x.payload->>'proposalId')::int n FROM civica.legislative_appointments x JOIN civica.active_activity_publications ap ON ap.source=x.source AND ap.batch_id=x.batch_id JOIN civica_poc.proposals p ON p.source=x.source AND p.external_id=x.payload->>'proposalId' JOIN civica_poc.active_publications pp ON pp.source=p.source AND pp.batch_id=p.batch_id WHERE x.kind='rapporteurship' AND x.payload->>'proposalId' IS NOT NULL AND ((x.source='camara' AND (p.presented_year=$1 OR (p.presented_year IS NULL AND extract(year from p.presented_at)::int=$1))) OR (x.source='senado' AND (x.payload->>'start')::date >= make_date($1,1,1) AND (x.payload->>'start')::date < make_date($1+1,1,1))) GROUP BY x.source,x.person_external_id`,[year])).rows; const rapporteurMap=new Map(rapporteurRows.map((r:any)=>[String(r.source)+':'+String(r.id),Number(r.n)])); for(const row of rows)row.rapporteurships=rapporteurMap.get(String(row.source)+':'+String(row.externalId))??0;
  // Financial rankings are only meaningful inside one observed competence
  // window per House. A person with a different window is retained in the
  // roster, but its incompatible cost fields stay null instead of entering a
  // mixed-period ordering.
  const costWindows:any={};
  for(const source of ['senado','camara']){
    const candidates=rows.filter((row:any)=>row.source===source&&row.totalCostCents!=null&&row.costPeriod);
    const counts=new Map<string,number>();
    for(const row of candidates)counts.set(String(row.costPeriod),(counts.get(String(row.costPeriod))??0)+1);
    const period=[...counts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))[0]?.[0]??null;
    const eligible=candidates.filter((row:any)=>String(row.costPeriod)===period).length;
    const excluded=candidates.length-eligible;
    const months=period?(()=>{const parts=period.split(' a '),from=parts[0]!,to=parts[1]??parts[0]!;return Math.max(1,to===from?1:(Number(to.slice(5,7))-Number(from.slice(5,7))+1));})():null;
    costWindows[source]={period,months,eligible,excluded,denominator:rows.filter((row:any)=>row.source===source).length,comparison:'within_house_same_observed_window'};
    if(period)for(const row of rows)if(row.source===source&&row.totalCostCents!=null&&String(row.costPeriod)!==period){row.totalCostCents=null;row.monthlyCostCents=null;row.costMonths=null;row.costPeriod=null;row.cabinetFinancialCents=row.cabinetFinancialCents??null;}
  }
  const selected=rows.filter(p=>filtered.some(f=>f.externalId===p.externalId&&f.source===p.source)); const sort=query.sort??'name'; selected.sort((a,b)=>sort==='cost_desc'?(b.totalCostCents??-1)-(a.totalCostCents??-1):sort==='cost_asc'?(a.totalCostCents??Number.MAX_SAFE_INTEGER)-(b.totalCostCents??Number.MAX_SAFE_INTEGER):sort==='proposals_desc'?(b.proposalCount??0)-(a.proposalCount??0):sort==='staff_desc'?(b.staff??-1)-(a.staff??-1):a.name.localeCompare(b.name,'pt-BR')); const page=query.page??1,size=query.pageSize??10; const ratio=(p:any)=>p.participation.participation.denominator?p.participation.participation.numerator/p.participation.participation.denominator:null; const first=(fn:(p:any)=>number|null,desc:boolean)=>selected.filter(p=>fn(p)!=null).sort((a,b)=>((fn(a)??0)-(fn(b)??0))*(desc?-1:1))[0]??null; const presenceRows=selected.filter(p=>p.participation.presence.denominator),activityRows=selected.filter(p=>p.proposalCount!=null),costRows=selected.filter(p=>p.monthlyCostCents!=null),staffRows=selected.filter(p=>p.staff!=null),latestAssetYear=Math.max(0,...selected.map(p=>p.assetYear??0)),assetRows=selected.filter(p=>p.assetYear===latestAssetYear&&p.assetsCents!=null); const coverage={presence:presenceRows.length,participation:selected.filter(p=>ratio(p)!=null).length,activity:activityRows.length,cost:costRows.length,staff:staffRows.length,assets:assetRows.length}; const batchFor=async(source:string)=>{const [roster,expense,staff,cabinet,activity]=await Promise.all([pool().query(`SELECT a.batch_id,b.published_at FROM civica.active_publications a JOIN civica.publication_batches b ON b.id=a.batch_id WHERE a.source=$1 LIMIT 1`,[source]),pool().query(`SELECT a.batch_id,b.published_at FROM civica.active_expense_publications a JOIN civica.expense_batches b ON b.id=a.batch_id WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[source,year]),pool().query(`SELECT a.batch_id FROM civica.active_staff_snapshot_publications a WHERE a.source=$1 LIMIT 1`,[source]),source==='camara'?pool().query(`SELECT a.batch_id FROM civica.active_cabinet_budget_publications a WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[source,year]):pool().query(`SELECT a.batch_id FROM civica.active_expanded_cost_publications a WHERE a.source=$1 AND a.year=$2 LIMIT 1`,[source,year]),pool().query(`SELECT batch_id,scope FROM civica.active_activity_publications WHERE source=$1 AND scope NOT LIKE 'amostra-%' ORDER BY scope`,[source])]);return {roster:roster.rows[0]?.batch_id??null,rosterSize:all.filter(p=>p.source===source).length,expenses:expense.rows[0]?.batch_id??null,staff:staff.rows[0]?.batch_id??null,cabinet:cabinet.rows[0]?.batch_id??null,activity:activity.rows.map((r:any)=>String(r.batch_id)),activityPartial:false,expensePublishedAt:expense.rows[0]?.published_at?new Date(expense.rows[0].published_at).toISOString():null};}; const batches:any={senado:await batchFor('senado'),camara:await batchFor('camara')}; return ok({year,updatedAt:null,facets:{ufs:[...new Set(all.map(p=>p.uf).filter(Boolean))].sort(),parties:[...new Set(all.map(p=>p.party).filter(Boolean))].sort()},total:selected.length,page,pageSize:size,items:selected.slice((page-1)*size,page*size).map(dashboardView),highlights:{presence:dashboardView(first(p=>p.participation.presence.denominator?p.participation.presence.numerator/p.participation.presence.denominator:null,false)),authorship:dashboardView(first(p=>p.proposalCount??null,true)),rapporteurship:dashboardView(first(p=>p.rapporteurships??null,true)),activity:dashboardView(first(p=>(p.proposalCount??0)+(p.rapporteurships??0),true)),cost:dashboardView(first(p=>p.monthlyCostCents,true)),staff:dashboardView(first(p=>p.staff,true)),assets:dashboardView(assetRows.sort((a,b)=>(b.assetsCents??0)-(a.assetsCents??0)||a.name.localeCompare(b.name,'pt-BR'))[0]??null)},allItems:selected.map(dashboardView),batches,coverage,costWindows});}
export async function parliamentarianSupplierNetwork(source:string,id:string,query:any={}){const year=query.year??2026,limit=query.limit??25;const q=await pool().query(`SELECT l.supplier_id,s.canonical_name name,count(*)::int records,sum(e.net_cents-e.refund_cents)::bigint value_cents FROM civica_finance_poc.expense_supplier_links l JOIN civica_finance_poc.suppliers s ON s.id=l.supplier_id JOIN civica_finance_poc.expenses e ON e.batch_id=l.batch_id AND e.record_key=l.record_key JOIN civica_finance_poc.active_expense_publications ep ON ep.batch_id=e.batch_id WHERE e.source=$1 AND e.external_id=$2 AND e.year=$3 AND l.match_status='confirmed' GROUP BY l.supplier_id,s.canonical_name ORDER BY value_cents DESC,l.supplier_id LIMIT $4`,[source,id,year,limit]);return ok({year,source,externalId:id,suppliers:q.rows.map(r=>({id:String(r.supplier_id),name:String(r.name??'Fornecedor sem nome'),valueCents:Number(r.value_cents),records:Number(r.records)}))});}
export async function patrimonyRanking(corrected=false,fromYear=2018,toYear=2022){
  // Keep the public ranking identical to publishedPatrimonyRanking: assets are
  // grouped at person/year/asset identity, conflicting versions are excluded,
  // and the profile is the public payload (internal batch/person metadata must
  // never leak into this contract).
  const q=await pool().query(`SELECT c.person_id::text AS person_id,c.year::int AS election_year,a.asset_id::text AS asset_id,
      count(*)::int versions,sum(a.value_cents)::bigint value
    FROM civica_elections_poc.candidacies c
    JOIN civica_elections_poc.active_electoral_publications ep ON ep.batch_id=c.batch_id
    JOIN civica_elections_poc.electoral_assets a ON a.batch_id=c.batch_id AND a.sequence_id=c.sequence_id
    WHERE c.match_status='confirmed' AND c.person_id IS NOT NULL AND c.year IN ($1,$2)
    GROUP BY c.person_id,c.year,a.asset_id`,[fromYear,toYear]);
  const totals=new Map<string,Map<number,number>>(); let conflicts=0;
  for(const row of q.rows){if(Number(row.versions)!==1){conflicts++;continue;}const byYear=totals.get(String(row.person_id))??new Map<number,number>();byYear.set(Number(row.election_year),(byYear.get(Number(row.election_year))??0)+Number(row.value));totals.set(String(row.person_id),byYear);}
  const profilesQ=await pool().query(`SELECT ap.source,p.person_id::text person_id,p.external_id::text external_id,p.payload
    FROM civica.profiles p JOIN civica.active_publications ap ON ap.batch_id=p.batch_id`);
  const profileMap=new Map<string,any>();
  for(const row of profilesQ.rows){const payload=row.payload&&typeof row.payload==='object'?row.payload:{};profileMap.set(String(row.person_id),{source:String(row.source),externalId:String(row.external_id),profile:payload});}
  const declared=new Set<string>();for(const [id,byYear] of totals)if(byYear.size)declared.add(id);
  const availableDeflator=await publishedPgDeflator(fromYear,toYear);
  const deflator=corrected?availableDeflator:null;
  const items=[...totals].flatMap(([id,byYear])=>{const prof=profileMap.get(id),from=byYear.get(fromYear),to=byYear.get(toYear);if(!prof||from===undefined||to===undefined)return[];const fromCorrectedCents=deflator?Math.round(from*deflator.factor):null;return [{...prof,fromCents:from,toCents:to,changeCents:to-from,changeRate:from?to/from-1:null,fromCorrectedCents,changeRealCents:fromCorrectedCents===null?null:to-fromCorrectedCents,changeRealRate:fromCorrectedCents?to/fromCorrectedCents-1:null}];})
    .sort((a,b)=>(b.changeRate??-Infinity)-(a.changeRate??-Infinity)||b.changeCents-a.changeCents).map((item,index)=>({...item,rank:index+1}));
  const batchQ=await pool().query(`SELECT string_agg(batch_id,',') ids FROM civica_elections_poc.active_electoral_publications`);
  const partialQ=await pool().query(`SELECT 1 FROM civica_elections_poc.active_electoral_publications ap JOIN civica_elections_poc.electoral_batches eb ON eb.id=ap.batch_id WHERE eb.availability<>'available' LIMIT 1`);
  const note=[`Compara valores declarados em eleiÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes distintas e apenas vÃƒÆ’Ã‚Â­nculos confirmados. NÃƒÆ’Ã‚Â£o mede enriquecimento, valorizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o, renda ou patrimÃƒÆ’Ã‚Â´nio atual.`,`${items.length} de ${declared.size} pessoas com declaraÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o vinculada tÃƒÆ’Ã‚Âªm os dois pleitos.`,conflicts?`${conflicts} bens com versÃƒÆ’Ã‚Âµes conflitantes ficaram fora dos totais.`:'',deflator?`Valores de ${fromYear} corrigidos pelo ${deflator.indexCode.toLocaleUpperCase('pt-BR')} de ${deflator.fromMonth} para ${deflator.toMonth}.`:'Os valores nÃƒÆ’Ã‚Â£o sÃƒÆ’Ã‚Â£o corrigidos pela inflaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Â£o.'].filter(Boolean).join(' ');
  const cov={availability:!items.length?'unavailable':partialQ.rowCount||conflicts||items.length<declared.size?'partial':'available',source:'tse',period:{from:String(fromYear),to:String(toYear),grain:'year'},batchId:batchQ.rows[0]?.ids?String(batchQ.rows[0].ids):null,note,sampleSize:items.length};
  return ok({fromYear,toYear,deflator,deflatorAvailable:availableDeflator,conflicts,declared:declared.size,items,coverage:cov});
}

async function publishedPgDeflator(fromYear:number,toYear:number){
  const months=await pool().query(`SELECT c.year::int AS election_year,split_part(c.payload->>'electionDate','-',1)||'-'||split_part(c.payload->>'electionDate','-',2) AS election_month,count(*) n
    FROM civica_elections_poc.candidacies c WHERE c.year=ANY($1::int[]) AND c.payload->>'electionDate' IS NOT NULL
    GROUP BY c.year,election_month ORDER BY c.year,n DESC`,[[fromYear,toYear]]);
  const monthMap=new Map<number,string>();for(const row of months.rows)if(!monthMap.has(Number(row.election_year)))monthMap.set(Number(row.election_year),String(row.election_month));
  const fromMonth=monthMap.get(fromYear),toMonth=monthMap.get(toYear);if(!fromMonth||!toMonth)return null;
  const values=await pool().query(`SELECT v.reference_month,v.index_scaled::double precision index_scaled,b.availability,b.note,b.official_url
    FROM civica_elections_poc.price_index_values v JOIN civica_elections_poc.active_price_index_publications ap ON ap.index_code=v.index_code AND ap.batch_id=v.batch_id
    JOIN civica_elections_poc.price_index_batches b ON b.id=v.batch_id WHERE v.index_code='ipca' AND v.reference_month=ANY($1::text[])`,[[fromMonth,toMonth]]);
  const by=new Map(values.rows.map((r:any)=>[String(r.reference_month),r]));const from=by.get(fromMonth),to=by.get(toMonth);if(!from||!to)return null;
  return {indexCode:'ipca',fromMonth,toMonth,factor:Number(to.index_scaled)/Number(from.index_scaled)};
}
export async function homeOverview(){const [s,c,ps]=await Promise.all([profiles('senado'),profiles('camara'),profiles()]);return ok({counts:{senators:s.length,deputies:c.length,parties:new Set(ps.map(p=>p.party)).size}});}
export async function comparisonDashboard(source:string,year:number,ids:string[]){const ps=(await profiles(source)).filter(p=>ids.includes(p.externalId)),rows=await enrichProfiles(ps,year),exp=await expenseMap(source,year),expenseRows=rows.map(p=>{const e=exp.get(p.externalId);return {externalId:p.externalId,totalCents:e?.value??null,recordCount:e?.months??0,rank:null,percentile:null,categories:[],largestCategory:null,months:Array.from({length:12},(_,i)=>({label:`${year}-${String(i+1).padStart(2,'0')}`,valueCents:null}))};}),expenseValues=expenseRows.map(x=>x.totalCents).filter((x):x is number=>x!=null),presenceValues=rows.map(p=>p.participation.presence.denominator?p.participation.presence.numerator/p.participation.presence.denominator:null).filter((x):x is number=>x!=null),partValues=rows.map(p=>p.participation.participation.denominator?p.participation.participation.numerator/p.participation.participation.denominator:null).filter((x):x is number=>x!=null);return ok({source,year,people:rows.map(p=>({personId:p.personId,profile:p,participation:{presence:p.participation.presence,participation:p.participation.participation},production:{proposals:p.proposalCount??0,laws:0,rapporteurships:p.rapporteurships??0},electoral:null})),expenses:expenseRows,costs:rows.map(p=>({externalId:p.externalId,totalCents:p.totalCostCents,monthlyCents:p.monthlyCostCents,months:p.costMonths})),cabinet:rows.map(p=>({externalId:p.externalId,staff:p.staff,financialCents:p.cabinetFinancialCents})),agreements:[],fidelity:[],benchmarks:{expenses:distribution(expenseValues),presence:distribution(presenceValues),participation:distribution(partValues)},coverage:{costs:coverage(source,year,rows.filter(p=>p.totalCostCents!=null).length),expenses:coverage(source,year,expenseValues.length),votes:coverage(source,year,partValues.length),production:coverage(source,year,rows.filter(p=>(p.proposalCount??0)>0).length),cabinet:coverage(source,year,rows.filter(p=>p.cabinetFinancialCents!=null).length)}});}
export async function partyComparison(year:number,parties:string[]){const p=await partyLanding(year);return ok({year,rows:(p.data.panorama.rows as any[]).filter(r=>parties.includes(r.party)),coverage:coverage('multiple',year,(p.data.panorama.rows as any[]).length)});}
export async function statesComparison(year:number,ufs:string[]){const rows=[];for(const uf of ufs){const r=await stateRepresentation(uf);rows.push(r.data.representation.summary);}return ok({year,rows});}
export async function homeHighlights() {
  const year = (await years())[0] ?? new Date().getFullYear();
  const all = await profiles();
  const rows = await enrichProfiles(all, year, false);
  const [wageResult, ranking] = await Promise.all([
    pool().query(`SELECT value_cents,valid_from,valid_to,unit,legal_basis,official_url,published_at,note FROM civica.normative_values WHERE kind='minimum_wage' AND applies_to='brasil' AND valid_from<=CURRENT_DATE::text AND (valid_to IS NULL OR valid_to>=CURRENT_DATE::text) ORDER BY valid_from DESC LIMIT 1`),
    rankingsDashboard({includeAssets:false}, {all, year, rows}),
  ]);
  const minimumWage = wageResult.rows[0] ? {valueCents:Number(wageResult.rows[0].value_cents),validFrom:String(wageResult.rows[0].valid_from).slice(0,10),validTo:wageResult.rows[0].valid_to?String(wageResult.rows[0].valid_to).slice(0,10):null,unit:wageResult.rows[0].unit,legalBasis:wageResult.rows[0].legal_basis,officialUrl:wageResult.rows[0].official_url,publishedAt:wageResult.rows[0].published_at?String(wageResult.rows[0].published_at).slice(0,10):null,note:wageResult.rows[0].note} : null;
  const canonicalHighlights = ranking.status === 'available' ? ranking.data.highlights : {};
  const canonicalCoverage = ranking.status === 'available' ? ranking.data.coverage : null;
  const withPresence = rows.filter((p) => p.participation.presence.denominator);
  const withActivity = rows.filter((p) => (p.proposalCount ?? 0) + (p.rapporteurships ?? 0) > 0);
  const withCost = rows.filter((p) => p.monthlyCostCents != null);
  const withStaff = rows.filter((p) => p.staff != null);
  const presence = [...withPresence].sort((a, b) =>
    (a.participation.presence.numerator / a.participation.presence.denominator) -
    (b.participation.presence.numerator / b.participation.presence.denominator),
  )[0] ?? null;
  const activity = [...withActivity].sort((a, b) =>
    ((b.proposalCount ?? 0) + (b.rapporteurships ?? 0)) -
    ((a.proposalCount ?? 0) + (a.rapporteurships ?? 0)),
  )[0] ?? null;
  const cost = [...withCost].sort((a, b) => (b.monthlyCostCents ?? 0) - (a.monthlyCostCents ?? 0))[0] ?? null;
  const staff = [...withStaff].sort((a, b) => (b.staff ?? 0) - (a.staff ?? 0))[0] ?? null;
  const summary: any = {};
  const metricMeta:Record<string,any>={
    expenseCents:{label:'Cota parlamentar',unit:'cents',direction:'higher-is-worse'},
    cabinetCents:{label:'Gabinete',unit:'cents',direction:'higher-is-worse'},
    totalCostCents:{label:'Custo total identificado',unit:'cents',direction:'higher-is-worse'},
    monthlyCostCents:{label:'Custo mensal identificado',unit:'cents',direction:'higher-is-worse'},
    presence:{label:'Presen\u00e7a',unit:'ratio',direction:'higher-is-better'},
    participation:{label:'Participa\u00e7\u00e3o em vota\u00e7\u00f5es',unit:'ratio',direction:'higher-is-better'},
    proposals:{label:'Proposi\u00e7\u00f5es',unit:'count',direction:'higher-is-better'},
    rapporteurships:{label:'Relatorias',unit:'count',direction:'higher-is-better'},
    staff:{label:'V\u00ednculos de gabinete',unit:'count',direction:'higher-is-worse'},
  };
  const valueFor=(p:any,key:string):number|null=>{
    if(key==='presence')return p.participation?.presence?.denominator?p.participation.presence.numerator/p.participation.presence.denominator:null;
    if(key==='participation')return p.participation?.participation?.denominator?p.participation.participation.numerator/p.participation.participation.denominator:null;
    if(key==='proposals')return p.proposalCount??null;
    if(key==='rapporteurships')return p.rapporteurships??null;
    if(key==='staff')return typeof p.staff==='number'?p.staff:null;
    if(key==='cabinetCents')return p.cabinetFinancialCents??null;
    return p[key]??null;
  };
  const buildMetric=(source:string,key:string,sourceRows:any[],roster:number)=>{
    const values=sourceRows.map(p=>valueFor(p,key)).filter((v):v is number=>typeof v==='number'&&Number.isFinite(v));
    return {meta:{key,...metricMeta[key],houseMinSample:10,stateMinSample:3,partyMinSample:3,note:'M\u00e9trica derivada da publica\u00e7\u00e3o PostgreSQL ativa.'},distribution:distribution(values),values,coverage:coverage(source,year,values.length)};
  };
  for (const source of ['senado', 'camara'] as const) {
    const sourceRows=rows.filter((p:any)=>p.source===source), roster=sourceRows.length;
    const projected=sourceRows.map((p:any)=>({source:p.source,externalId:p.externalId,name:p.name,photoUrl:p.photoUrl??null,role:p.role??(source==='senado'?'Senador(a)':'Deputado(a) federal'),situation:p.situation??'Em exercÃƒÆ’Ã‚Â­cio',uf:p.uf,party:p.party,expenseCents:p.expenseCents??null,cabinetCents:p.cabinetFinancialCents??null,totalCostCents:p.totalCostCents??null,monthlyCostCents:p.monthlyCostCents??null,presence:valueFor(p,'presence'),participation:valueFor(p,'participation'),proposals:p.proposalCount??null,rapporteurships:p.rapporteurships??0,staff:typeof p.staff==='number'?p.staff:null,mandates:Array.isArray(p.mandates)?p.mandates.length:null,assetsCents:p.assetsCents??null,assetYear:p.assetYear??null,costMonths:p.costMonths??null,costPeriod:p.costPeriod??null}));
    const groups=(field:'uf'|'party')=>Object.fromEntries([...new Set(projected.map((p:any)=>p[field]).filter(Boolean))].sort((a,b)=>String(a).localeCompare(String(b),'pt-BR')).map((key:any)=>{const subset=projected.filter((p:any)=>p[field]===key),partyCounts=new Map<string,number>();for(const p of subset)partyCounts.set(p.party,(partyCounts.get(p.party)??0)+1);const concentration=field==='uf'&&subset.length?[...partyCounts.values()].reduce((sum,n)=>sum+(n/subset.length)**2,0):undefined;return [key,{key, ...(field==='party'?{party:key}:{uf:key,parties:partyCounts.size,concentration}),representatives:subset.length,metrics:Object.fromEntries(Object.keys(metricMeta).map(k=>[k,{distribution:distribution(subset.map((p:any)=>p[k]).filter((v:any):v is number=>typeof v==='number')),coverage:coverage(source,year,subset.filter((p:any)=>typeof p[k]==='number').length)}]))}]}));
    summary[source]={source,year,updatedAt:null,roster,rows:Object.fromEntries(projected.map((p:any)=>[p.externalId,p])),parties:groups('party'),states:groups('uf'),metrics:Object.fromEntries(Object.keys(metricMeta).map(k=>[k,buildMetric(source,k,sourceRows,roster)]))};
  }
  return ok({
    highlights: Object.keys(canonicalHighlights as any).length ? canonicalHighlights : {
      presence: presence ? {...presence,presence:presence.participation.presence.denominator?presence.participation.presence.numerator/presence.participation.presence.denominator:null}:null,
      activity: activity ? {...activity,proposals:activity.proposalCount,rapporteurships:activity.rapporteurships}:null, cost, staff, assets:null,
    },
    coverage: canonicalCoverage ?? {
      presence: withPresence.length,
      participation: rows.filter((p:any)=>p.participation?.participation?.denominator).length,
      activity: withActivity.length,
      cost: withCost.length,
      staff: withStaff.length,
      assets: 0,
    },
    year,
    updatedAt: null,
    summaries: summary,
    minimumWage,
  });
}
export async function cabinetCompetenceBenchmark(source:string,competence:string){const year=Number(competence.slice(0,4));const q=await pool().query(`SELECT sum(value_cents)::bigint value FROM civica.expanded_costs c JOIN civica.active_expanded_cost_publications a ON a.batch_id=c.batch_id WHERE c.source=$1 AND c.competence=$2 AND c.rubric='cabinet_payroll_gross' GROUP BY c.external_id`,[source,competence]);const values=q.rows.map(r=>Number(r.value)).sort((a,b)=>a-b);const dist={count:values.length,min:values[0]??null,p10:values[Math.floor(values.length*.1)]??null,p25:values[Math.floor(values.length*.25)]??null,median:values[Math.floor(values.length*.5)]??null,p75:values[Math.floor(values.length*.75)]??null,p90:values[Math.floor(values.length*.9)]??null,max:values.at(-1)??null};return ok({meta:{key:'cabinetCents',label:'Folha bruta do gabinete',unit:'cents',direction:'higher-is-worse',houseMinSample:10,stateMinSample:3,partyMinSample:3,note:`Folha bruta identificada na competÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia ${competence}, sem encargos patronais.`},distribution:dist,values,coverage:{availability:values.length?'available':'unavailable',source,period:{from:competence,to:competence,grain:'month'},batchId:null,note:values.length?`Folha bruta identificada na competÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia ${competence}, sem encargos patronais.`:'Nenhum gabinete publicado nesta competÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Âªncia.',sampleSize:values.length}});}
