'use client';
import Link from 'next/link';
import {useMemo,useState} from 'react';
type Point=Record<string,unknown>;
const money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',notation:'compact',maximumFractionDigits:1});
const fullMoney=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
const percent=new Intl.NumberFormat('pt-BR',{style:'percent',maximumFractionDigits:1});
const integer=new Intl.NumberFormat('pt-BR');
const median=(values:number[])=>{if(!values.length)return 0;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]!:(sorted[mid-1]!+sorted[mid]!)/2};
const dependencyColor=(share:number|null)=>share===null?'var(--map-empty)':share>.8?'var(--map-5)':share>.6?'var(--map-4)':share>.4?'var(--map-3)':share>.2?'var(--map-2)':'var(--map-1)';

const MARGIN={left:60,right:20,top:20,bottom:38},WIDTH=760,HEIGHT=440,PLOT_W=WIDTH-MARGIN.left-MARGIN.right,PLOT_H=HEIGHT-MARGIN.top-MARGIN.bottom;

export function SupplierMarketScatter({points}:{points:Point[]}){
  const [mode,setMode]=useState<'size'|'dependency'>('size');
  const [scale,setScale]=useState<'linear'|'log'>('linear');
  const [active,setActive]=useState<Point|null>(null);
  const finite=useMemo(()=>points.filter(p=>Number(p.net)>0&&Number(p.parliamentarians)>0),[points]);
  const isSize=mode==='size';
  const yValue=(p:Point)=>isSize?Number(p.net):Number(p.dependency_share??0);
  const maxX=Math.max(...finite.map(p=>Number(p.parliamentarians)),1);
  const maxY=isSize?Math.max(...finite.map(p=>yValue(p)),1)*1.08:1;
  const medianX=median(finite.map(p=>Number(p.parliamentarians)));
  const medianY=median(finite.map(yValue));
  const useLog=isSize&&scale==='log';
  const minPositiveY=Math.max(1,Math.min(...finite.map(p=>yValue(p)).filter(v=>v>0),maxY));
  const logMin=Math.log10(minPositiveY),logMax=Math.log10(maxY)||1;
  const x=(value:number)=>MARGIN.left+(value/maxX)*PLOT_W;
  const y=(value:number)=>{if(useLog){const t=(Math.log10(Math.max(value,minPositiveY))-logMin)/((logMax-logMin)||1);return MARGIN.top+(1-Math.max(0,Math.min(1,t)))*PLOT_H}const t=value/maxY;return MARGIN.top+(1-Math.max(0,Math.min(1,t)))*PLOT_H};
  const yTicks=useLog?[minPositiveY,Math.sqrt(minPositiveY*maxY),maxY]:[0,maxY/2,maxY];
  const xTicks=[0,Math.round(maxX/2),maxX];
  const formatY=(value:number)=>isSize?money.format(value):percent.format(value);
  const quadrantLabels=isSize
    ?{tl:'Poucos parlamentares · alto valor',tr:'Muitos parlamentares · alto valor',bl:'Poucos parlamentares · baixo valor',br:'Muitos parlamentares · baixo valor'}
    :{tl:'Poucos parlamentares · alta dependência',tr:'Muitos parlamentares · alta dependência',bl:'Poucos parlamentares · baixa dependência',br:'Muitos parlamentares · baixa dependência'};

  return <section className="card-elevated rounded-3xl border bg-card p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-2xl font-black">{isSize?'Tamanho do mercado':'Alcance e dependência'}</h2><p className="mt-1 text-sm text-muted-foreground">{isSize?'Cada ponto é um fornecedor: valor líquido no eixo vertical, parlamentares distintos no eixo horizontal. Cor indica dependência do maior cliente.':'Cada ponto mostra o alcance e a participação do maior cliente entre os fornecedores observados.'}</p></div><div className="flex flex-wrap items-center gap-2"><div className="flex rounded-full border p-1 text-xs font-bold" role="group" aria-label="Modo do gráfico"><button type="button" onClick={()=>setMode('size')} aria-pressed={mode==='size'} className={`focus-ring rounded-full px-3 py-1 ${mode==='size'?'bg-primary text-primary-foreground':''}`}>Tamanho</button><button type="button" onClick={()=>setMode('dependency')} aria-pressed={mode==='dependency'} className={`focus-ring rounded-full px-3 py-1 ${mode==='dependency'?'bg-primary text-primary-foreground':''}`}>Dependência</button></div>{isSize&&<div className="flex rounded-full border p-1 text-xs font-bold" role="group" aria-label="Escala do eixo vertical"><button type="button" onClick={()=>setScale('linear')} aria-pressed={scale==='linear'} className={`focus-ring rounded-full px-3 py-1 ${scale==='linear'?'bg-secondary text-secondary-foreground':''}`}>Linear</button><button type="button" onClick={()=>setScale('log')} aria-pressed={scale==='log'} className={`focus-ring rounded-full px-3 py-1 ${scale==='log'?'bg-secondary text-secondary-foreground':''}`}>Log</button></div>}</div></div>

  <div className="relative mt-6 overflow-x-auto"><div className="relative min-w-[620px]">
    <div className="pointer-events-none absolute right-2 top-2 z-10 w-56 rounded-xl border bg-card/95 p-3 text-xs shadow-sm backdrop-blur">{active?<><strong className="block truncate text-sm">{String(active.name??'Fornecedor')}</strong><dl className="mt-1.5 space-y-0.5 text-muted-foreground"><div className="flex justify-between gap-2"><dt>Valor líquido</dt><dd className="font-semibold text-foreground">{fullMoney.format(Number(active.net)/100)}</dd></div><div className="flex justify-between gap-2"><dt>Parlamentares</dt><dd className="font-semibold text-foreground">{integer.format(Number(active.parliamentarians))}</dd></div><div className="flex justify-between gap-2"><dt>Dependência</dt><dd className="font-semibold text-foreground">{active.dependency_share==null?'—':percent.format(Number(active.dependency_share))}</dd></div></dl></>:<p className="text-muted-foreground">Passe o mouse ou navegue com Tab sobre um ponto para ver os detalhes.</p>}</div>

    <svg role="img" aria-label={`Gráfico de dispersão: ${isSize?'valor líquido':'dependência do maior cliente'} por parlamentares distintos`} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full">
      <g stroke="var(--border)" strokeWidth="1">{yTicks.map((tick,index)=><line key={index} x1={MARGIN.left} x2={WIDTH-MARGIN.right} y1={y(tick)} y2={y(tick)}/>)}</g>
      <line x1={x(medianX)} x2={x(medianX)} y1={MARGIN.top} y2={HEIGHT-MARGIN.bottom} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity=".5"/>
      <line x1={MARGIN.left} x2={WIDTH-MARGIN.right} y1={y(medianY)} y2={y(medianY)} stroke="var(--muted-foreground)" strokeDasharray="4 4" strokeOpacity=".5"/>
      <g fill="var(--muted-foreground)" fontSize="10" fontWeight="700" opacity=".75">
        <text x={MARGIN.left+6} y={MARGIN.top+12} textAnchor="start">{quadrantLabels.tl}</text>
        <text x={WIDTH-MARGIN.right-6} y={MARGIN.top+12} textAnchor="end">{quadrantLabels.tr}</text>
        <text x={MARGIN.left+6} y={HEIGHT-MARGIN.bottom-6} textAnchor="start">{quadrantLabels.bl}</text>
        <text x={WIDTH-MARGIN.right-6} y={HEIGHT-MARGIN.bottom-6} textAnchor="end">{quadrantLabels.br}</text>
      </g>
      <g fill="var(--muted-foreground)" fontSize="11">{yTicks.map((tick,index)=><text key={index} x={MARGIN.left-8} y={y(tick)+4} textAnchor="end">{formatY(tick)}</text>)}{xTicks.map((tick,index)=><text key={index} x={x(tick)} y={HEIGHT-MARGIN.bottom+18} textAnchor="middle">{integer.format(tick)}</text>)}</g>
      <text x={(MARGIN.left+WIDTH-MARGIN.right)/2} y={HEIGHT-6} textAnchor="middle" fill="var(--muted-foreground)" fontSize="11">Parlamentares distintos</text>
      <line x1={MARGIN.left} x2={MARGIN.left} y1={MARGIN.top} y2={HEIGHT-MARGIN.bottom} stroke="var(--border)"/>
      <line x1={MARGIN.left} x2={WIDTH-MARGIN.right} y1={HEIGHT-MARGIN.bottom} y2={HEIGHT-MARGIN.bottom} stroke="var(--border)"/>
      {finite.map(p=>{const cx=x(Number(p.parliamentarians)),cy=y(yValue(p)),radius=6+Math.min(13,Math.sqrt(Number(p.records)||1)),share=p.dependency_share==null?null:Number(p.dependency_share),label=`${String(p.name??'Fornecedor')}: ${isSize?fullMoney.format(Number(p.net)/100):percent.format(Number(p.dependency_share??0))}, ${integer.format(Number(p.parliamentarians))} parlamentares${share===null?'':`, dependência ${percent.format(share)}`}`;return <Link key={String(p.supplier_id)} href={`/legislativo/fornecedores/${String(p.supplier_id)}`} title={label} aria-label={label} onMouseEnter={()=>setActive(p)} onFocus={()=>setActive(p)} onMouseLeave={()=>setActive(null)} onBlur={()=>setActive(null)}><circle cx={cx} cy={cy} r={radius} fill={dependencyColor(share)} fillOpacity=".78" stroke="var(--card)" strokeWidth="1.5" className="transition hover:fill-opacity-100 focus-visible:fill-opacity-100"/></Link>})}
    </svg>
  </div></div>

  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-muted-foreground"><span className="font-semibold">Dependência do maior cliente:</span>{[['Baixa','var(--map-1)'],['','var(--map-2)'],['Média','var(--map-3)'],['','var(--map-4)'],['Alta','var(--map-5)']].map(([label,color],index)=><span key={index} className="flex items-center gap-1.5"><i className="size-2.5 rounded-full" style={{background:color}}/>{label}</span>)}<span>· Tamanho da bolha: nº de lançamentos</span></div>

  <details className="mt-5"><summary className="focus-ring w-fit cursor-pointer text-sm font-bold text-primary">Abrir tabela dos pontos</summary><div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Tabela alternativa do gráfico de fornecedores</caption><thead><tr className="border-b"><th className="px-2 py-2">Fornecedor</th><th className="px-2 py-2 text-right">Valor</th><th className="px-2 py-2 text-right">Participação maior cliente</th><th className="px-2 py-2 text-right">Parlamentares</th></tr></thead><tbody>{finite.slice(0,100).map(p=><tr className="border-b" key={`row-${String(p.supplier_id)}`}><td className="px-2 py-2"><Link className="text-primary underline" href={`/legislativo/fornecedores/${String(p.supplier_id)}`}>{String(p.name??'Fornecedor sem nome')}</Link></td><td className="px-2 py-2 text-right">{fullMoney.format(Number(p.net)/100)}</td><td className="px-2 py-2 text-right">{p.dependency_share==null?'—':percent.format(Number(p.dependency_share))}</td><td className="px-2 py-2 text-right">{integer.format(Number(p.parliamentarians))}</td></tr>)}</tbody></table></div></details>
  </section>;
}
