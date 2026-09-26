import type {DatabaseSync} from 'node:sqlite';

export type CommissionAgendaQuery={from:string;to:string;source?:'senado'|'camara';body?:string;meetingType?:string;status?:string};

export type CommissionComposition={bodyId:string;source:string;externalId:string;coverage:'complete_current'|'unavailable';observedAt:string|null;president:any|null;vicePresidents:any[];titularMembers:any[];alternateMembers:any[];otherMembers:any[];allMembers:any[]};

export function reconcileCommissionMembershipKeys(previous:string[],current:string[],complete:boolean,allowEmpty=false){

 if(!complete||(!allowEmpty&&current.length===0))return [];

 const present=new Set(current);return previous.filter(key=>!present.has(key));

}

export type CommissionRapporteurship={proposalId:string;proposalLabel:string|null;proposalSummary:string|null;personId:string|null;personName:string|null;party:string|null;uf:string|null;role:string|null;start:string|null;end:string|null;status:string|null;bodyId:string;bodyLabel:string|null;rawId:string|null;officialUrl:string|null;source:'senado'|'camara';eventCount?:number;firstRecordDate?:string|null;lastRecordDate?:string|null;events?:CommissionRapporteurship[]};
export type CommissionRapporteurshipGroup={proposalId:string;proposalLabel:string|null;proposalSummary:string|null;rapporteurs:CommissionRapporteurship[]};

