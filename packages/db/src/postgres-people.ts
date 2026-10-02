import type {Pool} from 'pg';

export type PeopleQuery={source?:'camara'|'senado';uf?:string;party?:string;search?:string;page?:number;pageSize?:number};

/** Read only the active people publication. Historical batches must never leak into public roster/detail. */
export function postgresPeopleRepository(pool:Pool){
  return {
    async list(q:PeopleQuery={}){
      const page=Math.max(1,q.page??1),size=Math.min(100,Math.max(1,q.pageSize??20));
      const where=['TRUE'];const values:any[]=[];
      const add=(sql:string,value:any)=>{values.push(value);where.push(sql.replace('$N',`$${values.length}`));};
      if(q.source)add('p.source=$N',q.source);
      if(q.uf)add('p.uf=$N',q.uf);
      if(q.party)add('p.party=$N',q.party);
      if(q.search)add('p.search_name LIKE $N','%'+q.search.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim()+'%');
      const r=await pool.query(`
        SELECT p.person_id,p.source,p.batch_id,p.external_id,p.name,p.search_name,p.uf,p.party,p.payload,b.published_at
          FROM civica_people_poc.profiles p
          JOIN civica_finance_poc.active_profile_publications ap
            ON ap.source=p.source AND ap.external_id=p.external_id AND ap.batch_id=p.batch_id
          LEFT JOIN civica.publication_batches b ON b.id=p.batch_id
         WHERE ${where.join(' AND ')}
         ORDER BY p.search_name,p.source,p.external_id
         LIMIT $${values.length+1} OFFSET $${values.length+2}`,[...values,size,(page-1)*size]);
      return {items:r.rows.map(x=>({personId:x.person_id,batchId:x.batch_id,publishedAt:x.published_at??null,source:x.source,externalId:x.external_id,...(x.payload??{})})),page,pageSize:size};
    },
    async detail(source:'camara'|'senado',externalId:string){
      const r=await pool.query(`
        SELECT p.person_id,p.source,p.batch_id,p.external_id,p.payload,b.published_at
          FROM civica_people_poc.profiles p
          JOIN civica_finance_poc.active_profile_publications ap
            ON ap.source=p.source AND ap.external_id=p.external_id AND ap.batch_id=p.batch_id
          LEFT JOIN civica.publication_batches b ON b.id=p.batch_id
         WHERE p.source=$1 AND p.external_id=$2
         LIMIT 1`,[source,externalId]);
      if(!r.rowCount)return null;
      const x=r.rows[0];
      const [m,p]=await Promise.all([
        pool.query("SELECT payload FROM civica_people_poc.mandates WHERE batch_id=$1 AND person_id=$2 ORDER BY (payload->>'legislature')::int DESC NULLS LAST,membership_key",[x.batch_id,x.person_id]),
        pool.query('SELECT payload FROM civica_people_poc.party_memberships WHERE batch_id=$1 AND person_id=$2 ORDER BY start_date,membership_key',[x.batch_id,x.person_id])
      ]);
      const payload=(x.payload&&typeof x.payload==='object'?x.payload:{});
      const mandates=Array.isArray(payload.mandates)&&payload.mandates.length?payload.mandates:m.rows.map(v=>v.payload);
      const parties=Array.isArray(payload.parties)&&payload.parties.length?payload.parties:p.rows.map(v=>v.payload);
      return {personId:x.person_id,batchId:x.batch_id,publishedAt:x.published_at??null,source:x.source,externalId:x.external_id,...payload,mandates,parties};
    }
  };
}
