import Link from 'next/link';
import type { DataCoverage } from '@senadotracker/domain';
import { CoverageBadge } from '@/components/metrics';

export interface DistributionPoint { tribunalId: string; sigla: string; officialName: string; branchCode: string; branchName: string; value: number; uf?: string | null | undefined }
export type DistributionVis = 'pontos' | 'tabela';
export type DistributionScale = 'linear' | 'log';

const MARK = 14; // px — diâmetro do alvo clicável (maior que a marca pintada, pedido pela skill de dataviz)
const PLOT_HEIGHT = 240; // px
const Y_GUTTER = 44; // px — reservado à esquerda para os rótulos do eixo de valor

function median(sorted: number[]): number {
  const n = sorted.length; if (!n) return NaN;
  const mid = Math.floor(n / 2);
  return n % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

// Algoritmo clássico de "nice numbers" (Heckbert) — ticks redondos no eixo de valor, independente da
// unidade (%, R$, dias, contagem): nunca um eixo com "17,3%, 34,6%, 51,9%" só porque o domínio real
// começou num valor estranho.
function niceNum(range: number, round: boolean): number {
  if (range <= 0) return 1;
  const exp = Math.floor(Math.log10(range));
  const frac = range / 10 ** exp;
  let niceFrac: number;
  if (round) niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else niceFrac = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return niceFrac * 10 ** exp;
}
function niceTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const step = niceNum(niceNum(max - min, false) / (count - 1), true);
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = niceMin; v <= niceMax + step * 0.5; v += step) ticks.push(Number(v.toFixed(10)));
  return ticks;
}

// V1.1 (mandato §7.2) — escala logarítmica opcional, explicitamente rotulada: ticks em passos
// "1-2-5" por década (padrão de eixo log), nunca os mesmos "nice numbers" lineares — só disponível
// quando TODOS os valores são positivos (log de zero/negativo não existe; o chamador já garante
// isso antes de oferecer o toggle). Não esconde nem distorce valor nenhum: só a POSIÇÃO no eixo
// muda, os rótulos continuam o valor real via `formatValue`.
function logTicks(min: number, max: number): number[] {
  const lo = Math.max(min, Number.MIN_VALUE);
  const startExp = Math.floor(Math.log10(lo));
  const endExp = Math.ceil(Math.log10(max));
  const decades = endExp - startExp;
  // Mais de ~3 décadas com multiplicadores 1-2-5 fica denso demais num eixo de 240px — nesse caso
  // só os múltiplos de 1 (potências de 10 puras), ainda em passos redondos, nunca escondendo nada.
  const multipliers = decades > 3 ? [1] : [1, 2, 5];
  const ticks: number[] = [];
  for (let e = startExp; e <= endExp; e++) for (const m of multipliers) {
    const v = m * 10 ** e;
    if (v >= lo / 1.001 && v <= max * 1.001) ticks.push(v);
  }
  return ticks.length >= 2 ? ticks : [lo, max];
}

/** P14.45 — Explorador de Tribunais: distribuição real (cada tribunal = 1 ponto). Valor no eixo Y
 * (com grade e ticks "nice"), ordem/rank no eixo X — ao contrário da 1ª versão (empilhamento em
 * compartimentos sem eixo numérico), esta forma casa com o mock do usuário E simplifica o layout: com
 * X = posição no ranking, cada ponto já tem uma coluna só sua, então nunca há 2 pontos no mesmo lugar
 * (dispensa a lógica de bins/níveis da versão anterior). Forma "emphasis" (dataviz skill): pontos em
 * verde claro de desênfase, só o inspecionado ganha o hue de destaque — nunca uma cor por ramo aqui
 * (seria categórico demais pra até 91 instituições, e o ramo já aparece no texto/tabela). Sem SVG:
 * cada ponto é um `<Link>` HTML de verdade (foco/clique acessível de graça). */