export function commissionRapporteurships(db:DatabaseSync,bodyId:string,limit=12):{coverage:'complete'|'partial'|'unavailable';known:CommissionRapporteurshipGroup[];totalRecords:number;distinctProposals:number;source:string;provenance:string[]}{
 const body=db.prepare('SELECT id,source,external_id,sigla,name FROM legislative_bodies WHERE id=? OR external_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').get(bodyId,bodyId,bodyId) as any;

 if(!body)return {coverage:'unavailable',known:[],totalRecords:0,distinctProposals:0,source:'',provenance:[]};

 const rows=db.prepare(`SELECT json_extract(a.payload,'$.proposalId') proposal_id,json_extract(a.payload,'$.personExternalId') person_id,json_extract(a.payload,'$.role') role,json_extract(a.payload,'$.start') start,json_extract(a.payload,'$.end') end,json_extract(a.payload,'$.status') status,json_extract(a.payload,'$.bodyId') body_external_id,json_extract(a.payload,'$.bodyLabel') body_label,json_extract(a.payload,'$.rawId') raw_id,json_extract(a.payload,'$.officialUrl') official_url,COALESCE(json_extract(p.payload,'$.label'),json_extract(p.payload,'$.descricaoIdentificacao')) proposal_label,COALESCE(json_extract(p.payload,'$.summary'),json_extract(p.payload,'$.summary')) proposal_summary,pr.name person_name,pr.party,pr.uf FROM legislative_appointments a LEFT JOIN proposals p ON p.source=a.source AND p.external_id=json_extract(a.payload,'$.proposalId') LEFT JOIN profiles pr ON pr.external_id=json_extract(a.payload,'$.personExternalId') WHERE a.source=? AND a.kind='rapporteurship' AND json_extract(a.payload,'$.bodyId')=? AND json_extract(a.payload,'$.proposalId') IS NOT NULL ORDER BY COALESCE(json_extract(a.payload,'$.start'),'') DESC,a.external_id DESC`).all(String(body.source),String(body.external_id)) as any[];

 const groups=new Map<string,CommissionRapporteurshipGroup>();for(const r of rows){const event={proposalId:String(r.proposal_id),proposalLabel:r.proposal_label?String(r.proposal_label):null,proposalSummary:r.proposal_summary?String(r.proposal_summary):null,personId:r.person_id?String(r.person_id):null,personName:r.person_name?String(r.person_name):null,party:r.party?String(r.party):null,uf:r.uf?String(r.uf):null,role:r.role?String(r.role):null,start:r.start?String(r.start):null,end:r.end?String(r.end):null,status:r.status?String(r.status):null,bodyId:String(body.id),bodyLabel:r.body_label?String(r.body_label):null,rawId:r.raw_id?String(r.raw_id):null,officialUrl:r.official_url?String(r.official_url):null,source:String(body.source) as 'senado'|'camara'};const g=groups.get(event.proposalId)??{proposalId:event.proposalId,proposalLabel:event.proposalLabel,proposalSummary:event.proposalSummary,rapporteurs:[]};const key=`${event.personId??'unknown'}|${event.role??''}`;const existing=g.rapporteurs.find(x=>`${x.personId??'unknown'}|${x.role??''}`===key);if(existing){const duplicate=(existing.events??[]).some(x=>x.start===event.start&&x.status===event.status&&x.end===event.end);if(!duplicate){existing.events=[...(existing.events??[]),event];existing.eventCount=(existing.eventCount??1)+1;const dates=[existing.firstRecordDate,event.start].filter(Boolean).sort() as string[];existing.firstRecordDate=dates[0]??null;existing.lastRecordDate=dates.at(-1)??null;}}else g.rapporteurs.push({...event,eventCount:1,firstRecordDate:event.start,lastRecordDate:event.start,events:[event]});groups.set(event.proposalId,g)}
 const ordered=[...groups.values()].sort((a,b)=>{const ad=a.rapporteurs.map(x=>x.start||'').sort().at(-1)||'';const bd=b.rapporteurs.map(x=>x.start||'').sort().at(-1)||'';return bd.localeCompare(ad)||a.proposalId.localeCompare(b.proposalId)});

 return {coverage:rows.length?'complete':'unavailable',known:ordered.slice(0,Math.max(0,limit)),totalRecords:rows.length,distinctProposals:groups.size,source:String(body.source),provenance:[...new Set(rows.map(r=>String(r.raw_id)).filter(Boolean))]};

}
export function commissionMatters(db:DatabaseSync,bodyId:string,year?:number,limit=10){
 const body=db.prepare('SELECT id,source,external_id FROM legislative_bodies WHERE id=? OR external_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').get(bodyId,bodyId,bodyId) as any;if(!body)return {coverage:'unavailable',totalDistinctProposals:0,items:[]};
 const rows=db.prepare(`SELECT i.proposal_id,i.proposal_source,COALESCE(i.title,json_extract(p.payload,'$.label'),json_extract(p.payload,'$.descricaoIdentificacao')) title,COALESCE(i.description,json_extract(p.payload,'$.summary')) description,i.result_raw,i.active,m.scheduled_date,m.scheduled_start_at,m.id meeting_id FROM commission_agenda_items i JOIN commission_meetings m ON m.id=i.meeting_id JOIN commission_meeting_bodies mb ON mb.meeting_id=m.id LEFT JOIN proposals p ON p.source=i.proposal_source AND p.external_id=i.proposal_id WHERE i.source=? AND mb.body_id=? AND i.proposal_id IS NOT NULL ${year?"AND strftime('%Y',coalesce(m.scheduled_date,m.scheduled_start_at))=?":''} ORDER BY coalesce(m.scheduled_date,m.scheduled_start_at) DESC`).all(String(body.source),String(body.id),...(year?[String(year)]:[])) as any[];
 const groups=new Map<string,any>();for(const r of rows){const key=String(r.proposal_id);const g=groups.get(key)??{proposalId:key,proposalSource:r.proposal_source,proposalLabel:r.title||null,firstAppearance:null,lastAppearance:null,appearancesCount:0,latestPublishedResult:null,appearances:[]};const date=String(r.scheduled_date||r.scheduled_start_at||'').slice(0,10);g.firstAppearance=!g.firstAppearance||date<g.firstAppearance?date:g.firstAppearance;g.lastAppearance=!g.lastAppearance||date>g.lastAppearance?date:g.lastAppearance;g.appearancesCount++;if(r.result_raw&&!g.latestPublishedResult)g.latestPublishedResult=String(r.result_raw);g.appearances.push({meetingId:String(r.meeting_id),date,resultRaw:r.result_raw?String(r.result_raw):null,active:Boolean(r.active)});groups.set(key,g)}const items=[...groups.values()].sort((a,b)=>String(b.lastAppearance).localeCompare(String(a.lastAppearance))||a.proposalId.localeCompare(b.proposalId)).slice(0,limit);return {coverage:'available',totalDistinctProposals:groups.size,items};
}
/** Current composition from the latest complete Câmara membership snapshot. */

