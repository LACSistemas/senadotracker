import crypto from 'node:crypto';
import { openPool } from './db.ts';

const REVISION='p147r-theme-metadata-20261105-v2';
const FACT_REVISION='p146-jn-themes-20261105';
const SCOPE='JN_THEMATIC_METADATA';
const canonical=(v:string, id='')=>{ if (['cnex1','cpex1','tcex1','iadex1','susex1'].includes(v)) return 'GENERAL_EXECUTION'; if (v==='tbaixex1') return 'CRIMINAL_EXECUTION'; if (v.startsWith('cnextfisc') || v.startsWith('cpextfisc') || v.startsWith('tbaixextfisc') || v.startsWith('tcextfisc') || v.startsWith('iadextfisc') || v.startsWith('susexfisc') || v.startsWith('pexsfisc') || v.startsWith('sentextfisc') || v.startsWith('incexpfisc')) return 'TAX_EXECUTION'; if (v.startsWith('cncrim') || v.startsWith('cpcrim') || v.startsWith('tbaixcrim')) return 'CRIMINAL'; if (['ic','ic1','ic2','icc1','icex1'].includes(v)) return 'CONCILIATION'; if (id.includes('DOMESTIC_VIOLENCE')) return 'DOMESTIC_VIOLENCE'; return null; };
const publicName=(v:string, old:string)=>{
  const map:Record<string,string>={
    cnex1:'Execução geral — casos novos',
    cpex1:'Execução geral — casos pendentes',
    tcex1:'Execução geral — taxa de congestionamento',
    iadex1:'Execução geral — índice de atendimento à demanda',
    susex1:'Execução geral — suspensos ou sobrestados',
    tbaixex1:'Execução penal — processos baixados',
    sentjudcrimfem:'Feminicídio — sentenças criminais',
  };
  return map[v] ?? old;
};
const sha=(x:unknown)=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const pool=openPool(3);
try {
  const before=(await pool.query(`SELECT i.indicator_id,i.public_name,i.official_name,i.description,i.source_variable,i.publication_status,i.provenance,
      count(o.observation_id)::int facts,count(*) FILTER(WHERE o.value_numeric IS NOT NULL)::int nonnull,count(*) FILTER(WHERE o.value_numeric IS NULL)::int nulls
      FROM civica_jud.jud_jn_indicator i LEFT JOIN civica_jud.jud_jn_observation o
      ON o.indicator_id=i.indicator_id AND o.publication_revision_id=$1
      WHERE i.indicator_id LIKE 'P146_%' GROUP BY i.indicator_id ORDER BY i.indicator_id`,[FACT_REVISION])).rows;
  if(before.length!==33) throw new Error(`P146 indicator audit expected 33, got ${before.length}`);
  const corrections=before.map((r:any)=>{
    const semanticTheme=canonical(r.source_variable,r.indicator_id) ?? r.provenance?.semanticTheme ?? r.provenance?.theme;
    const nextName=publicName(r.source_variable,r.public_name);
    const needs = semanticTheme!==r.provenance?.semanticTheme || nextName!==r.public_name || r.provenance?.p147r?.phase!=='P14.7-R';
    return { indicatorId:r.indicator_id, sourceVariable:r.source_variable, oldTheme:r.provenance?.theme ?? null, canonicalTheme:semanticTheme, oldPublicName:r.public_name, publicName:nextName, changed:needs, facts:Number(r.facts), nonnull:Number(r.nonnull), nulls:Number(r.nulls), oldProvenance:r.provenance };
  });
  const semanticHash=sha({phase:'P14.7-R',factRevision:FACT_REVISION,corrections:corrections.map(c=>({indicatorId:c.indicatorId,sourceVariable:c.sourceVariable,canonicalTheme:c.canonicalTheme,publicName:c.publicName}))});
  const client=await pool.connect();
  let replay='NEW_REVISION';
  try {
    await client.query('BEGIN');
    const existing=(await client.query(`SELECT revision_id,semantic_hash FROM civica_jud.jud_publication_revision WHERE scope=$1 AND semantic_hash=$2`,[SCOPE,semanticHash])).rows[0];
    if(existing) {
      replay='UNCHANGED_REPLAY';
    } else {
      await client.query(`UPDATE civica_jud.jud_publication_revision SET is_active=false WHERE scope=$1 AND is_active=true`,[SCOPE]);
      await client.query(`INSERT INTO civica_jud.jud_publication_revision(revision_id,scope,snapshot_ids,semantic_hash,row_count,state,is_active,last_known_good,previous_revision_id,created_at,activated_at,provenance)
        VALUES($1,$2,$3::jsonb,$4,0,'ACTIVE',true,true,(SELECT revision_id FROM civica_jud.jud_publication_revision WHERE scope=$2 ORDER BY created_at DESC LIMIT 1),now(),now(),$5::jsonb)`,
        [REVISION,SCOPE,JSON.stringify(['p142-jn-main-2026','p142-jn-dictionary-2026',FACT_REVISION]),semanticHash,JSON.stringify({phase:'P14.7-R',metadataOnly:true,factRevisionId:FACT_REVISION,source:'CNJ Justiça em Números 2026',correctionCount:corrections.filter(c=>c.changed).length,noNewCollection:true})]);
      for(const c of corrections) {
        const p={...(c.oldProvenance??{}),semanticTheme:c.canonicalTheme,legacyTheme:c.oldTheme,legacyPublicName:c.oldPublicName,p147r:{phase:'P14.7-R',revisionId:REVISION,corrected:true,factRevisionId:FACT_REVISION,compatibilityAlias:true}};
        const desc=c.sourceVariable==='sentjudcrimfem'?'Sentença Judicial Criminal de Feminicídio; publicação corrigida para distinguir sentença de execução.':undefined;
        await client.query(`UPDATE civica_jud.jud_jn_indicator SET public_name=$2,description=COALESCE($3,description),publication_status='PUBLISHED_THEMATIC_CORRECTED',provenance=$4::jsonb WHERE indicator_id=$1`,[c.indicatorId,c.publicName,desc,JSON.stringify(p)]);
      }
    }
    await client.query('COMMIT');
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
  const after=(await pool.query(`SELECT i.indicator_id,i.public_name,i.official_name,i.source_variable,i.publication_status,i.provenance,
      count(o.observation_id)::int facts,count(*) FILTER(WHERE o.value_numeric IS NOT NULL)::int nonnull,count(*) FILTER(WHERE o.value_numeric IS NULL)::int nulls
      FROM civica_jud.jud_jn_indicator i LEFT JOIN civica_jud.jud_jn_observation o
      ON o.indicator_id=i.indicator_id AND o.publication_revision_id=$1
      WHERE i.indicator_id LIKE 'P146_%' GROUP BY i.indicator_id ORDER BY i.indicator_id`,[FACT_REVISION])).rows;
  const result={revisionId:REVISION,factRevisionId:FACT_REVISION,replay,semanticHash,before,corrections,after,rowsBefore:before.reduce((n,r)=>n+Number(r.facts),0),rowsAfter:after.reduce((n,r)=>n+Number(r.facts),0),nonnullBefore:before.reduce((n,r)=>n+Number(r.nonnull),0),nonnullAfter:after.reduce((n,r)=>n+Number(r.nonnull),0),nullBefore:before.reduce((n,r)=>n+Number(r.nulls),0),nullAfter:after.reduce((n,r)=>n+Number(r.nulls),0)};
  console.log(JSON.stringify(result,null,2));
} finally { await pool.end(); }



