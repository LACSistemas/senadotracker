import Link from 'next/link';
import {Landmark,TrendingUp} from 'lucide-react';
import type {DataCoverage} from '@senadotracker/domain';
import {patrimonyRanking} from '@/lib/data';
import {LegislativeSubnav} from '@/components/legislative-subnav';
import {InstitutionHero} from '@/components/heroes';
import {DataTable,type DataColumn} from '@/components/data-table';
import {DumbbellCell,DumbbellLegend} from '@/components/dumbbell';
import {EmptyState} from '@/components/empty-state';
import {CoverageBadge,KpiCard,KpiGrid} from '@/components/metrics';
import {PartyLogo} from '@/components/party-logo';
import {TogglePills} from '@/components/toggle-pills';

export const dynamic='force-dynamic';
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}),percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1,signDisplay:'always'});
type Params=Record<string,string|string[]|undefined>;const scalar=(value:string|string[]|undefined)=>typeof value==='string'?value:undefined;
const href=(corrected:boolean,page?:number)=>{const params=new URLSearchParams();if(corrected)params.set('correcao','ipca');if(page&&page>1)params.set('pagina',String(page));const query=params.toString();return`/legislativo/patrimonio${query?`?${query}`:''}`};

export default async function PatrimonyPage({searchParams}:{searchParams:Promise<Params>}){
  const params=await searchParams,rawPage=Number(scalar(params.pagina)??1),page=Number.isSafeInteger(rawPage)&&rawPage>0?rawPage:1,pageSize=25;
  const wanted=scalar(params.correcao)==='ipca';
  const result=patrimonyRanking(wanted);
  if(result.status==='unavailable')return <><LegislativeSubnav/><main className="page-shell py-12"><EmptyState title="Ranking patrimonial indisponível" description={result.message}/></main></>;
  const data=result.data,deflator=data.deflator,available=data.deflatorAvailable;
  type Item=(typeof data.items)[number];
  const fromLabel=deflator?`${data.fromYear} corrigido`:String(data.fromYear),toLabel=String(data.toYear);
  const baseCents=(item:Item)=>deflator?item.fromCorrectedCents!:item.fromCents;
  const rateOf=(item:Item)=>deflator?item.changeRealRate:item.changeRate;
  const deltaOf=(item:Item)=>deflator?item.changeRealCents!:item.changeCents;
  const top=data.items[0],pageCount=Math.max(1,Math.ceil(data.items.length/pageSize)),visible=data.items.slice((page-1)*pageSize,page*pageSize);
  // Escala do dumbbell compartilhada pelas linhas visíveis: comprimentos só são comparáveis sob uma
  // régua só. Recalcular por linha faria todas parecerem do mesmo tamanho.
  const scaleMax=Math.max(...visible.flatMap(item=>[baseCents(item),item.toCents]),1);
  const columns:DataColumn<Item>[]=[
    {key:'rank',header:'Posição',align:'right',render:item=><strong>{item.rank}º</strong>},
    {key:'name',header:'Parlamentar',render:item=><div><Link prefetch={false} className="font-bold text-primary underline" href={`/parlamentares/${item.source}/${item.externalId}#eleicoes`}>{item.profile.name}</Link><small className="mt-1 flex items-center gap-1.5 text-muted-foreground"><PartyLogo party={item.profile.party} size={20}/>{item.profile.party}/{item.profile.uf}</small></div>},
    {key:'trajectory',header:`${fromLabel} → ${toLabel}`,render:item=><DumbbellCell fromCents={baseCents(item)} toCents={item.toCents} max={scaleMax} fromLabel={fromLabel} toLabel={toLabel}/>},
    {key:'change',header:deflator?'Variação real':'Variação nominal',align:'right',render:item=>{const rate=rateOf(item);return <div><strong>{rate===null?'—':percent.format(rate)}</strong><small className="block text-muted-foreground">{money.format(deltaOf(item)/100)}</small></div>}},
  ];
  const pills=[
    {value:'nominal',label:'Valores nominais',href:href(false,page)},
    available
      ? {value:'ipca',label:`Corrigido pelo IPCA (R$ de ${available.toMonth})`,href:href(true,page)}
      : {value:'ipca',label:'Corrigido pelo IPCA',href:href(true,page),disabled:true,reason:'O número-índice do IBGE para um dos meses de referência não está publicado no lote ativo. Séries não são completadas com o valor corrente.'},
  ];
  return <><LegislativeSubnav/><main id="conteudo" tabIndex={-1}>
    <div className="page-shell py-8"><InstitutionHero context="Declarações eleitorais do TSE" title={`Variação patrimonial declarada · ${data.fromYear}→${data.toYear}`} description="Compare os totais declarados por parlamentares com candidaturas seguramente vinculadas nos dois pleitos." imageUrl="/congresso.svg" location="Brasil"/></div>
    <section className="border-y bg-card"><div className="page-shell py-10">
      <KpiGrid className="xl:grid-cols-2">
        <KpiCard label="Parlamentares comparáveis" value={data.items.length} coverage={data.coverage} comparison={`${data.declared} pessoas com declaração vinculada`} icon={Landmark}/>
        <KpiCard label={deflator?'Maior variação real':'Maior variação percentual'} value={!top||rateOf(top)===null?'—':percent.format(rateOf(top)!)} coverage={data.coverage} comparison={top?.profile.name??null} icon={TrendingUp}/>
      </KpiGrid>
      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div><h2 className="text-2xl font-bold">Ranking de variação</h2><p className="mt-1 text-sm text-muted-foreground">A posição considera somente quem possui valores declarados vinculados em {data.fromYear} e {data.toYear}.</p></div>
        <TogglePills label="Unidade de comparação" pills={pills} current={deflator?'ipca':'nominal'}/>
      </div>
      {data.items.length?<>
        <div className="mt-5"><DumbbellLegend fromLabel={fromLabel} toLabel={toLabel}/></div>
        <div className="mt-3"><DataTable caption="Variação patrimonial declarada" rows={visible} columns={columns} rowKey={item=>`${item.source}:${item.externalId}`} coverage={data.coverage as DataCoverage} page={page} pageCount={pageCount} pageHref={next=>href(Boolean(deflator),next)}/></div>
      </>:<div className="mt-5"><EmptyState title="Sem pares comparáveis" description={data.coverage.note}/></div>}
      <div className="mt-5 flex flex-wrap items-center justify-between gap-2"><CoverageBadge coverage={data.coverage as DataCoverage}/></div>
      <p className="mt-3 rounded-2xl border bg-secondary/40 p-5 text-sm leading-6"><strong>Como ler:</strong> {data.coverage.note}{' '}
        {deflator
          // O fato monótono: corrigir por fator constante não reordena, só muda o sinal. Dizer isso evita
          // que o leitor procure uma reordenação que não existe.
          ? <>Corrigir o valor antigo por um fator único <strong>não muda a ordem do ranking</strong> — muda o sinal: quem cresceu menos que a inflação do período aparece com perda real.</>
          : <>Reais de {data.fromYear} e de {data.toYear} não são a mesma unidade. {available?'Use a correção pelo IPCA acima para comparar poder de compra.':''}</>}
      </p>
    </div></section>
  </main></>;
}