export function commissionComposition(db:DatabaseSync,bodyId:string):CommissionComposition|null{

 const body=db.prepare('SELECT id,source,external_id FROM legislative_bodies WHERE id=? OR external_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').get(bodyId,bodyId,bodyId) as any;

 if(!body)return null;

 const rows=db.prepare("SELECT s.*,p.name AS person_name,p.party AS profile_party,p.uf AS profile_uf,json_extract(p.payload,'$.photoUrl') AS person_photo FROM commission_membership_snapshots s LEFT JOIN profiles p ON p.external_id=s.person_external_id WHERE s.body_id=? AND s.active=1 ORDER BY s.person_external_id,s.observed_at DESC").all(String(body.id)) as any[];
 const byPerson=new Map<string,any>();for(const r of rows){const key=String(r.person_external_id);const mapped={personExternalId:key,personName:r.person_name??null,role:r.role_raw??null,party:r.party??r.profile_party??null,uf:r.uf??r.profile_uf??null,photoUrl:r.person_photo??null,legislature:r.legislature??null,startDate:r.start_date??null,endDate:r.end_date??null,status:r.status??null,observedAt:r.observed_at,source:r.source,bodyExternalId:r.body_external_id};const previous=byPerson.get(key);if(!previous)byPerson.set(key,mapped);else{const roles=new Set(String(previous.role??'').split(' · ').filter(Boolean));if(mapped.role)roles.add(String(mapped.role));previous.role=[...roles].join(' · ');previous.party=previous.party??mapped.party;previous.uf=previous.uf??mapped.uf;previous.photoUrl=previous.photoUrl??mapped.photoUrl;previous.observedAt=String(previous.observedAt)>String(mapped.observedAt)?previous.observedAt:mapped.observedAt;}}
 const allMembers=[...byPerson.values()], role=(r:any)=>String(r.role??'').toLowerCase();
 return {bodyId:String(body.id),source:String(body.source),externalId:String(body.external_id),coverage:rows.length?'complete_current':'unavailable',observedAt:rows.length?String(rows.reduce((a,b)=>String(a.observed_at)>String(b.observed_at)?a:b).observed_at):null,president:allMembers.find(r=>/presidente/.test(role(r))&&!/vice/.test(role(r)))??null,vicePresidents:allMembers.filter(r=>/vice/.test(role(r))),titularMembers:allMembers.filter(r=>/titular/.test(role(r))&&!/presidente|vice/.test(role(r))),alternateMembers:allMembers.filter(r=>/suplente|alternate/.test(role(r))),otherMembers:allMembers.filter(r=>!/(titular|suplente|alternate|presidente|vice)/.test(role(r))),allMembers};
}

export function publishedCommissionAgenda(db:DatabaseSync,q:CommissionAgendaQuery){

 const where=['date(COALESCE(m.scheduled_date,m.scheduled_start_at)) BETWEEN date(?) AND date(?)'],params:any[]=[q.from,q.to];

 if(q.source){where.push('m.source=?');params.push(q.source)}

 if(q.body){where.push('EXISTS (SELECT 1 FROM commission_meeting_bodies bx JOIN legislative_bodies bb ON bb.id=bx.body_id WHERE bx.meeting_id=m.id AND (bb.sigla=? OR bb.external_id=?))');params.push(q.body,q.body)}

 if(q.meetingType){where.push('(m.meeting_type_normalized=? OR m.meeting_type_raw=?)');params.push(q.meetingType,q.meetingType)}

 if(q.status){where.push('(m.status_normalized=? OR m.status_raw=?)');params.push(q.status,q.status)}

 const meetings=db.prepare(`SELECT m.*,COALESCE((SELECT json_group_array(json_object('id',b.id,'sigla',b.sigla,'name',b.name,'externalId',b.external_id,'house',b.house)) FROM commission_meeting_bodies mb JOIN legislative_bodies b ON b.id=mb.body_id WHERE mb.meeting_id=m.id),'[]') bodies,(SELECT count(*) FROM commission_agenda_items i WHERE i.meeting_id=m.id AND i.active=1) item_count FROM commission_meetings m WHERE ${where.join(' AND ')} ORDER BY CASE WHEN m.scheduled_start_at IS NULL THEN 1 ELSE 0 END,m.scheduled_start_at`).all(...params) as any[];

 return meetings.map(m=>{const items=db.prepare(`SELECT i.*,COALESCE(json_extract((SELECT p.payload FROM proposals p WHERE p.source=i.proposal_source AND p.external_id=i.proposal_id ORDER BY p.rowid DESC LIMIT 1),'$.label'),i.title) proposal_label, json_extract((SELECT p.payload FROM proposals p WHERE p.source=i.proposal_source AND p.external_id=i.proposal_id ORDER BY p.rowid DESC LIMIT 1),'$.summary') proposal_summary FROM commission_agenda_items i WHERE i.meeting_id=? AND i.active=1 ORDER BY COALESCE(i.order_normalized,999999),i.id`).all(m.id) as any[];return {...m,bodies:JSON.parse(m.bodies||'[]'),items,changes:commissionMeetingChanges(db,String(m.id))}})

}