export function DistributionChart({
  title, points, selectedTribunalId, mesaIds = [], formatValue, hrefForPoint, coverage, vis = 'pontos', hrefVis, scale = 'linear', hrefScale,
}: {
  title: string;
  points: DistributionPoint[];
  selectedTribunalId?: string | null | undefined;
  mesaIds?: string[] | undefined;
  formatValue: (v: number) => string;
  hrefForPoint: (tribunalId: string) => string;
  coverage: DataCoverage;
  vis?: DistributionVis | undefined;
  hrefVis?: ((v: DistributionVis) => string) | undefined;
  scale?: DistributionScale | undefined;
  hrefScale?: ((s: DistributionScale) => string) | undefined;
}) {
  const toggle = hrefVis && (
    <div className="inline-flex shrink-0 rounded-full border bg-background p-1 text-xs">
      <Link replace scroll={false} href={hrefVis('pontos')} aria-current={vis !== 'tabela' ? 'true' : undefined}
        className={vis !== 'tabela' ? 'rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground' : 'rounded-full px-3 py-1.5 font-bold text-muted-foreground hover:text-foreground'}>Distribuição</Link>
      <Link replace scroll={false} href={hrefVis('tabela')} aria-current={vis === 'tabela' ? 'true' : undefined}
        className={vis === 'tabela' ? 'rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground' : 'rounded-full px-3 py-1.5 font-bold text-muted-foreground hover:text-foreground'}>Tabela</Link>
    </div>
  );
  // V1.1 (mandato §7.2): toggle só aparece quando o chamador oferece `hrefScale` — isto é, quando
  // todos os valores do recorte são positivos (log de 0/negativo não existe). Nunca ativado por
  // padrão: é uma leitura alternativa explícita, não uma transformação silenciosa.
  const scaleToggle = hrefVis && hrefScale && vis !== 'tabela' && (
    <div className="inline-flex shrink-0 rounded-full border bg-background p-1 text-xs">
      <Link replace scroll={false} href={hrefScale('linear')} aria-current={scale !== 'log' ? 'true' : undefined}
        className={scale !== 'log' ? 'rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground' : 'rounded-full px-3 py-1.5 font-bold text-muted-foreground hover:text-foreground'}>Escala linear</Link>
      <Link replace scroll={false} href={hrefScale('log')} aria-current={scale === 'log' ? 'true' : undefined}
        className={scale === 'log' ? 'rounded-full bg-primary px-3 py-1.5 font-bold text-primary-foreground' : 'rounded-full px-3 py-1.5 font-bold text-muted-foreground hover:text-foreground'}>Escala logarítmica</Link>
    </div>
  );

  if (!points.length) {
    return <div className="grid min-h-48 min-w-0 place-items-center rounded-2xl border bg-card p-6 text-center"><div><p className="font-bold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{coverage.note}</p><div className="mt-3"><CoverageBadge coverage={coverage} /></div></div></div>;
  }
  const values = points.map(p => p.value);
  const min = Math.min(...values), max = Math.max(...values), med = median([...values].sort((a, b) => a - b));
  const useLog = scale === 'log' && min > 0;
  const ticks = useLog ? logTicks(min, max) : niceTicks(min, max, 5);
  const domainMin = ticks[0]!, domainMax = ticks[ticks.length - 1]!;
  const span = (domainMax - domainMin) || 1;
  const logSpan = (Math.log10(domainMax) - Math.log10(Math.max(domainMin, Number.MIN_VALUE))) || 1;
  const yPct = (v: number) => useLog
    ? Math.max(0, Math.min(100, ((Math.log10(Math.max(v, domainMin)) - Math.log10(domainMin)) / logSpan) * 100))
    : Math.max(0, Math.min(100, ((v - domainMin) / span) * 100));
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const n = sorted.length;
  // Achado real (ajuste visual): com os pontos ocupando a largura inteira (0-100%), o rótulo da
  // mediana (ancorado à direita) caía bem em cima dos próprios pontos nesse valor — mediana é,
  // por definição, onde os pontos tendem a se concentrar. Reservando uma faixa própria à direita
  // (sem nenhum ponto nela) o rótulo nunca mais colide, em qualquer distribuição.
  const xPct = (index: number) => n === 1 ? 50 : 3 + (index / (n - 1)) * 80;
  const selectedIndex = sorted.findIndex(p => p.tribunalId === selectedTribunalId);

  return (
    <div className="min-w-0 rounded-2xl border bg-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-bold">{title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <CoverageBadge coverage={coverage} />
          {scaleToggle}
          {toggle}
        </div>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{points.length} tribunais com dado elegível neste recorte · mín. {formatValue(min)} · mediana {formatValue(med)} · máx. {formatValue(max)}{useLog ? ' · eixo em escala logarítmica' : ''}</p>

      {vis === 'tabela' ? (
        <div tabIndex={0} role="region" aria-label={`Tabela de ${title}, com rolagem`} className="mt-5 max-h-96 overflow-y-auto overflow-x-auto focus-ring">
          <table className="w-full min-w-[28rem] text-left text-sm">
            <caption className="sr-only">Valores de {title} por tribunal</caption>
            <thead><tr className="border-b text-xs font-semibold uppercase tracking-wide text-muted-foreground"><th className="py-1.5 pr-3">Tribunal</th><th className="py-1.5 pr-3">Ramo</th><th className="py-1.5 pr-3 text-right">Valor</th><th className="py-1.5 pr-3 text-right">Ação</th></tr></thead>
            <tbody>
              {[...points].sort((a, b) => b.value - a.value).map(p => {
                const isSelected = p.tribunalId === selectedTribunalId;
                return (
                  <tr key={p.tribunalId} className={isSelected ? 'border-b bg-secondary/60' : 'border-b last:border-0'}>
                    <td className="py-1.5 pr-3"><Link replace scroll={false} href={hrefForPoint(p.tribunalId)} className="font-bold text-primary underline-offset-2 hover:underline">{p.sigla}</Link> <span className="text-muted-foreground">{p.officialName}</span></td>
                    <td className="py-1.5 pr-3 text-muted-foreground">{p.branchName}</td>
                    <td className="py-1.5 pr-3 text-right tabular-nums">{formatValue(p.value)}</td>
                    <td className="py-1.5 pr-3 text-right"><Link replace scroll={false} href={hrefForPoint(p.tribunalId)} className="text-xs font-bold text-primary underline-offset-2 hover:underline">{isSelected ? 'Inspecionando' : 'Inspecionar'}</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <div className="relative mt-7" style={{ height: PLOT_HEIGHT }}>
            <div className="absolute inset-y-0 left-0" style={{ width: Y_GUTTER }} aria-hidden>
              {ticks.map(t => <span key={t} className="absolute -translate-y-1/2 whitespace-nowrap pr-2 text-right text-[0.65rem] font-semibold text-muted-foreground" style={{ bottom: `${yPct(t)}%`, right: 0 }}>{formatValue(t)}</span>)}
            </div>
            {/* Achado real (axe-core): `role="img"` aqui disparava `nested-interactive` — além da
             * violação, diz pro leitor de tela tratar tudo dentro como uma imagem só, achatada, o que
             * esconderia os `<Link>` de verdade dos pontos. `role="group"` descreve o mesmo conjunto
             * sem ocultar os filhos interativos. */}
            <div className="absolute inset-y-0" style={{ left: Y_GUTTER, right: 0 }} role="group"
              aria-label={`Distribuição de ${title.toLowerCase()} entre ${points.length} tribunais, de ${formatValue(min)} a ${formatValue(max)}, mediana ${formatValue(med)}${useLog ? ', eixo em escala logarítmica' : ''}.`}>
              {ticks.map(t => <div key={t} className="absolute inset-x-0 border-t border-border/60" style={{ bottom: `${yPct(t)}%` }} aria-hidden />)}
              <div className="absolute inset-x-0 border-t border-dashed border-foreground/35" style={{ bottom: `${yPct(med)}%` }} aria-hidden />
              <span className="absolute right-1 -translate-y-1/2 whitespace-nowrap rounded bg-card px-1.5 py-0.5 text-[0.62rem] font-bold text-foreground/70 shadow-sm" style={{ bottom: `${yPct(med)}%` }} aria-hidden>Mediana: {formatValue(med)}</span>

              <div className="absolute left-1 top-1 hidden max-w-[12rem] rounded-lg border bg-card/95 p-2.5 text-[0.68rem] leading-4 text-muted-foreground shadow-sm backdrop-blur lg:block" aria-hidden>
                Cada ponto representa um tribunal. A posição mostra seu valor de {title.toLowerCase()}, em relação aos demais do recorte.
              </div>

              {sorted.map((p, i) => {
                const isSelected = p.tribunalId === selectedTribunalId;
                const isMesa = mesaIds.includes(p.tribunalId);
                return (
                  <Link key={p.tribunalId} href={hrefForPoint(p.tribunalId)} replace scroll={false}
                    title={`${p.sigla} — ${p.officialName}: ${formatValue(p.value)}`}
                    aria-current={isSelected ? 'true' : undefined}
                    className="focus-ring group absolute grid -translate-x-1/2 translate-y-1/2 place-items-center rounded-full transition-transform hover:z-10 hover:scale-125"
                    style={{ left: `${xPct(i)}%`, bottom: `calc(${yPct(p.value)}% - ${MARK / 2}px)`, width: MARK, height: MARK }}>
                    {/* Bandeira do estado (mesma ideia do swarm de congestionamento em /judiciario) quando a
                     * sigla resolve pra 1 única UF (Estadual/Eleitoral/Militar) — tribunais sem UF única
                     * (Federal, Trabalho, Superiores, STF, CNJ) mantêm o ponto genérico, nunca uma UF chutada. */}
                    {p.uf ? (
                      <img src={`/flags/${p.uf}.svg`} alt="" aria-hidden className={
                        isSelected ? 'size-[14px] rounded-full object-cover ring-2 ring-primary ring-offset-1 ring-offset-card'
                        : isMesa ? 'size-[13px] rounded-full object-cover ring-2 ring-primary/60'
                        : 'size-[12px] rounded-full object-cover ring-1 ring-card/80 opacity-85 group-hover:opacity-100'
                      } />
                    ) : (
                      <span className={
                        isSelected ? 'size-[11px] rounded-full bg-primary ring-2 ring-card ring-offset-1 ring-offset-primary'
                        : isMesa ? 'size-[9px] rounded-full border-2 border-primary bg-card'
                        : 'size-[7px] rounded-full bg-primary/30 group-hover:bg-primary/60'
                      } />
                    )}
                    <span className="sr-only">{p.sigla}, {p.branchName}: {formatValue(p.value)}{isSelected ? ' (inspecionado)' : ''}{isMesa ? ' (na mesa de investigação)' : ''}</span>
                  </Link>
                );
              })}

              {/* Rótulo fixado acima do ponto inspecionado (mock do usuário) — só quando há espaço: a
               * própria grade "nice" já reserva margem acima do máximo real na maioria dos casos. */}
              {selectedIndex >= 0 && (
                <div className="absolute -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-md bg-primary px-2 py-1 text-[0.65rem] font-bold text-primary-foreground shadow"
                  style={{ left: `${xPct(selectedIndex)}%`, bottom: `calc(${yPct(sorted[selectedIndex]!.value)}% + ${MARK / 2 + 6}px)` }} aria-hidden>
                  {sorted[selectedIndex]!.sigla} {formatValue(sorted[selectedIndex]!.value)}
                </div>
              )}
            </div>
          </div>
          <p className="mt-2 text-center text-[0.65rem] font-semibold uppercase tracking-wide text-muted-foreground">Tribunais, por ordem crescente de valor</p>
        </>
      )}
    </div>
  );
}
