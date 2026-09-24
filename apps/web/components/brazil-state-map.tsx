import { paintStateMap, type StatePaint } from '@/components/state-map-paint';
import { mapMarkup } from '@/components/brazil-map-markup';

export function BrazilStateMap(){return <figure className="mx-auto min-w-0 max-w-3xl rounded-3xl border bg-card p-4 shadow-sm sm:p-8"><div className="mx-auto max-w-[680px]" dangerouslySetInnerHTML={{__html:mapMarkup}}/><figcaption className="mt-5 text-center text-sm text-muted-foreground">Selecione uma UF no mapa. Geometria do <a className="font-semibold text-primary underline" href="https://github.com/LucasBassetti/mapa-brasil-svg">Mapa do Brasil SVG</a>, com códigos territoriais do IBGE · <a className="underline" href="/licenses/mapa-brasil-svg.txt">licença MIT</a>.</figcaption></figure>}

export function BrazilValueMap({values}:{values:{label:string;valueCents:number}[]}){
  // Escala linear ancorada no máximo, preservada como estava: quem lê o radar de fornecedor já a conhece.
  const maximum=Math.max(...values.map(item=>item.valueCents),0),money=new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'});
  const paints=new Map(values.map(item=>{const intensity=maximum?item.valueCents/maximum:0,lightness=Math.round(88-intensity*55),formatted=money.format(item.valueCents/100);
    return [item.label,{fill:`hsl(159 54% ${lightness}%)`,...(lightness<=52?{ink:'#fff'}:{}),href:'#parlamentares',title:formatted,ariaLabel:formatted} satisfies StatePaint]}));
  const markup=paintStateMap(mapMarkup,paints,{variant:'supplier-map',description:'Quanto mais escura a unidade federativa, maior o valor líquido identificado para este fornecedor.',emptyFill:'#edf2ee',href:()=>'#parlamentares'});
  return <figure className="min-w-0 rounded-3xl border bg-card p-4 shadow-sm sm:p-6"><div className="mx-auto max-w-[560px]" dangerouslySetInnerHTML={{__html:markup}}/><figcaption className="mt-4 text-center text-sm text-muted-foreground">Valor líquido por UF. Estados sem pagamento identificado permanecem claros. Geometria licenciada em <a className="underline" href="/licenses/mapa-brasil-svg.txt">MIT</a>.</figcaption></figure>;
}
