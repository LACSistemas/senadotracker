'use client';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { UfGeometry } from '@/lib/exec-territory';
import type { MapMetricDef } from '@/lib/territory-map-metrics';
import { emptyFill } from '@/lib/scale';
import { flagLabels } from './territory-ui';
import { IndicatorLive } from '@/components/indicators/indicator-live';
import { buildPeerRuler } from '@/lib/comparison/peer-distribution';
import { mapMetricToKpi } from '@/lib/comparison/kpi-adapters';

const MIN_SCALE = 1, MAX_SCALE = 7, PAD = 2.4, DRAG_THRESHOLD = 6;

/** Atlas Vivo (P3): o mesmo mapa coroplético de `MunicipalMap`, mas protagonista — zoom/pan por
 * ponteiro, roda do mouse, teclado e botões, seleção que abre um painel de pré-visualização inline
 * (sem navegar) e recentra no município escolhido. `values`/`flags`/`names` já vêm carregados pela
 * página (1 consulta por UF, igual ao mapa contextual) — nenhuma consulta nova por interação.
 * Cada município continua sendo um `<Link>` real (clique simples navega sem JS; com JS, o clique
 * primário intercepta para abrir a pré-visualização — ctrl/cmd/shift/meio-clique e arraste continuam
 * se comportando como o usuário espera de qualquer link da web). */
