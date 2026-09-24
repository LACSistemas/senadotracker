/** Rampa sequencial única do produto: magnitude, não desvio. Desvio contra um referencial usa
    `eval-color`. Os tons são fixos, nunca ancorados no máximo — um outlier não achata os demais. */
export const sequentialRamp=['var(--map-1)','var(--map-2)','var(--map-3)','var(--map-4)','var(--map-5)'] as const;
export const emptyFill='var(--map-empty)';
/** Índice a partir do qual o tom é escuro o bastante para exigir rótulo claro. */
export const darkFrom=3;
/** Reprojeta um balde numa rampa cheia: com poucos valores distintos a escala encurta sem repetir tom. */
export const rampIndex=(bucket:number,total:number)=>total<=1?sequentialRamp.length-1:Math.round(bucket*(sequentialRamp.length-1)/(total-1));
export const rampTone=(bucket:number,total:number)=>sequentialRamp[rampIndex(bucket,total)]!;
/** Faixa de um valor em cortes fixos crescentes. Para escalas com significado absoluto (um percentual
    de concordância vale o que diz), onde quantis sobre poucos valores inventariam contraste. */
export const bandOf=(value:number,edges:readonly number[])=>{let band=0;for(const edge of edges)if(value>=edge)band++;return Math.min(band,edges.length)};
