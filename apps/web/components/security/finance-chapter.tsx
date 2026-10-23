'use client';

import { useCallback, useMemo, useState } from 'react';
import type { ContractRow } from '@senadotracker/db';
import type { ChartView, FinanceChapter, FinanceYear, MoneyStage, ScopeInfo } from '@/lib/security/types';
import { brlShort, fmt } from '@/lib/security/format';
import { TrendChart } from './trend-chart';
import { cn } from '@/lib/utils';

type Mode = 'valor' | 'percapita' | 'share';
const MODES: Array<{ key: Mode; label: string; hint: string }> = [
  { key: 'valor', label: 'Valor em R$', hint: 'Escolha a etapa do gasto.' }, { key: 'percapita', label: 'Por habitante', hint: 'Despesa paga ÷ população do mesmo ano; permite comparar com municípios semelhantes.' }, { key: 'share', label: '% da despesa total', hint: 'Quanto da despesa total empenhada do ente é Segurança Pública.' },
];
const money = (cents: number) => `R$ ${fmt(cents / 100, 0)}`;
const pncpLink = (id: string) => { const m = /^(\d{14})-\d+-(\d+)\/(\d{4})$/.exec(id); return m ? `https://pncp.gov.br/app/contratos/${m[1]}/${m[3]}/${Number(m[2])}` : null; };