export function AtlasVivo({ geometry, names, values, flags, metric, ramp, missing, initialSelected, stateName, year, initialScale, initialTx, initialTy }: {
  geometry: UfGeometry; names: Map<number, string>; values: Map<number, number>; flags: Map<number, number>;
  metric: MapMetricDef; ramp: readonly string[]; missing: string[]; initialSelected: number | null;
  /** P4 — comparador de pares na pré-visualização: nome da UF (rótulo da coorte) e ano representativo do
   * indicador (já lido de `period_start`, nenhuma consulta nova). */
  stateName: string; year: string;
  /** P6.2 — zoom/pan compartilháveis por URL (`?zoom=&x=&y=`), lidos pela página a partir da querystring.
   * Quando ausentes, o comportamento é idêntico ao de antes (abre em escala 1, ou focado em `initialSelected`). */
  initialScale?: number; initialTx?: number; initialTy?: number;
}) {
  const stageRef = useRef<HTMLDivElement>(null);
  const pathRefs = useRef(new Map<number, SVGPathElement>());
  const hasExplicitView = initialScale !== undefined && initialTx !== undefined && initialTy !== undefined;
  const [scale, setScale] = useState(hasExplicitView ? Math.min(MAX_SCALE, Math.max(MIN_SCALE, initialScale!)) : 1);
  const [tx, setTx] = useState(hasExplicitView ? initialTx! : 0);
  const [ty, setTy] = useState(hasExplicitView ? initialTy! : 0);
  const [dragging, setDragging] = useState(false);
  const [instant, setInstant] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(initialSelected);
  const live = useRef({ scale: 1, tx: 0, ty: 0 });
  useEffect(() => { live.current = { scale, tx, ty }; }, [scale, tx, ty]);
  const dragOrigin = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null);
  const moved = useRef(false);

  const sorted = [...values.values()].sort((a, b) => a - b);
  const edges = [0.2, 0.4, 0.6, 0.8].map(q => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] ?? 0);
  const band = (v: number) => edges.filter(e => v >= e).length;
  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: metric.digits, maximumFractionDigits: metric.digits });
  const describe = (id: number, name: string, v: number | undefined) => {
    const base = `${name}: ${v === undefined ? 'sem dado' : `${fmt.format(v)} ${metric.unit}`}`;
    const fl = flagLabels(flags.get(id) ?? 0);
    return fl.length ? `${base} (${fl.join('; ')})` : base;
  };

  const syncUrl = useCallback((id: number | null) => {
    try {
      const url = new URL(window.location.href);
      if (id) url.searchParams.set('municipio', String(id)); else url.searchParams.delete('municipio');
      window.history.replaceState(null, '', url.toString());
    } catch { /* URL indisponível (ex. pré-renderização) — seleção continua funcionando localmente */ }
  }, []);

  /** Mantém o centro visível do mapa sempre sobrepondo pelo menos parte do palco (P3 já documentava isto
   * como pendência — "sem clamping dos limites do pan"): a lógica aqui usa o tamanho renderizado do palco
   * (não do SVG) porque, nesta composição, o conteúdo preenche 100% do palco quando `scale===1`. */
  const clampPan = useCallback((nx: number, ny: number, s: number) => {
    const w = stageRef.current?.clientWidth ?? 0, h = stageRef.current?.clientHeight ?? 0;
    if (!w || !h) return { x: nx, y: ny };
    return { x: Math.min(w * 0.8, Math.max(w * (0.2 - s), nx)), y: Math.min(h * 0.8, Math.max(h * (0.2 - s), ny)) };
  }, []);

  /** Zoom/pan compartilháveis por URL — grava com atraso (o usuário pode arrastar/rodar a roda várias
   * vezes por segundo; escrever a cada frame poluiria o histórico do navegador sem necessidade). Só grava
   * quando há zoom real: na escala padrão (1, sem deslocamento) os parâmetros são removidos da URL. */
  const panSyncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (panSyncTimer.current) clearTimeout(panSyncTimer.current);
    panSyncTimer.current = setTimeout(() => {
      try {
        const url = new URL(window.location.href);
        if (scale > 1.01) { url.searchParams.set('zoom', scale.toFixed(2)); url.searchParams.set('x', String(Math.round(tx))); url.searchParams.set('y', String(Math.round(ty))); }
        else { url.searchParams.delete('zoom'); url.searchParams.delete('x'); url.searchParams.delete('y'); }
        window.history.replaceState(null, '', url.toString());
      } catch { /* URL indisponível */ }
    }, 400);
    return () => { if (panSyncTimer.current) clearTimeout(panSyncTimer.current); };
  }, [scale, tx, ty]);

  /** Zoom centrado num ponto da tela (px,py relativos ao palco). Lê o estado atual via `live` (ref
   * espelho) em vez de encadear atualizadores de `setState` — mais simples de seguir e igualmente
   * livre de valores desatualizados, porque só roda em resposta a um evento discreto do usuário. */
  const zoomAt = useCallback((px: number, py: number, factor: number) => {
    const { scale: s0, tx: x0, ty: y0 } = live.current;
    const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, s0 * factor));
    if (s1 === MIN_SCALE) { setScale(1); setTx(0); setTy(0); return; }
    const cx = (px - x0) / s0, cy = (py - y0) / s0;
    const c = clampPan(px - s1 * cx, py - s1 * cy, s1);
    setScale(s1); setTx(c.x); setTy(c.y);
  }, [clampPan]);

  const reset = useCallback(() => { setScale(1); setTx(0); setTy(0); }, []);

  /** Recentra e amplia para enquadrar o município `id`, usando a posição JÁ renderizada do seu
   * polígono (getBoundingClientRect, em px de tela) — funciona em qualquer zoom/pan atual porque
   * primeiro desfaz a transformação corrente (via `live`) para achar as coordenadas de conteúdo. */
  const focusOn = useCallback((id: number) => {
    const el = pathRefs.current.get(id); const stage = stageRef.current;
    if (!el || !stage) return;
    try {
      const pathRect = el.getBoundingClientRect(); const stageRect = stage.getBoundingClientRect();
      if (pathRect.width === 0 || pathRect.height === 0 || stageRect.width === 0) return;
      const { scale: s0, tx: x0, ty: y0 } = live.current;
      const cx = (pathRect.left + pathRect.width / 2 - stageRect.left - x0) / s0;
      const cy = (pathRect.top + pathRect.height / 2 - stageRect.top - y0) / s0;
      const contentW = pathRect.width / s0, contentH = pathRect.height / s0;
      const s1 = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min(stageRect.width / (contentW * PAD), stageRect.height / (contentH * PAD))));
      const c = clampPan(stageRect.width / 2 - s1 * cx, stageRect.height / 2 - s1 * cy, s1);
      setScale(s1); setTx(c.x); setTy(c.y);
    } catch { /* getBoundingClientRect indisponível fora do navegador */ }
  }, [clampPan]);

  // Só recentra automaticamente no município selecionado quando NÃO veio um zoom/pan explícito da URL
  // (ex. um link compartilhado já aponta para um enquadramento específico — não sobrescrever).
  useEffect(() => { if (initialSelected && !hasExplicitView) focusOn(initialSelected); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: PointerEvent) => {
      const o = dragOrigin.current; if (!o) return;
      if (!moved.current && Math.hypot(e.clientX - o.x, e.clientY - o.y) > DRAG_THRESHOLD) moved.current = true;
      const c = clampPan(o.tx + (e.clientX - o.x), o.ty + (e.clientY - o.y), live.current.scale);
      setTx(c.x); setTy(c.y);
    };
    const onUp = () => { setDragging(false); dragOrigin.current = null; setInstant(false); };
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [dragging]);

  // Roda do mouse: listener manual non-passive — o `onWheel` do React não garante poder bloquear o
  // scroll da página em todo runtime, e aqui o gesto precisa controlar o zoom, não rolar a página.
  useEffect(() => {
    const stage = stageRef.current; if (!stage) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = stage.getBoundingClientRect();
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY > 0 ? 0.88 : 1.12);
    };
    stage.addEventListener('wheel', onWheel, { passive: false });
    return () => stage.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  const select = (id: number | null) => { setSelectedId(id); syncUrl(id); if (id) focusOn(id); };
  const centerZoom = (factor: number) => { const r = stageRef.current?.getBoundingClientRect(); zoomAt((r?.width ?? 0) / 2, (r?.height ?? 0) / 2, factor); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    const step = 60;
    if (e.key === '+' || e.key === '=') { e.preventDefault(); centerZoom(1.25); }
    else if (e.key === '-') { e.preventDefault(); centerZoom(0.8); }
    else if (e.key === '0') { e.preventDefault(); reset(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); const c = clampPan(tx + step, ty, scale); setTx(c.x); setTy(c.y); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); const c = clampPan(tx - step, ty, scale); setTx(c.x); setTy(c.y); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); const c = clampPan(tx, ty + step, scale); setTx(c.x); setTy(c.y); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); const c = clampPan(tx, ty - step, scale); setTx(c.x); setTy(c.y); }
    else if (e.key === 'Escape' && selectedId) { select(null); }
  };

  const selName = selectedId ? names.get(selectedId) ?? String(selectedId) : null;
  const selValue = selectedId ? values.get(selectedId) : undefined;
  const selFlags = selectedId ? flagLabels(flags.get(selectedId) ?? 0) : [];
  /** P4: território×distribuição de pares (Parte VII.13) — régua `Ruler` já usada por `BenchRuler`,
   * construída a partir do `values` que a página já carregou inteiro (nenhuma consulta nova). Bloqueada
   * com motivo explícito (`peer.reason`) quando a coorte é pequena demais (ex. Roraima) — nunca omitida
   * silenciosamente, vai para o `caveat` do Kpi adaptado. */
  const peer = selectedId != null && selValue !== undefined
    ? buildPeerRuler(selectedId, values, { unit: metric.unit, digits: metric.digits, cohort: `municípios de ${stateName}`, year })
    : null;
  const previewKpi = selectedId != null && selName && selValue !== undefined && peer
    ? mapMetricToKpi({ metric, name: selName, valueDisplay: fmt.format(selValue), year, peer, flagTexts: selFlags })
    : null;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_minmax(17rem,20rem)]">
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">Arraste para mover, role ou use os botões para ampliar. Clique num município para pré-visualizar.</p>
          <div className="flex gap-1" role="group" aria-label="Controles do Atlas Vivo">
            <button type="button" onClick={() => centerZoom(1.3)} className="focus-ring rounded-md border bg-card px-2.5 py-1 text-sm font-semibold hover:border-primary/50" aria-label="Ampliar">+</button>
            <button type="button" onClick={() => centerZoom(0.77)} className="focus-ring rounded-md border bg-card px-2.5 py-1 text-sm font-semibold hover:border-primary/50" aria-label="Reduzir">−</button>
            <button type="button" onClick={reset} className="focus-ring rounded-md border bg-card px-2.5 py-1 text-xs font-semibold hover:border-primary/50">Centralizar</button>
          </div>
        </div>
        <div ref={stageRef} tabIndex={0} role="application" aria-roledescription="mapa interativo" aria-label={`Atlas Vivo: mapa dos municípios colorido por ${metric.label}. Use as setas para mover e + / - para ampliar.`}
          onKeyDown={onKeyDown}
          onPointerDown={e => { if (e.button !== 0) return; moved.current = false; setDragging(true); setInstant(true); dragOrigin.current = { x: e.clientX, y: e.clientY, tx, ty }; }}
          data-dragging={dragging} className="atlas-stage focus-ring overflow-hidden rounded-3xl border bg-card" style={{ height: 'min(70vh, 42rem)' }}>
          <div className="atlas-canvas h-full w-full" data-instant={instant} style={{ transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
            <svg viewBox={geometry.viewBox} className="map-regions pointer-events-auto h-full w-full p-4">
              {geometry.items.map(item => {
                const v = values.get(item.id); const name = names.get(item.id) ?? String(item.id);
                const sel = item.id === selectedId;
                const fill = v === undefined ? emptyFill : ramp[band(v)]!;
                const desc = describe(item.id, name, v);
                return <Link key={item.id} href={`/municipios/${item.id}`} aria-label={desc}
                  onClick={e => {
                    if (moved.current || e.ctrlKey || e.metaKey || e.shiftKey || e.button !== 0) { if (moved.current) e.preventDefault(); return; }
                    e.preventDefault(); select(sel ? null : item.id);
                  }}>
                  <path ref={el => { if (el) pathRefs.current.set(item.id, el); else pathRefs.current.delete(item.id); }}
                    d={item.d} fill={fill} stroke={sel ? 'var(--foreground)' : 'var(--card)'} strokeWidth={sel ? 2.4 : 0.6} vectorEffect="non-scaling-stroke" className="map-region"><title>{desc}</title></path>
                </Link>;
              })}
            </svg>
          </div>
        </div>
        <figcaption className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {ramp.map((c, i) => <span key={c} className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border" style={{ background: c }} aria-hidden />{i === 0 ? `até ${fmt.format(edges[0] ?? 0)}` : i === 4 ? `${fmt.format(edges[3] ?? 0)} ou mais` : `${fmt.format(edges[i - 1] ?? 0)} a ${fmt.format(edges[i] ?? 0)}`}</span>)}
          <span className="inline-flex items-center gap-1.5"><span className="inline-block h-3 w-5 rounded-sm border" style={{ background: emptyFill }} aria-hidden />sem dado</span>
        </figcaption>
        <p className="mt-1 text-[0.7rem] text-muted-foreground">Faixas por quintil (20% dos municípios com dado em cada faixa), não por intervalo fixo de valor.</p>
        {missing.length > 0 && <p className="mt-2 text-xs text-muted-foreground">Sem polígono na malha oficial utilizada: {missing.join(', ')}. O município continua acessível pela busca.</p>}
      </div>

      <aside aria-live="polite" className="h-fit rounded-2xl border bg-card p-4">
        {selectedId && selName ? <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-display text-xl">{selName}</h3>
            <button type="button" onClick={() => select(null)} aria-label="Fechar pré-visualização" className="focus-ring rounded-full border px-2 text-sm text-muted-foreground hover:border-primary/50">×</button>
          </div>
          {previewKpi ? <div className="mt-3">
            <IndicatorLive kpi={previewKpi} who={selName} verify={{ source: metric.domain, definition: metric.label, ...(peer?.ruler ? { coverage: `${peer.ruler.n} municípios de ${stateName} com dado elegível para comparação` } : {}), caveat: peer?.ruler ? null : (peer?.reason ?? null), notes: [`Fonte e metodologia completas na aba ${metric.domain} do perfil deste município.`] }} />
          </div> : <p className="mt-2 text-sm text-muted-foreground">— sem dado para este indicador.</p>}
          <Link href={`/municipios/${selectedId}`} className="mt-4 inline-block rounded-full bg-primary px-4 py-2 text-sm font-bold text-primary-foreground">Ver perfil completo →</Link>
        </div> : <div>
          <h3 className="font-display text-lg">Pré-visualização</h3>
          <p className="mt-2 text-sm text-muted-foreground">Clique num município no mapa, ou use a busca, para ver o valor aqui antes de abrir o perfil completo.</p>
        </div>}
      </aside>
    </div>
  );
}