export type CommissionMeetingChange={type:string;occurredAt:string;itemId?:string;proposalId?:string|undefined;previousValue?:string|null|undefined;currentValue?:string|null|undefined};

export function commissionMeetingChanges(db:DatabaseSync,meetingId:string):CommissionMeetingChange[]{

 const changes:CommissionMeetingChange[]=[];

 const versions=db.prepare('SELECT v.payload,v.observed_at,v.raw_id,COALESCE(r.sha256,v.raw_id) provenance FROM commission_meeting_versions v LEFT JOIN raw_objects r ON r.id=v.raw_id WHERE v.meeting_id=? ORDER BY v.observed_at,v.id').all(meetingId) as any[];

 const previous=new Map<string,any>();

 for(const row of versions){const p=JSON.parse(String(row.payload));const raw=String(row.provenance??row.raw_id??'');for(const key of ['startAt','scheduledDate','location','title','description','status']){const value=p[key]??null,old=previous.get(key);if(old&&old.raw!==raw&&old.value!==value){const type=key==='startAt'?'meeting_time_changed':key==='scheduledDate'?'meeting_date_changed':key==='location'?'meeting_location_changed':key==='status'?'meeting_status_changed':null;if(type)changes.push({type,occurredAt:String(row.observed_at),previousValue:old.value,currentValue:value})}previous.set(key,{value,raw})}}

 const items=db.prepare('SELECT i.id,i.proposal_id,v.payload,v.active,v.observed_at,v.raw_id,COALESCE(r.sha256,v.raw_id) provenance FROM commission_agenda_items i JOIN commission_agenda_item_versions v ON v.item_id=i.id LEFT JOIN raw_objects r ON r.id=v.raw_id WHERE i.meeting_id=? ORDER BY v.observed_at,v.id').all(meetingId) as any[];

 const seen=new Map<string,any>();

 for(const row of items){const id=String(row.id),p=JSON.parse(String(row.payload)),old=seen.get(id),active=Number(row.active),raw=String(row.provenance??row.raw_id??'');if(old&&old.raw!==raw&&old.active!==active)changes.push({type:active?'agenda_item_restored':'agenda_item_removed',occurredAt:String(row.observed_at),itemId:id,proposalId:row.proposal_id?String(row.proposal_id):undefined});else if(old&&old.raw!==raw&&old.order!==p.order)changes.push({type:'agenda_item_reordered',occurredAt:String(row.observed_at),itemId:id,proposalId:row.proposal_id?String(row.proposal_id):undefined,previousValue:String(old.order??''),currentValue:String(p.order??'')});else if(old&&old.raw!==raw&&old.active===active&&String(p.result??'')!==String(old.result??''))changes.push({type:'agenda_item_result_changed',occurredAt:String(row.observed_at),itemId:id,proposalId:row.proposal_id?String(row.proposal_id):undefined,previousValue:old.result??null,currentValue:p.result??null});seen.set(id,{active,order:p.order,observed:String(row.observed_at),result:p.result,raw})}

 return changes;

}



