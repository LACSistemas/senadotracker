// Uso: AUDIT_SCRATCH=<pasta> node scripts/fetch-presented-universe.cjs
// Baixa (somente leitura) a lista oficial de entidades apresentadas em 2026, por data de apresentação, Câmara e Senado.
const fs=require('fs');const S=(process.env.AUDIT_SCRATCH||'.')+'/'; // pasta de saída (fora do repositório)
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let requests=0;
async function get(url){for(let a=1;a<=5;a++){await sleep(150);requests++;try{const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'Civica/0.1 (official-data-research)'}});if(r.status===429||r.status>=500){await sleep(1000*a);continue}if(r.status!==200)throw new Error('HTTP '+r.status+' '+url);return await r.json()}catch(e){if(a===5)throw e;await sleep(800*a)}}}
const log=m=>fs.appendFileSync(S+'fetch_b.log',m+'\n');
(async()=>{
 // ---- Câmara: janelas mensais
 const months=[];for(let m=1;m<=12;m++){const from=`2026-${String(m).padStart(2,'0')}-01`;const last=new Date(Date.UTC(2026,m,0)).getUTCDate();months.push([from,`2026-${String(m).padStart(2,'0')}-${last}`])}
 const camara=new Map();const perMonth={};
 for(const [from,to] of months){let page=1,n=0;while(true){const d=await get(`https://dadosabertos.camara.leg.br/api/v2/proposicoes?dataApresentacaoInicio=${from}&dataApresentacaoFim=${to}&itens=100&pagina=${page}&ordem=ASC&ordenarPor=id`);const rows=d.dados||[];if(!rows.length)break;for(const x of rows){if(!camara.has(x.id))camara.set(x.id,{id:String(x.id),t:x.siglaTipo,n:x.numero,a:x.ano,m:from.slice(5,7)});n++}
   if(page%20===0)log(`camara ${from} p${page} total=${camara.size}`);page++;if(rows.length<100)break}
  perMonth[from.slice(0,7)]=n;log(`camara ${from}..${to}: ${n} (únicos acumulados ${camara.size}) req=${requests}`)}
 fs.writeFileSync(S+'camara_B_api.json',JSON.stringify({perMonth,items:[...camara.values()]}));
 // ---- Senado: lista por data de apresentação (mensal para limitar tamanho)
 const sen=new Map();const sPer={};
 for(let m=1;m<=12;m++){const from=`2026${String(m).padStart(2,'0')}01`;const last=new Date(Date.UTC(2026,m,0)).getUTCDate();const to=`2026${String(m).padStart(2,'0')}${last}`;
  const d=await get(`https://legis.senado.leg.br/dadosabertos/materia/pesquisa/lista.json?dataInicioApresentacao=${from}&dataFimApresentacao=${to}`);
  let rows=d?.PesquisaBasicaMateria?.Materias?.Materia||[];if(!Array.isArray(rows))rows=[rows];
  for(const x of rows)sen.set(String(x.Codigo),{id:String(x.Codigo),t:x.Sigla,n:x.Numero,a:Number(x.Ano),data:x.Data,com:x.SiglaComissao||null,autor:x.Autor||null});
  sPer[from.slice(0,6)]=rows.length;log(`senado ${from}..${to}: ${rows.length} req=${requests}`)}
 fs.writeFileSync(S+'senado_B_api.json',JSON.stringify({perMonth:sPer,items:[...sen.values()]}));
 log(`FIM camara=${camara.size} senado=${sen.size} requests=${requests}`);
})().catch(e=>{log('ERRO '+e.stack);process.exit(1)});
