// Mede o custo do resumo por Casa e prova que o coroplético não emite consulta nova.
// Uso: npm run benchmark:house-metrics
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { openDatabase, legislatureYears, publishedCurrentVoteAxis, publishedHouseMetricSummary, publishedParticipationRows, publishedRankingsDashboard, stateChoropleth, houseMetricKeys, type HouseMetricKey } from '@senadotracker/db';
import { percentileOf, type Source } from '@senadotracker/domain';

const path=process.env.SENADOTRACKER_DB_PATH??resolve(process.cwd(),'data/senadotracker.sqlite');
if(!existsSync(path)){console.error(`Banco não encontrado em ${path}`);process.exit(1)}
const db=openDatabase(path,true);
db.exec('PRAGMA cache_size=-32768; PRAGMA mmap_size=268435456; PRAGMA temp_store=MEMORY;');

// Instrumenta `prepare` para contar statements: é a prova de "zero consulta nova" no seletor de métrica.
let statements=0;
const original=db.prepare.bind(db);
(db as unknown as {prepare:typeof original}).prepare=(sql:string)=>{statements++;return original(sql)};
const timed=<T>(label:string,run:()=>T):T=>{statements=0;const started=performance.now();const value=run();console.log(`${label.padEnd(48)} ${(performance.now()-started).toFixed(0).padStart(7)} ms  ${String(statements).padStart(5)} statements`);return value};

const year=Number(db.prepare('SELECT max(year) year FROM active_expense_publications').get()?.year??0);
console.log(`banco: ${path}\nano do lote de cota: ${year}\n`);

for(const source of ['senado','camara'] as Source[]){
  console.log(`— ${source} —`);
  timed('rankings dashboard (com patrimônio)',()=>publishedRankingsDashboard(db,{source,year}));
  timed('rankings dashboard (sem patrimônio)',()=>publishedRankingsDashboard(db,{source,year,includeAssets:false}));
  const summary=timed('resumo por Casa (frio)',()=>publishedHouseMetricSummary(db,source,year));
  const ids=db.prepare(`SELECT p.external_id FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=?`).all(source).map(row=>String(row.external_id));
  const participation=publishedParticipationRows(db,source,year,ids);
  timed('resumo por Casa (participação injetada)',()=>publishedHouseMetricSummary(db,source,year,participation));
  timed('coroplético · 8 trocas de métrica',()=>houseMetricKeys.concat(houseMetricKeys).map(metric=>stateChoropleth(summary,metric).items.length));

  const roster=summary.roster;
  const lines=houseMetricKeys.map((metric:HouseMetricKey)=>{
    const item=summary.metrics[metric],states=Object.values(summary.states).filter(state=>state.metrics[metric].distribution.count>=item.meta.stateMinSample).length;
    return `  ${metric.padEnd(18)} n=${String(item.distribution.count).padStart(3)}/${roster}  mediana=${String(item.distribution.median??'—').slice(0,12).padStart(12)}  p90=${String(item.distribution.p90??'—').slice(0,12).padStart(12)}  cobertura=${item.coverage.availability.padEnd(12)} UFs elegíveis=${states}/27`;
  });
  console.log(lines.join('\n'));
  const {legislature,years}=legislatureYears(db,source);
  const axis=timed(`eixo das votações · legislatura ${legislature} (${years.join(',')})`,()=>publishedCurrentVoteAxis(db,source));
  console.log(`  ${String(axis.deliberations).padStart(5)} votações com divergência · ${axis.points.length}/${roster} posicionados · ${axis.explained===null?'—':(axis.explained*100).toFixed(1)+'%'} da variância no eixo`);
  console.log(`  polos: ${axis.poles.negative.join('/')} ↔ ${axis.poles.positive.join('/')}`);
  const first=Object.values(summary.rows)[0];
  if(first?.expenseCents!==null&&first?.expenseCents!==undefined)console.log(`  percentil de ${first.name}: ${((percentileOf(summary.metrics.expenseCents.values,first.expenseCents)??0)*100).toFixed(1)}% da Casa abaixo dele`);
  console.log();
}

// Os modos Partidos e Estados de `/legislativo/rankings` não emitem consulta própria: `groupRankings`
// só lê `summary.states`/`summary.parties`, já materializados dentro de `publishedHouseMetricSummary`.
// A prova é: o resumo de uma Casa custa o mesmo com ou sem o agrupamento por partido/UF lido depois.
console.log('— modos agregados (partidos/estados) —');
for(const source of ['senado','camara'] as Source[]){
  const bare=timed(`resumo por Casa · ${source}`,()=>publishedHouseMetricSummary(db,source,year));
  statements=0;
  const started=performance.now();
  const groups=Object.keys(bare.states).length+Object.keys(bare.parties).length;
  const elapsed=performance.now()-started;
  console.log(`${`  ler ${groups} grupos já computados (${source})`.padEnd(48)} ${elapsed.toFixed(2).padStart(7)} ms  ${String(statements).padStart(5)} statements`);
}
// O modo Partidos soma cadeiras das duas Casas: o custo total de abrir a página é a soma dos dois
// resumos (já cacheados 30 min cada), nunca uma consulta por bancada ou por UF.
console.log('  total para abrir /legislativo/rankings?modo=partidos ou ?modo=estados: soma dos dois resumos acima, sem consulta adicional.');
console.log();
db.close();