export function publishedCommissionDetail(db:DatabaseSync, bodyId:string, year=new Date().getFullYear()){
 const body=db.prepare('SELECT * FROM legislative_bodies WHERE id=? OR external_id=? ORDER BY CASE WHEN id=? THEN 0 ELSE 1 END LIMIT 1').get(bodyId,bodyId,bodyId) as any;

 if(!body)return null;

 const canonicalBodyId=String(body.id);

 const meetings=db.prepare(`SELECT m.*, (SELECT json_group_array(json_object('id',b.id,'sigla',b.sigla,'name',b.name,'externalId',b.external_id,'house',b.house)) FROM commission_meeting_bodies mb JOIN legislative_bodies b ON b.id=mb.body_id WHERE mb.meeting_id=m.id) bodies,(SELECT count(*) FROM commission_agenda_items i WHERE i.meeting_id=m.id AND i.active=1) item_count FROM commission_meetings m JOIN commission_meeting_bodies mb0 ON mb0.meeting_id=m.id WHERE mb0.body_id=? ORDER BY COALESCE(m.scheduled_date,m.scheduled_start_at) DESC,m.scheduled_start_at DESC`).all(canonicalBodyId) as any[];

 const mapMeeting=(m:any)=>{const items=db.prepare(`SELECT i.*,COALESCE(json_extract((SELECT p.payload FROM proposals p WHERE p.source=i.proposal_source AND p.external_id=i.proposal_id ORDER BY p.rowid DESC LIMIT 1),'$.label'),i.title) proposal_label,json_extract((SELECT p.payload FROM proposals p WHERE p.source=i.proposal_source AND p.external_id=i.proposal_id ORDER BY p.rowid DESC LIMIT 1),'$.summary') proposal_summary FROM commission_agenda_items i WHERE i.meeting_id=? AND i.active=1 ORDER BY COALESCE(i.order_normalized,999999),i.id`).all(m.id) as any[];return {...m,bodies:JSON.parse(m.bodies||'[]'),items,changes:commissionMeetingChanges(db,String(m.id))}};

 const all=meetings.map(mapMeeting),today=new Date().toISOString().slice(0,10),future=all.filter(m=>String(m.scheduled_date||'9999').slice(0,10)>=today),recent=all.filter(m=>String(m.scheduled_date||'').slice(0,10)<today).slice(0,5);

 const annual=all.filter(m=>String(m.scheduled_date||'').startsWith(String(year))).flatMap(m=>m.items),matters=[...new Set(annual.map(i=>i.proposal_id).filter(Boolean))];

 const composition=String(body.source)==='camara'?commissionComposition(db,canonicalBodyId):null;

 const rapporteurships=commissionRapporteurships(db,canonicalBodyId,12);
 const matterIndex=commissionMatters(db,canonicalBodyId,year,10);
 const agendaCoverage=body.source==='camara'&&all.length===0?'unavailable':all.length?'available':'unavailable';
 const senateRows=String(body.source)==='senado'?db.prepare("SELECT a.payload,p.name,p.party,p.uf,json_extract(p.payload,'$.photoUrl') AS photo_url FROM legislative_appointments a LEFT JOIN profiles p ON p.external_id=json_extract(a.payload,'$.personExternalId') WHERE a.source='senado' AND a.kind IN ('commission','office') AND json_extract(a.payload,'$.bodyId')=? AND (json_extract(a.payload,'$.end') IS NULL OR date(json_extract(a.payload,'$.end'))>=date('now'))").all(String(body.external_id)) as any[]:[];
 const senateMap=new Map<string,any>();for(const r of senateRows){const p=JSON.parse(String(r.payload)),id=String(p.personExternalId??'');if(!id)continue;const item=senateMap.get(id)??{personExternalId:id,name:r.name??null,role:null,party:r.party??p.party??null,uf:r.uf??p.uf??null,photoUrl:r.photo_url??null,source:'senado'};const roles=new Set(String(item.role??'').split(' · ').filter(Boolean));if(p.role)roles.add(String(p.role));item.role=[...roles].join(' · ');item.name=item.name??r.name??null;item.party=item.party??r.party??p.party??null;item.uf=item.uf??r.uf??p.uf??null;item.photoUrl=item.photoUrl??r.photo_url??null;senateMap.set(id,item)}
 const senateMembers=[...senateMap.values()];
 return {body, nextMeeting:future[future.length-1]??null, recent, agendaCoverage, activity:{year,meetings:all.filter(m=>String(m.scheduled_date||'').startsWith(String(year))).length,items:annual.length,matters:matters.length}, rapporteurships, composition, members:senateMembers, matters: matterIndex.items, mattersCoverage:matterIndex.coverage, mattersTotal:matterIndex.totalDistinctProposals};
}

