export interface StatePaint{fill:string;ink?:string;href?:string;title:string;ariaLabel?:string}
export interface PaintOptions{variant:string;description:string;emptyFill:string;emptyInk?:string;href?:(uf:string)=>string}

export const markupUfs=(markup:string)=>[...markup.matchAll(/data-uf="([A-Z]{2})"/g)].map(match=>match[1]!);
const escape=(value:string)=>value.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/** Pinta o mapa por unidade federativa emitindo regras CSS, não `style` por elemento.
    Três armadilhas resolvidas de propósito:
    - `.estado .circle{fill:…}` tem especificidade maior que `[data-uf] path`, então cada regra precisa
      alcançar `path` e `.circle` juntos — senão os 7 estados com disco de chamada mentem visualmente.
    - `.estado text{fill:#173d32}` vence o `fill="#FFFFFF"` inline dos rótulos, então a tinta do texto
      vem por regra própria mais um halo, e a sigla sobrevive em qualquer tom da rampa.
    - o hover da folha base repinta o `fill`; aqui ele só altera brilho, para o tom escolhido não sumir. */
export function paintStateMap(markup:string,paints:ReadonlyMap<string,StatePaint>,options:PaintOptions):string{
  const {variant,description,emptyFill,emptyInk,href}=options;
  const rules=[
    `.${variant} .estado path,.${variant} .estado .circle{fill:${emptyFill}}`,
    `.${variant} .estado text{paint-order:stroke fill;stroke:rgba(255,255,255,.55);stroke-width:2.4;stroke-linejoin:round}`,
    ...(emptyInk?[`.${variant} .estado text{fill:${emptyInk}}`]:[]),
    `.${variant} .estado:hover path,.${variant} .estado:focus path{filter:brightness(.88)}`,
  ];
  for(const [uf,paint] of paints){
    rules.push(`.${variant} .estado[data-uf="${uf}"] path,.${variant} .estado[data-uf="${uf}"] .circle{fill:${paint.fill}}`);
    if(paint.ink)rules.push(`.${variant} .estado[data-uf="${uf}"] text{fill:${paint.ink};stroke:none}`);
  }
  let painted=markup
    .replace('class="brazil-map"',`class="brazil-map ${variant}"`)
    .replace('</style>',`${rules.join('')}</style>`)
    .replace('Selecione um estado para consultar seus representantes no Congresso Nacional.',escape(description));
  for(const uf of markupUfs(markup)){
    const paint=paints.get(uf),target=paint?.href??href?.(uf);
    const open=new RegExp(`<a [^>]*data-uf="${uf}"[^>]*>`);
    painted=painted.replace(open,tag=>{
      let next=target===undefined?tag:tag.replace(/href="[^"]*"/,`href="${escape(target)}"`);
      if(paint?.ariaLabel)next=next.replace(/aria-label="([^"]+)"/,(_match,label:string)=>`aria-label="${label}: ${escape(paint.ariaLabel!)}"`);
      // `<title>` como primeiro filho do <a> é o tooltip nativo do SVG, sem depender de JavaScript.
      return paint?`${next}<title>${escape(paint.title)}</title>`:next;
    });
  }
  return painted;
}
