import { houseMetrics } from '@senadotracker/db';
import type { Source } from '@senadotracker/domain';
import { CellBar } from '@/components/cell-bar';
import { HighlightCard } from '@/components/highlight-card';
import { CoverageBadge } from '@/components/metrics';
import { StickyTable, type StickyColumn } from '@/components/sticky-table';
import { TogglePills } from '@/components/toggle-pills';
import { groupColumnKeys, type GroupMetricKey, type GroupRankings, type GroupRow } from '@/lib/group-rankings';
import { evalTone } from '@/lib/eval-color';
import { brl, count, metricValue, percent } from '@/lib/format';

const houseLabel=(source:Source)=>source==='senado'?'Senado':'Câmara';
const scopeLabel=(source:Source)=>source==='senado'?'senadores':'deputados';
const show=(value:number|null,key:GroupMetricKey)=>metricValue(value,houseMetrics[key].unit);

/** Tabela, pódio e destaques de bancada e de unidade federativa. Tudo vem pronto de `groupRankings`:
    o componente não escolhe piso de amostra nem ordem, senão a tela e o CSV divergiriam. */
export function RankingsGroups({data,groupHref,houseHref}:{data:GroupRankings;groupHref:(row:GroupRow)=>string;houseHref:(source:Source)=>string}){
  const {mode,house,rows,scale}=data,isParty=mode==='partidos';
  const subjectOne=isParty?'bancada':'unidade federativa',subjectMany=isParty?'bancadas':'unidades federativas';
  const origin=`${houseLabel(house)}${isParty?'':' · bancada local'}`;
  // Cada célula é comparada contra a distribuição ENTRE grupos, não entre pessoas da Casa: a mediana de
  // uma bancada medida pela régua individual diria outra coisa.
  const cell=(row:GroupRow,key:GroupMetricKey)=>{
    const value=row.values[key],distribution=scale[key],meta=houseMetrics[key];
    if(value===null)return{value,tone:'unknown' as const,max:0};
    return{value,max:distribution.max??0,tone:evalTone(value,{median:distribution.median,p10:distribution.p10,p90:distribution.p90,
      direction:meta.direction,availability:'available',sampleSize:distribution.count,minSample:3})};
  };
  const metricColumn=(key:GroupMetricKey):StickyColumn<GroupRow>=>({key,label:`${houseMetrics[key].label} · mediana`,
    title:row=>row.samples[key]?`Mediana entre ${row.samples[key]} ${scopeLabel(house)} do grupo`:`Sem ${scopeLabel(house)} observados neste grupo`,
    render:row=>{const {value,max,tone}=cell(row,key);return <CellBar value={value} max={max} tone={tone}>{show(value,key)}</CellBar>}});
  const columns:StickyColumn<GroupRow>[]=[
    {key:'rank',label:'#',sticky:0,render:(_row,index)=><span className="text-slate-500">{index+1}</span>},
    {key:'label',label:isParty?'Partido':'UF',sticky:1,render:row=><a className="font-semibold text-slate-900 underline hover:text-emerald-800" href={groupHref(row)}>{row.label}</a>},
    {key:'seats',label:'Cadeiras',sticky:2,render:row=><strong className="tabular-nums">{count(row.seats)}</strong>},
    {key:'senators',label:'Senadores',render:row=><span className="tabular-nums">{count(row.senators)}</span>},
    {key:'deputies',label:'Deputados',render:row=><span className="tabular-nums">{count(row.deputies)}</span>},
    ...(isParty?[]:[{key:'parties',label:'Partidos na bancada',render:(row:GroupRow)=><span className="tabular-nums">{count(row.parties)}</span>} satisfies StickyColumn<GroupRow>,
      {key:'concentration',label:'Concentração (HHI)',title:()=>'Soma dos quadrados das frações de cada partido: 100% é bancada de um partido só.',
        render:(row:GroupRow)=><span className="tabular-nums">{percent(row.concentration,0)}</span>} satisfies StickyColumn<GroupRow>]),
    ...groupColumnKeys.map(metricColumn),
  ];

  // Pódio: as três primeiras linhas da MESMA ordenação da tabela, para posição e ordem nunca discordarem.
  const podiumKey:GroupMetricKey='proposals';
  const podium=rows.filter(row=>isParty?row.seats>0:row.values[podiumKey]!==null).slice(0,3);
  const podiumLabel=isParty?'Maior bancada do Congresso':'Proposições por parlamentar';
  const podiumNote=isParty
    ?'Cadeiras somadas nas duas Casas, pelo partido do cadastro ativo. Contagem, não comparação de métrica.'
    :`${houseMetrics[podiumKey].note} Mediana entre ${scopeLabel(house)} da UF.`;
  const best=(key:GroupMetricKey,direction:'max'|'min')=>{
    const eligible=rows.flatMap(row=>row.values[key]===null?[]:[{row,value:row.values[key]!}]);
    return eligible.sort((a,b)=>(direction==='max'?b.value-a.value:a.value-b.value)||a.row.label.localeCompare(b.row.label,'pt-BR'))[0]??null;
  };
  const costliest=best('monthlyCostCents','max'),absentee=best('presence','min'),productive=best('proposals','max');
  const concentrated=isParty?null:rows.flatMap(row=>row.concentration===null||!row.observed?[]:[row])
    .sort((a,b)=>b.concentration!-a.concentration!||a.label.localeCompare(b.label,'pt-BR'))[0]??null;
  const ties=concentrated?rows.filter(row=>row.concentration===concentrated.concentration).length-1:0;
  const card=(row:GroupRow|null)=>row?{label:row.label,href:groupHref(row),origin}:null;

  return <>
    <div className="mt-6 space-y-5">
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Pódio · {podiumLabel.toLocaleLowerCase('pt-BR')}</p>
        <div className="mt-3 grid gap-3 lg:grid-cols-3 lg:items-start">{podium.map((row,index)=>
          <HighlightCard key={row.key} rank={index+1} size={index===0?'large':'small'} label={podiumLabel}
            value={isParty?`${count(row.seats)} cadeiras`:show(row.values[podiumKey],podiumKey)} person={null}
            subject={{label:row.label,href:groupHref(row),origin:isParty?'Senado e Câmara':origin}}
            sample={isParty?row.seats:row.samples[podiumKey]} note={podiumNote}/>)}</div>
        {!podium.length&&<p className="mt-3 text-sm text-slate-500">Nenhum grupo reúne observações suficientes para um pódio nesta Casa.</p>}
      </div>
      <div>
        <p className="text-sm font-semibold text-muted-foreground">Extremos observados</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {isParty?<>
            <HighlightCard label="Mais proposições por parlamentar" value={productive?show(productive.value,'proposals'):'—'}
              person={null} subject={card(productive?.row??null)} sample={productive?productive.row.samples.proposals:0}
              note={`${houseMetrics.proposals.note} Mediana entre os ${scopeLabel(house)} da bancada, não soma de autorias.`}/>
            {/* Presidência de comissão fica sem número de propósito: os lotes de nomeação publicam a
                presidência de qualquer colegiado, e no Senado o volume é dominado por grupos parlamentares
                de amizade e na Câmara por subcomissões. Sem campo de tipo de órgão, publicar a contagem
                como "presidência de comissão" inflaria a comparação entre Casas. */}
            <HighlightCard label="Mais presidências de comissão" value="Não publicado" person={null} sample={0}
              note="Os lotes de nomeação não distinguem comissão permanente de subcomissão ou grupo parlamentar, então a contagem não é comparável entre as Casas. Fica de fora até o coletor separar o tipo de colegiado."/>
          </>:<>
            <HighlightCard label="Bancada mais homogênea" value={concentrated?percent(concentrated.concentration,0):'—'}
              person={null} subject={card(concentrated)} sample={concentrated?.observed??0}
              note={concentrated?`${count(concentrated.parties)} ${concentrated.parties===1?'partido':'partidos'} entre ${count(concentrated.observed)} ${scopeLabel(house)}${ties?`; empata com ${ties} UF${ties>1?'s':''}`:''}. Índice de concentração (HHI): 100% é bancada de um partido só.`:'Nenhuma UF com bancada observável nesta Casa.'}/>
            <HighlightCard label="Parlamentar mais caro por mês" value={costliest?brl(costliest.value):'—'}
              person={null} subject={card(costliest?.row??null)} sample={costliest?costliest.row.samples.monthlyCostCents:0}
              note={`${houseMetrics.monthlyCostCents.note} Mediana entre ${scopeLabel(house)} da UF, não gasto somado da bancada.`}/>
            <HighlightCard label="Menor presença em Plenário" value={absentee?percent(absentee.value):'—'}
              person={null} subject={card(absentee?.row??null)} sample={absentee?absentee.row.samples.presence:0}
              note={absentee?houseMetrics.presence.note:'A Casa selecionada não publica presença comparável neste recorte.'}/>
          </>}
        </div>
      </div>
    </div>
    <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h2 className="text-2xl font-bold text-slate-900">Todas as {subjectMany}</h2>
        <p className="mt-1 text-sm text-slate-600">Medianas entre {scopeLabel(house)} de cada {subjectOne}, com o universo de cada célula no rótulo. Cadeiras somam as duas Casas; nenhuma outra coluna soma.</p>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <TogglePills label="Casa" current={house} pills={(['senado','camara'] as Source[]).map(source=>({value:source,label:houseLabel(source),href:houseHref(source)}))}/>
        <CoverageBadge coverage={data.coverage}/>
      </div>
    </div>
    <StickyTable caption={`Indicadores por ${subjectOne} em ${data.year}`} columns={columns} rows={rows} rowKey={row=>row.key}
      widths={[48,120,96]} minWidth={isParty?900:1080}/>
    <p className="mt-4 text-xs leading-5 text-slate-500">
      {count(rows.length)} {subjectMany} · {count(data.roster)} {scopeLabel(house)} no cadastro ativo. A mediana desaparece quando o grupo tem menos observações que o piso da métrica.
      {isParty&&' A bancada é a do cadastro ativo, não a filiação vigente em cada mês, então os totais não coincidem com a página de partidos.'}
    </p>
  </>;
}
