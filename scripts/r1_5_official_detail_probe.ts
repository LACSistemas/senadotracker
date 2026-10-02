import {OfficialHttp} from '../apps/collector/src/http.ts';
const h=new OfficialHttp({source:'senado',maxAttempts:1,timeoutMs:15000});
for(const u of ['https://legis.senado.leg.br/dadosabertos/materia/172338.json','https://legis.senado.leg.br/dadosabertos/materia/172338','https://legis.senado.leg.br/dadosabertos/materia/172338/identificacao.json']){try{const x=await h.json(u);console.log(u,x.responseStatus,Object.keys(x.data??{}),JSON.stringify(x.data).slice(0,600))}catch(e){console.log('ERR',u,e instanceof Error?e.message:String(e))}}