export function FinanceChapterBody({ ch, scope }: { ch: FinanceChapter; scope: ScopeInfo }) {
  const [mode, setMode] = useState<Mode>('valor'); const [stage, setStage] = useState<MoneyStage['key']>('paga');
  const closed = ch.years.filter(y => !y.preliminary); const [year, setYear] = useState<number | null>(closed.at(-1)?.exercicio ?? null);
  const where = scope.kind === 'uf' ? scope.stateName : scope.name; const st = ch.stages.find(s => s.key === stage)!;

  const chart: ChartView | null = useMemo(() => {
    if (!ch.years.length) return null;
    if (mode === 'valor') { const pts = ch.years.map(y => ({ t: String(y.exercicio), v: y.stages[stage] != null ? y.stages[stage]! / 1e6 : null, state: (y.stages[stage] == null ? 'absent' : y.preliminary ? 'partial' : 'ok') as 'ok' | 'partial' | 'absent' }));
      return { id: `fin:${stage}`, title: `${st.label} na função Segurança Pública — ${where}`, unit: 'R$ milhões', digits: 1, grain: 'A', series: [{ key: 's', label: st.label, color: 'primary', points: pts }], notes: [st.hint, 'Valores correntes, sem correção pela inflação. O ano em curso (círculo vazado) é acumulado até o último bimestre e não é um ano completo.'], source: 'Siconfi (DCA e RREO)', coverage: ch.coverage }; }
    if (mode === 'percapita') { const pts = ch.years.filter(y => !y.preliminary).map(y => ({ t: String(y.exercicio), v: y.perCapitaPaid, state: (y.perCapitaPaid == null ? 'absent' : 'ok') as 'ok' | 'absent' }));
      return { id: 'fin:pc', title: `Despesa paga em Segurança por habitante — ${where}`, unit: 'R$ por habitante', digits: 0, grain: 'A', series: [{ key: 's', label: where, color: 'primary', points: pts }], bench: ch.bench ?? undefined, gaps: [{ from: '2022', to: '2023', label: 'sem estimativa oficial de população' }], notes: ['Despesa paga ÷ população estimada do mesmo ano. Sem população oficial em 2022 e 2023, esses anos ficam em branco.'], source: 'Siconfi; população IBGE', coverage: ch.coverage }; }
    const pts = ch.years.filter(y => !y.preliminary).map(y => ({ t: String(y.exercicio), v: y.share != null ? y.share * 100 : null, state: (y.share == null ? 'absent' : 'ok') as 'ok' | 'absent' }));
    return { id: 'fin:share', title: `Segurança Pública na despesa total empenhada — ${where}`, unit: '% da despesa total', digits: 1, grain: 'A', series: [{ key: 's', label: where, color: 'blue', points: pts }], notes: ['Participação da função Segurança Pública na despesa total empenhada do ente (exceto intraorçamentárias). Participação não mede esforço nem resultado.'], source: 'Siconfi DCA', coverage: ch.coverage };
  }, [mode, stage, ch, where, st]);

  const y: FinanceYear | undefined = ch.years.find(x => x.exercicio === year) ?? closed.at(-1);
  const subKey = stage === 'dotacao' || stage === 'liquidada' ? 'empenhada' : stage; const subs = (y?.subfunctions ?? []).map(s => ({ ...s, v: subKey === 'paga' ? s.paga : s.empenhada })).filter(s => s.v != null && s.v > 0).sort((a, b) => b.v! - a.v!); const subMax = Math.max(...subs.map(s => s.v!), 1);

  // contratos sob demanda
  const [con, setCon] = useState<{ total: number; rows: ContractRow[]; restrictions: string[] } | null>(null); const [conYear, setConYear] = useState<number | ''>(''); const [conBusy, setConBusy] = useState(false); const [conErr, setConErr] = useState(false); const [off, setOff] = useState(0);
  const loadContracts = useCallback(async (yr: number | '', offset: number) => { setConBusy(true); setConErr(false); try { const r = await fetch(`/api/seguranca/contratos?entity=${scope.entityId}${yr ? `&year=${yr}` : ''}&offset=${offset}&limit=15`); if (!r.ok) throw new Error(); const j = await r.json(); setCon({ total: j.total, rows: j.rows, restrictions: j.restrictions }); setOff(offset); } catch { setConErr(true); } finally { setConBusy(false); } }, [scope.entityId]);
  const cp = ch.contractsPreview;

  if (!chart) return <p className="rounded-xl border border-dashed p-5 text-sm text-muted-foreground">{ch.emptyReason}</p>;
  return (
    <>
      <div className="rounded-2xl border bg-white p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div role="group" aria-label="Como medir" className="inline-flex overflow-hidden rounded-full border text-xs">{MODES.map(m => <button key={m.key} type="button" aria-pressed={mode === m.key} onClick={() => setMode(m.key)} className={cn('px-3 py-1.5 font-semibold', mode === m.key ? 'bg-[#115b45] text-white' : 'bg-white hover:bg-secondary')}>{m.label}</button>)}</div>
          {mode === 'valor' && <div role="group" aria-label="Etapa do gasto" className="flex flex-wrap gap-1.5 text-xs">{ch.stages.map(s => <button key={s.key} type="button" title={s.hint} aria-pressed={stage === s.key} onClick={() => setStage(s.key)} className={cn('rounded-full border px-3 py-1.5 font-semibold', stage === s.key ? 'border-[#14304f] bg-[#14304f] text-white' : 'bg-white hover:border-[#14304f]/50')}>{s.label}</button>)}</div>}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{mode === 'valor' ? st.hint : MODES.find(m => m.key === mode)!.hint} <strong>Etapas nunca se somam: veja uma por vez.</strong></p>
        <div className="mt-3"><TrendChart key={chart.id} chart={chart} title valuePrefix={mode === 'share' ? '' : 'R$ '} /></div>
        {mode === 'percapita' && (chart.bench?.status === 'ok' ? <p className="mt-3 rounded-lg border bg-[#eef3fa] p-3 text-sm leading-6 text-[#14304f]"><strong>Comparação válida. </strong>{chart.bench.sentence}</p> : <p className="mt-3 rounded-lg border border-dashed p-3 text-sm leading-6 text-muted-foreground"><strong className="text-[#14304f]">Sem comparação válida. </strong>{ch.bench?.unavailableReason ?? 'Sem grupo comparável para este ano.'}</p>)}
      </div>

      {y && (
        <div className="rounded-2xl border bg-white p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-display text-xl text-[#14304f]">Para onde vai a despesa — subfunções</h3>
            <label className="text-xs text-muted-foreground">Ano <select value={y.exercicio} onChange={e => setYear(Number(e.target.value))} className="ml-1 rounded-lg border bg-white p-1.5 text-sm text-foreground">{closed.map(c => <option key={c.exercicio} value={c.exercicio}>{c.exercicio}</option>)}</select></label></div>
          {subs.length ? <ul className="mt-3 space-y-2.5">{subs.map(s => <li key={s.code} className="text-xs"><div className="flex justify-between gap-2"><span>{s.label}</span><span className="tnum font-semibold">{brlShort(s.v!)}</span></div><div className="mt-0.5 h-2.5 rounded-full bg-secondary"><div className="h-2.5 rounded-full bg-[#115b45]" style={{ width: `${Math.max(2, (s.v! / subMax) * 100)}%` }} /></div></li>)}</ul> : <p className="mt-3 text-sm text-muted-foreground">Sem abertura por subfunção para este ano.</p>}
          <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">Mostra o estágio {subKey === 'paga' ? 'pago' : 'empenhado'} de {y.exercicio}. “Administração geral” concentra, em muitos entes, folha e custeio das corporações: “Policiamento” isolado não é o gasto das polícias.</p>
        </div>
      )}
      {ch.stateContext && <div className="rounded-2xl border border-dashed bg-[#faf9f5] p-4 text-sm"><p className="eyebrow">Contexto do estado</p><p className="mt-1 leading-6 text-muted-foreground">{ch.stateContext.label}{ch.stateContext.latest?.stages.paga != null ? ` Em ${ch.stateContext.latest.exercicio}, o governo estadual pagou ${brlShort(ch.stateContext.latest.stages.paga)} na função.` : ''}</p></div>}

      <div className="rounded-2xl border bg-white p-4 sm:p-5">
        <h3 className="font-display text-xl text-[#14304f]">Contratos públicos ligados a segurança (PNCP)</h3>
        {!cp ? <p className="mt-2 text-sm text-muted-foreground">Nenhum contrato de órgão de segurança ou de tema de segurança foi encontrado no PNCP para {where} (2021–2026). {ch.detranNote}</p> : (
          <>
            <p className="mt-1 text-xs text-muted-foreground">{fmt(cp.total)} contratos de {where} no PNCP, 2021–2026 (2026 até outubro). Valor contratado não é valor pago.</p>
            <ul className="mt-3 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">{cp.byYear.map(b => <li key={b.year} className="rounded-lg border bg-secondary/50 p-2 text-center"><p className="text-[0.68rem] text-muted-foreground">{b.year}{b.year === cp.partialYear ? ' (parcial)' : ''}</p><p className="tnum text-sm font-bold">{fmt(b.contracts)}</p><p className="text-[0.68rem] text-muted-foreground">{brlShort(b.valueCents / 100)}</p></li>)}</ul>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs"><label>Ano <select value={conYear} onChange={e => { const v = e.target.value ? Number(e.target.value) : ''; setConYear(v); void loadContracts(v, 0); }} className="ml-1 rounded-lg border bg-white p-1.5 text-sm"><option value="">Todos</option>{cp.byYear.map(b => <option key={b.year} value={b.year}>{b.year}</option>)}</select></label>
              {!con && <button type="button" onClick={() => void loadContracts(conYear, 0)} disabled={conBusy} className="rounded-full bg-[#115b45] px-4 py-1.5 font-semibold text-white disabled:opacity-60">{conBusy ? 'Carregando…' : 'Ver os maiores contratos'}</button>}</div>
            {conErr && <p role="alert" className="mt-2 text-sm text-[#a33a3a]">Não foi possível carregar os contratos agora.</p>}
            {con && <div className="mt-3 overflow-x-auto rounded-lg border"><table className="w-full min-w-[40rem] text-left text-xs"><caption className="sr-only">Contratos do PNCP ligados a segurança, do maior valor ao menor</caption><thead className="bg-secondary"><tr><th scope="col" className="p-2">Assinatura</th><th scope="col" className="p-2">Órgão</th><th scope="col" className="p-2">Tema</th><th scope="col" className="p-2">Fornecedor</th><th scope="col" className="p-2 text-right">Valor contratado</th><th scope="col" className="p-2">PNCP</th></tr></thead>
              <tbody>{con.rows.map(r => <tr key={r.pncpId} className="border-t align-top"><td className="p-2 tnum">{r.signed ?? r.year}</td><td className="p-2">{r.orgKind}</td><td className="p-2">{r.theme ?? <span className="text-muted-foreground">sem tema derivado ({r.link})</span>}</td><td className="p-2">{r.supplierName ?? '—'}{r.supplierCnpj && <span className="block text-[0.65rem] text-muted-foreground">CNPJ {r.supplierCnpj.padStart(14, '0')}</span>}</td><td className="p-2 text-right tnum font-semibold">{money(Number(r.valueCents))}</td><td className="p-2">{pncpLink(r.pncpId) ? <a href={pncpLink(r.pncpId)!} target="_blank" rel="noreferrer" className="font-semibold text-primary underline">abrir</a> : '—'}</td></tr>)}</tbody></table></div>}
            {con && <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground"><span>{fmt(con.total)} contratos{conYear ? ` em ${conYear}` : ''}; mostrando {fmt(off + 1)}–{fmt(Math.min(off + 15, con.total))}</span><span className="space-x-2"><button type="button" disabled={off === 0 || conBusy} onClick={() => void loadContracts(conYear, Math.max(0, off - 15))} className="rounded-full border px-3 py-1 font-semibold disabled:opacity-40">Anteriores</button><button type="button" disabled={off + 15 >= con.total || conBusy} onClick={() => void loadContracts(conYear, off + 15)} className="rounded-full border px-3 py-1 font-semibold disabled:opacity-40">Próximos</button></span></div>}
            <p className="mt-3 text-[0.7rem] leading-snug text-muted-foreground">{(con?.restrictions ?? ['Valor global CONTRATADO publicado no PNCP: não é valor pago nem despesa da função 06.', 'A ligação com segurança é inferida pelo órgão e/ou por palavras-chave do objeto; pode haver falsos positivos e omissões.']).join(' ')}</p>
          </>)}
        <p className="mt-3 text-[0.7rem] text-muted-foreground">{ch.organsNote}</p>
      </div>
    </>
  );
}