export type CommissionDirectoryQuery={house?:'CAMARA'|'SENADO'|'CONGRESSO'|'ALL';query?:string;page?:number;pageSize?:number;currentOnly?:boolean};

const normalizeCommissionText=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('pt-BR').trim();
const localCommissionDate=(now:Date)=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
// Civil dates remain civil dates. A missing hour cannot prove a future meeting today.
export function commissionMeetingMoment(date:string|null,startAt:string|null,now=new Date()){
 const civil=date?.slice(0,10);
 const instant=startAt?new Date(/(?:Z|[+-]\d{2}:?\d{2})$/.test(startAt)?startAt:`${startAt}-03:00`).getTime():NaN;
 return {future:Number.isFinite(instant)?instant>now.getTime():Boolean(civil&&civil>localCommissionDate(now)),order:Number.isFinite(instant)?instant:civil?new Date(`${civil}T00:00:00-03:00`).getTime():0};
}

export function publishedCommissionDirectory(db:DatabaseSync,q:CommissionDirectoryQuery={},now=new Date()){
 const year=localCommissionDate(now).slice(0,4),search=normalizeCommissionText(q.query??''),pageSize=Math.min(48,Math.max(1,Math.floor(q.pageSize||24)));
 const base=(db.prepare('SELECT id,source,external_id,sigla,name,house FROM legislative_bodies').all() as any[]).filter(r=>r.name&&r.sigla&&!/BANEGRA|BANCADA|CENTRO DE ESTUDOS|DIRETORIA|MESA DIRETORA|PLEN/i.test(`${r.sigla} ${r.name}`));
 const stats=new Map(base.map(b=>[String(b.id),{meetings:[] as any[],composition:0,rapporteurs:0}]));
 for(const m of db.prepare('SELECT mb.body_id,m.scheduled_date,m.scheduled_start_at FROM commission_meeting_bodies mb JOIN commission_meetings m ON m.id=mb.meeting_id').all() as any[])stats.get(String(m.body_id))?.meetings.push({...m,...commissionMeetingMoment(m.scheduled_date,m.scheduled_start_at,now)});
 for(const r of db.prepare('SELECT body_id,count(DISTINCT person_external_id) n FROM commission_membership_snapshots WHERE active=1 GROUP BY body_id').all()) {const s=stats.get(String(r.body_id));if(s)s.composition=Number(r.n)}
 const byIdentity=new Map(base.map(b=>[`${b.source}:${b.external_id}`,b]));
 for(const r of db.prepare("SELECT source,json_extract(payload,'$.bodyId') body_id,count(DISTINCT json_extract(payload,'$.proposalId')) n FROM legislative_appointments WHERE kind='rapporteurship' AND json_extract(payload,'$.proposalId') IS NOT NULL GROUP BY source,json_extract(payload,'$.bodyId')").all()) {const b=byIdentity.get(`${r.source}:${r.body_id}`);if(b)stats.get(String(b.id))!.rapporteurs=Number(r.n)}
 const eligible=base.filter(b=>{const s=stats.get(String(b.id))!;return (b.source==='senado'||/COMISS|CEX|CPI|CPMI/i.test(`${b.sigla} ${b.name}`))&&(s.meetings.length+s.composition+s.rapporteurs>0)});
 const counts={total:eligible.length,CAMARA:0,SENADO:0,CONGRESSO:0};for(const b of eligible)if(b.house in counts)counts[b.house as 'CAMARA'|'SENADO'|'CONGRESSO']++;
 const rank=(b:any)=>normalizeCommissionText(b.sigla)===search?0:normalizeCommissionText(b.name).startsWith(search)?1:normalizeCommissionText(b.name).includes(search)?2:3;
 const filtered=eligible.filter(b=>(!q.house||q.house==='ALL'||b.house===q.house)&&(!search||[b.name,b.sigla,b.external_id].some(v=>normalizeCommissionText(String(v)).includes(search)))).sort((a,b)=>(search?rank(a)-rank(b):0)||a.name.localeCompare(b.name,'pt-BR')||String(a.id).localeCompare(String(b.id)));
 const grouped=!search&&(!q.house||q.house==='ALL'),total=filtered.length,pageCount=Math.max(1,Math.ceil(total/pageSize)),page=Math.min(pageCount,Math.max(1,Math.floor(q.page||1)));
 const selected=grouped?['SENADO','CAMARA','CONGRESSO'].flatMap(h=>filtered.filter(b=>b.house===h).slice(0,6)):filtered.slice((page-1)*pageSize,page*pageSize);
 const matters=new Map<string,number>();
 if(selected.length){const ids=selected.map(b=>String(b.id));for(const r of db.prepare(`SELECT mb.body_id,count(DISTINCT i.proposal_id) n FROM commission_meeting_bodies mb JOIN commission_meetings m ON m.id=mb.meeting_id JOIN commission_agenda_items i ON i.meeting_id=m.id WHERE mb.body_id IN (${ids.map(()=>'?').join(',')}) AND i.active=1 AND substr(coalesce(m.scheduled_date,m.scheduled_start_at),1,4)=? GROUP BY mb.body_id`).all(...ids,year))matters.set(String(r.body_id),Number(r.n))}
 const items=selected.map(b=>{const s=stats.get(String(b.id))!,next=s.meetings.filter(m=>m.future).sort((a,b)=>a.order-b.order)[0],last=s.meetings.filter(m=>!m.future&&m.order).sort((a,b)=>b.order-a.order)[0],meeting=next??last,n=matters.get(String(b.id))??0;
 const metadata:{label:string;value:string;date?:string;startAt?:string|null}[]=[];
 if(meeting)metadata.push({label:next?'Próxima reunião':'Última reunião',value:'',date:meeting.scheduled_date??localCommissionDate(new Date(meeting.order)),startAt:meeting.scheduled_start_at});
 if(n)metadata.push({label:'Matérias pautadas',value:`${n} matérias pautadas em ${year}`});
 if(s.composition)metadata.push({label:'Composição atual',value:`${s.composition} membros`});
 if(s.rapporteurs)metadata.push({label:'Relatorias identificadas',value:`${s.rapporteurs} matérias com relatoria identificada`});
 return {body:{id:String(b.id),source:String(b.source),externalId:String(b.external_id),name:String(b.name),sigla:String(b.sigla),house:String(b.house)},publicUrl:`/comissoes/${encodeURIComponent(String(b.id))}`,metadata:metadata.slice(0,2)};
 });
 return {items,total,counts,grouped,page,pageSize,pageCount};
}

