import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { calculateVoteAgreement, normalizedComparableVote, openDatabase, publishedExpenseComparison, publishedPersonComparison } from '@senadotracker/db';
import type { LegislativeVote } from '@senadotracker/domain';

test('comparação vazia não fabrica média zero e valida recorte',async()=>{const dir=await mkdtemp(join(tmpdir(),'compare-'));const db=openDatabase(join(dir,'db.sqlite'));try{const result=publishedExpenseComparison(db,'senado',2026);assert.equal(result.meanCents,null);assert.deepEqual(result.items,[]);assert.throws(()=>publishedExpenseComparison(db,'senado',2026,{uf:'XX'}),/UF/)}finally{db.close()}});
test('comparação nominal exige de duas a quatro pessoas distintas',()=>{const db=openDatabase(':memory:');try{assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1'],'expenses'),/duas a quatro/);assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1','1'],'expenses'),/diferentes/);assert.throws(()=>publishedPersonComparison(db,'senado',2026,['1','2','3','4','5'],'expenses'),/duas a quatro/)}finally{db.close()}});
test('concordância exclui ausência e não voto do denominador',()=>{const vote=(deliberationId:string,externalId:string,value:string)=>({source:'senado',deliberationId,externalId,vote:value,description:null,party:'P',uf:'DF',recordedAt:null,rawId:'r'} satisfies LegislativeVote);const result=calculateVoteAgreement([vote('a','1','Sim'),vote('b','1','Não'),vote('c','1','Ausente')],[vote('a','2','SIM'),vote('b','2','Sim'),vote('c','2','Não')]);assert.equal(result.total,2);assert.equal(result.equal,1);assert.equal(result.ratio,.5);assert.equal(normalizedComparableVote('Obstrução'),null)});
