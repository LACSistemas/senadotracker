import type {Pool} from 'pg';
export function postgresElectionsRepository(pool:Pool){const q=async(sql:string,v:any[]=[])=> (await pool.query(sql,v)).rows; return {
 async publishedElectoralCoverage(){return q(`select e.year,e.round,e.scope,b.availability,b.note,b.published_at "publishedAt" from civica_elections_poc.electoral_batches b join civica_elections_poc.active_electoral_publications a on a.batch_id=b.id join civica_elections_poc.elections e on e.id=b.election_id order by e.year desc,e.round`);},
 async publishedElections(personId:string){const rows=await q(`select c.payload,c.batch_id,b.availability,b.note,b.published_at from civica_elections_poc.candidacies c join civica_elections_poc.active_electoral_publications a on a.batch_id=c.batch_id join civica_elections_poc.electoral_batches b on b.id=c.batch_id where c.person_id=$1 and c.match_status='confirmed' order by c.year desc`,[personId]); const out=[]; for(const r of rows){const c=r.payload; const assets=await q('select payload from civica_elections_poc.electoral_assets where batch_id=$1 and sequence_id=$2 order by asset_id',[r.batch_id,c.sequenceId]); out.push({candidacy:{...c,batchId:String(r.batch_id),availability:r.availability,note:r.note,publishedAt:r.published_at},assets:assets.map((x:any)=>x.payload),revenues:[],expenses:[]});} return out;},
 async publishedPersonElectoralProfile(personId:string){
   const elections=await this.publishedElections(personId);
   const sum=(values:any[])=>values.reduce((total,item)=>total+Number(item.valueCents??0),0);
   const normalized=elections.map((item:any)=>{
     const assets=item.assets??[], revenues=item.revenues??[], expenses=item.expenses??[];
     const assetIds=new Map<string,number>();
     for(const asset of assets)assetIds.set(String(asset.assetId??asset.asset_id??''),(assetIds.get(String(asset.assetId??asset.asset_id??''))??0)+1);
     const uniqueAssets=assets.filter((asset:any)=>assetIds.get(String(asset.assetId??asset.asset_id??''))===1);
     const candidacy=item.candidacy??{};
     const batchId=String(candidacy.batchId??'');
     const coverage={
       election:{availability:candidacy.availability??'available',source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:candidacy.note??'Candidatura vinculada ao lote eleitoral publicado.',sampleSize:1},
       assets:{availability:uniqueAssets.length?'available':'partial',source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:uniqueAssets.length?'Bens declarados pelo candidato neste pleito.':'Nenhum bem foi localizado no lote vinculado.',sampleSize:uniqueAssets.length},
       campaign:{availability:revenues.length||expenses.length?'available':'unavailable',source:'tse',period:{from:String(candidacy.year),to:String(candidacy.year),grain:'year'},batchId,note:revenues.length||expenses.length?'Contas de campanha vinculadas à candidatura.':'Contas de campanha não disponíveis para esta candidatura.',sampleSize:revenues.length+expenses.length},
     };
     return {...item,candidacy,assets:uniqueAssets,revenues,expenses,assetVersionConflicts:assets.length-uniqueAssets.length,transactionVersionConflicts:0,assetTotalCents:sum(uniqueAssets),revenueTotalCents:sum(revenues),expenseTotalCents:sum(expenses),coverage};
   });
   const patrimony=normalized.filter((item:any)=>item.assets.length).map((item:any)=>({year:Number(item.candidacy.year),electionId:String(item.candidacy.electionId),office:String(item.candidacy.office),valueCents:Number(item.assetTotalCents),assetCount:item.assets.length}));
   const changes=patrimony.slice(1).map((item:any,index:number)=>{const previous=patrimony[index]!;return {fromYear:previous.year,toYear:item.year,fromCents:previous.valueCents,toCents:item.valueCents,changeCents:item.valueCents-previous.valueCents,changeRate:previous.valueCents?item.valueCents/previous.valueCents-1:null,note:'Variação entre valores declarados em eleições distintas; não mede enriquecimento nem patrimônio atual.'};});
   const coverage=normalized.length?{availability:'available',source:'tse',period:{from:String(normalized[0].candidacy.year),to:String(normalized.at(-1).candidacy.year),grain:'year'},batchId:normalized.map((item:any)=>item.coverage.election.batchId).join(','),note:'Somente candidaturas com vínculo confirmado por múltiplas evidências.',sampleSize:normalized.length}:{availability:'unavailable',source:'tse',period:{from:null,to:null,grain:'unknown'},batchId:null,note:'Nenhuma candidatura com vínculo confirmado nos lotes eleitorais ativos.',sampleSize:0};
   return {coverage,elections:[...normalized].reverse(),patrimony,changes};
 }
};}