export function publishedCommissionOverview(db:DatabaseSync,limit=3,now=new Date()){
 const rows=(db.prepare(`SELECT m.*,b.id body_id,b.source body_source,b.external_id body_external_id,b.name body_name,b.sigla body_sigla,b.house FROM commission_meetings m JOIN commission_meeting_bodies mb ON mb.meeting_id=m.id JOIN legislative_bodies b ON b.id=mb.body_id ORDER BY b.name,b.id`).all() as any[]).map(r=>({...r,...commissionMeetingMoment(r.scheduled_date,r.scheduled_start_at,now)}));
 const unique=[...new Map(rows.map(r=>[String(r.id),r])).values()].filter(r=>r.order);
 const future=unique.some(r=>r.future),selected=unique.filter(r=>r.future===future).sort((a,b)=>(future?a.order-b.order:b.order-a.order)||String(a.id).localeCompare(String(b.id))).slice(0,Math.max(1,Math.min(4,limit)));
 const counts=new Map<string,number>();if(selected.length)for(const r of db.prepare(`SELECT meeting_id,count(*) n FROM commission_agenda_items WHERE active=1 AND meeting_id IN (${selected.map(()=>'?').join(',')}) GROUP BY meeting_id`).all(...selected.map(r=>r.id)))counts.set(String(r.meeting_id),Number(r.n));
 return {future,items:selected.map(r=>({id:String(r.id),date:r.scheduled_date??localCommissionDate(new Date(r.order)),startAt:r.scheduled_start_at,title:r.title||r.description||null,itemCount:counts.get(String(r.id))??0,body:{id:String(r.body_id),source:String(r.body_source),externalId:String(r.body_external_id),name:String(r.body_name),sigla:String(r.body_sigla),house:String(r.house)}}))};
}
