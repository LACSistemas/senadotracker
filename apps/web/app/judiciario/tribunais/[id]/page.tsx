import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowRight, Banknote, Building2, Gavel, Scale } from 'lucide-react';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { MultiLineChart } from '@/components/charts';
import { ChapterNav, type NavItem } from '@/components/security/chapter-nav';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { MethodologyPanel, type IndicatorMethodology } from '@/components/judiciary/methodology-panel';
import { MinisterCard } from '@/components/judiciary/minister-card';
import { loadJudiciaryTribunalProfile, loadJudiciaryTribunalSeries, loadJudiciaryStjOverview, loadJudiciaryStjPrecedents, loadJudiciaryStfOverview, loadJudiciaryStfTemas, loadJudiciaryStfPayrollSummary, loadJudiciaryStfPayrollRoster, loadJudiciaryStfGeneralJurisprudenceOverview, loadJudiciaryPersonnelProfile } from '@/lib/judiciary';
import { StatGrid, BarList } from '@/components/infrastructure/infrastructure-ui';
import { loadJudiciaryThemeByTribunal } from '@/lib/judiciary-themes';
import type { JudiciaryThemeId } from '@senadotracker/db';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };
const int = new Intl.NumberFormat('pt-BR');
const ratio1 = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 });
const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
const REAL_THEMES: JudiciaryThemeId[] = ['TAX_EXECUTION', 'GENERAL_EXECUTION', 'CRIMINAL_EXECUTION', 'DOMESTIC_VIOLENCE', 'CRIMINAL', 'CONCILIATION'];
type Stat = { indicator_id: string; public_name: string; official_name: string; unit: string; aggregation_allowed: string; comparison_eligible: boolean; reference_year: number; value_numeric: string | null; coverage_status: string; degree_code: string | null };
type Unit = { unit_id: string; official_name: string; unit_type: string | null; physical_municipality_source_code: string | null; physical_uf: string | null; active: boolean | null; match_status: string };

export async function generateMetadata({ params }: Props) {
  const { id } = await params; const profile = await loadJudiciaryTribunalProfile(decodeURIComponent(id));
  const t = profile.data?.tribunal as any; return { title: t ? `${t.sigla} · Judiciário · Cívica` : 'Tribunal · Cívica' };
}

export default async function TribunalProfilePage({ params }: Props) {
  const { id } = await params; const tribunalId = decodeURIComponent(id);
  const profile = await loadJudiciaryTribunalProfile(tribunalId, 2025);
  if (profile.availability !== 'AVAILABLE' || !profile.data) notFound();
  const { tribunal, statistics, units, financial, peerAverages } = profile.data as { tribunal: any; year: number; statistics: Stat[]; units: Unit[]; financial: any; peerAverages: Record<string, { avgValue: number | null; tribunalCount: number }> };
  const isStj = tribunal.sigla === 'STJ';
  const isStf = tribunal.sigla === 'STF';

  const [stjOverview, stjSample, stfOverview, stfSample, stfPayroll, stfRoster, stfJuris, themeResults, personnelProfile] = await Promise.all([
    isStj ? loadJudiciaryStjOverview() : Promise.resolve(null),
    isStj ? loadJudiciaryStjPrecedents({ pageSize: 3 }) : Promise.resolve(null),
    isStf ? loadJudiciaryStfOverview() : Promise.resolve(null),
    isStf ? loadJudiciaryStfTemas({ pageSize: 3 }) : Promise.resolve(null),
    isStf ? loadJudiciaryStfPayrollSummary() : Promise.resolve(null),
    isStf ? loadJudiciaryStfPayrollRoster({ role: 'MINISTRO' }) : Promise.resolve(null),
    isStf ? loadJudiciaryStfGeneralJurisprudenceOverview() : Promise.resolve(null),
    Promise.all(REAL_THEMES.map(async themeId => ({ themeId, result: await loadJudiciaryThemeByTribunal(themeId, tribunalId, 2025) }))),
    loadJudiciaryPersonnelProfile(tribunalId),
  ]);
  const personnel = personnelProfile.availability === 'AVAILABLE' ? (personnelProfile.data as { overview: { latestPeriod: { year: number; month: number } | null; byAnnexStatus: Array<{ source_annex: string; status: string; headcount: number }> }; byCareer: Record<string, Array<{ career_track: string | null; position_title: string | null; class_level: string | null; status: string; headcount: number }>>; suppliers: { period: { from: { year: number; month: number }; to: { year: number; month: number } } | null; topSuppliers: Array<{ supplier_name: string; supplier_cnpj: string | null; payments: number; amount_cents: string }>; total: { payments: number; amount_cents: string } | null } }) : null;
  const themeChapters = themeResults.filter(t => (t.result.data as any).metrics?.some((m: any) => m.value != null));

  const byId = new Map(statistics.map(s => [s.indicator_id, s]));
  const stat = (id: string) => byId.get(id);
  const newCases = (Number(stat('JN_CASES_NEW_G1')?.value_numeric ?? 0) + Number(stat('JN_CASES_NEW_G2')?.value_numeric ?? 0)) || null;
  const disposed = stat('JN_DISPOSED'); const pending = stat('JN_CASES_PENDING'); const congestion = stat('JN_CONGESTION_RATE'); const magistrates = stat('JN_ACTIVE_MAGISTRATES'); const staff = stat('JN_EFFECTIVE_STAFF');
  const expenseTotal = stat('JN_EXPENSE_TOTAL'); const expenseServers = stat('JN_EXPENSE_SERVERS'); const expenseBenefits = stat('JN_EXPENSE_BENEFITS'); const expenseMagistrates = stat('JN_EXPENSE_MAGISTRATES');
  const revenueTotal = stat('JN_REVENUE_TOTAL'); const expenseOtherCurrent = stat('JN_EXPENSE_OTHER_CURRENT'); const expensePerCapita = stat('JN_EXPENSE_PER_CAPITA');
  const magistratesPer100k = stat('JN_MAGISTRATES_PER_100K'); const staffPer100k = stat('JN_STAFF_PER_100K'); const pendingPer100k = stat('JN_CASES_PENDING_PER_100K');

  // Comparador leve "vs. média de outros tribunais do mesmo ramo" — só quando há pelo menos 3 pares com valor
  // publicado (média de 1-2 tribunais não é uma leitura confiável). O comparador completo, com qualquer
  // indicador/seleção, continua em /judiciario/comparar — isto é só um resumo de 1 linha no próprio perfil.
  const peerHint = (indicatorId: string, value: number | null, fmt: (n: number) => string): string | null => {
    if (value == null) return null;
    const peer = peerAverages[indicatorId];
    if (!peer || peer.avgValue == null || peer.tribunalCount < 3) return null;
    const diffPct = ((value - peer.avgValue) / peer.avgValue) * 100;
    const dir = diffPct >= 0 ? 'acima' : 'abaixo';
    return `${Math.abs(diffPct).toFixed(0)}% ${dir} da média de ${peer.tribunalCount} outros tribunais do mesmo ramo (${fmt(peer.avgValue)})`;
  };

  const activeChapters = [
    { id: 'visao-geral', label: 'Visão geral' },
    { id: 'atividade', label: 'Atividade' },
    { id: 'tempo', label: 'Tempo' },
    { id: 'estrutura', label: 'Estrutura' },
    (expenseTotal || financial?.facts?.length || financial?.payroll?.length) ? { id: 'financas', label: 'Finanças' } : null,
    personnel ? { id: 'pessoal', label: 'Pessoal' } : null,
    themeChapters.length ? { id: 'temas', label: 'Temas' } : null,
    (isStj || isStf) ? { id: 'jurisprudencia', label: 'Jurisprudência' } : null,
    (isStf && stfPayroll?.availability === 'AVAILABLE') ? { id: 'ministros', label: 'Ministros' } : null,
    { id: 'metodologia', label: 'Metodologia' },
  ].filter((x): x is NavItem => x !== null).map(x => ({ ...x, available: true }));

  const pilotUnits = units.filter(u => u.match_status === 'CANDIDATE_ONLY' || u.match_status === 'DOCUMENT_VERIFIED');
  const coverageFor = (available: boolean) => toChartCoverage(available ? 'AVAILABLE' : 'NOT_REPORTED', `CNJ Justiça em Números, edição 2026 · ano-base 2025`, { from: '2025-01-01', to: '2025-12-31', grain: 'year' });
  const generalCoverage = coverageFor(true);

  const congestionPct = congestion?.value_numeric != null ? Number(congestion.value_numeric) * 100 : null;
  const clearanceIdx = stat('JN_CLEARANCE_INDEX')?.value_numeric != null ? Number(stat('JN_CLEARANCE_INDEX')!.value_numeric) : null;
  const timeMean = stat('JN_TIME_DISPOSED_MEAN')?.value_numeric != null ? Math.round(Number(stat('JN_TIME_DISPOSED_MEAN')!.value_numeric)) : null;
  const levelLabel = tribunal.institutional_level === 'CONTROL' ? 'Órgão de controle do Judiciário' : tribunal.institutional_level === 'SUPERIOR' ? 'Tribunal superior' : 'Instituição do Poder Judiciário';

  return (
    <main id="conteudo" tabIndex={-1}>
      <div className="page-shell pt-6">
        <nav aria-label="Trilha" className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Link href="/judiciario" className="hover:text-primary">Judiciário</Link><span aria-hidden>/</span>
          <Link href="/judiciario/tribunais" className="hover:text-primary">Tribunais</Link><span aria-hidden>/</span>
          <span className="text-foreground">{tribunal.sigla}</span>
        </nav>
      </div>

      <div className="page-shell py-4">
        <div className="overflow-hidden rounded-[1.5rem] bg-primary text-primary-foreground">
          <div className="flex flex-col gap-5 p-6 sm:p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-start gap-4">
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-white/15"><Building2 size={26} aria-hidden /></span>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wide text-white/70">{tribunal.branch_name}{tribunal.seat_uf ? ` · ${tribunal.seat_uf}` : ''}</p>
                <h1 className="display-title mt-1 text-2xl break-words sm:text-3xl">{tribunal.official_name} ({tribunal.sigla})</h1>
                <p className="mt-2 max-w-xl text-sm text-white/80">{levelLabel} — {isStf || isStj ? 'responsável por sua competência constitucional nacional.' : 'responsável por processar e julgar as causas de sua competência.'}</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2 lg:flex-col lg:items-end">
              {tribunal.seat_uf && <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{tribunal.seat_uf}</span>}
              <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Ano-base: 2025</span>
              {tribunal.source_url ? <a href={tribunal.source_url} className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold underline">Fonte: CNJ — Justiça em Números</a> : <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">Fonte: CNJ — Justiça em Números</span>}
            </div>
          </div>
        </div>
      </div>

      <div className="page-shell py-3"><ChapterNav items={activeChapters} layout="inline" /></div>

      <div className="page-shell space-y-14 pb-16">
          <section id="visao-geral" className="scroll-mt-24">
            <h2 className="text-2xl font-black">Retrato institucional</h2>
            <div className="mt-4"><KpiGrid>
              <KpiCard icon={Scale} label="Casos novos" value={newCases !== null ? int.format(newCases) : '—'} coverage={coverageFor(newCases !== null)} comparison="1º + 2º grau · 2025" />
              <KpiCard icon={Gavel} label="Processos baixados" value={disposed?.value_numeric != null ? int.format(Number(disposed.value_numeric)) : '—'} coverage={coverageFor(disposed?.value_numeric != null)} comparison="2025" />
              <KpiCard label="Processos pendentes" value={pending?.value_numeric != null ? int.format(Number(pending.value_numeric)) : '—'} coverage={coverageFor(pending?.value_numeric != null)} comparison="acervo ao fim do ano" />
              <KpiCard label="Taxa de congestionamento" value={congestionPct != null ? `${congestionPct.toFixed(1)}%` : '—'} coverage={coverageFor(congestionPct != null)} comparison={congestionPct != null ? 'proporção represada no ano, deste tribunal' : null} />
              {pendingPer100k?.value_numeric != null && <KpiCard label="Pendentes por 100 mil habitantes" value={int.format(Math.round(Number(pendingPer100k.value_numeric)))} coverage={coverageFor(true)} comparison={peerHint('JN_CASES_PENDING_PER_100K', Number(pendingPer100k.value_numeric), v => int.format(Math.round(v))) ?? 'Razão calculada pela Cívica (CNJ não publica esta razão); só para tribunais de justiça estaduais'} />}
            </KpiGrid></div>
          </section>

          <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <div id="atividade" className="min-w-0 scroll-mt-24">
              <h2 className="text-2xl font-black">Movimentação processual</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Casos novos, baixados e pendentes no exercício — estes três números não se compensam automaticamente entre si.</p>
              <div className="mt-4"><TribunalIndicatorSeries tribunalId={tribunalId} indicatorId="JN_CASES_NEW_G1" title="Casos novos — 1º grau" /></div>
            </div>
            <div id="tempo" className="scroll-mt-24 space-y-4">
              <div className="rounded-2xl border bg-card p-5">
                <h3 className="text-lg font-black">Tempo e desempenho</h3>
                <dl className="mt-3 space-y-3">
                  {clearanceIdx != null && <div><dt className="text-xs font-bold text-muted-foreground">Índice de atendimento à demanda</dt><dd className="text-xl font-black">{clearanceIdx.toFixed(2)}</dd></div>}
                  {timeMean != null && <div><dt className="text-xs font-bold text-muted-foreground">Tempo médio dos baixados</dt><dd className="text-xl font-black">{timeMean} dias</dd></div>}
                  {congestionPct == null && clearanceIdx == null && timeMean == null && <JudiciaryAvailabilityNote availability="NOT_REPORTED" source="CNJ Justiça em Números" />}
                </dl>
                <p className="mt-4 text-xs leading-5 text-muted-foreground">Índice e tempo médio são apurados pelo próprio CNJ — não são uma divisão simples entre os KPIs acima.</p>
              </div>
              <Link href={`/judiciario/comparar?tribunal=${encodeURIComponent(tribunalId)}`} className="focus-ring block rounded-2xl bg-primary p-5 text-primary-foreground transition hover:bg-primary/90">
                <strong className="block">Comparar com outros tribunais</strong>
                <span className="mt-1 block text-sm text-white/80">Selecione tribunais do mesmo ramo para análise comparativa.</span>
              </Link>
            </div>
          </section>

          <section className="flex flex-wrap gap-3">
            <h2 className="sr-only">Em destaque</h2>
            <Link href="#estrutura" className="focus-ring min-w-[220px] flex-1 rounded-2xl border bg-card p-5 hover:border-primary sm:max-w-xs"><Building2 className="text-primary" aria-hidden /><strong className="mt-3 block">Estrutura e pessoas</strong><p className="mt-1 text-xs text-muted-foreground">{magistrates?.value_numeric != null ? `${int.format(Number(magistrates.value_numeric))} magistrados ativos` : 'Magistrados e unidades'}</p></Link>
            {(expenseTotal || financial?.facts?.length) && <Link href="#financas" className="focus-ring min-w-[220px] flex-1 rounded-2xl border bg-card p-5 hover:border-primary sm:max-w-xs"><Banknote className="text-primary" aria-hidden /><strong className="mt-3 block">Finanças</strong><p className="mt-1 text-xs text-muted-foreground">{expenseTotal?.value_numeric != null ? `${money.format(Number(expenseTotal.value_numeric))} em despesas (2025)` : 'Despesas publicadas'}</p></Link>}
            {themeChapters.length > 0 && <Link href="#temas" className="focus-ring min-w-[220px] flex-1 rounded-2xl border bg-card p-5 hover:border-primary sm:max-w-xs"><Gavel className="text-primary" aria-hidden /><strong className="mt-3 block">Assuntos</strong><p className="mt-1 text-xs text-muted-foreground">Principais classes e matérias deste tribunal</p></Link>}
          </section>

          <section id="estrutura" className="scroll-mt-24">
            <h2 className="text-2xl font-black">Estrutura</h2>
            <div className="mt-4"><KpiGrid>
              <KpiCard label="Magistrados atuantes" value={magistrates?.value_numeric != null ? int.format(Number(magistrates.value_numeric)) : '—'} coverage={coverageFor(magistrates?.value_numeric != null)} comparison={magistratesPer100k?.value_numeric != null ? peerHint('JN_MAGISTRATES_PER_100K', Number(magistratesPer100k.value_numeric), v => `${ratio1.format(v)}/100 mil hab.`) ?? `${ratio1.format(Number(magistratesPer100k.value_numeric))} por 100 mil habitantes` : null} />
              <KpiCard label="Pessoal efetivo" value={staff?.value_numeric != null ? int.format(Number(staff.value_numeric)) : '—'} coverage={coverageFor(staff?.value_numeric != null)} comparison={staffPer100k?.value_numeric != null ? peerHint('JN_STAFF_PER_100K', Number(staffPer100k.value_numeric), v => `${ratio1.format(v)}/100 mil hab.`) ?? `${ratio1.format(Number(staffPer100k.value_numeric))} por 100 mil habitantes` : null} />
              <KpiCard label="Unidades conhecidas" value={units.length ? int.format(units.length) : '—'} coverage={coverageFor(units.length > 0)} comparison={units.length ? `${units.filter(u => u.active).length} ativas` : 'sem unidades catalogadas'} />
            </KpiGrid></div>
            {pilotUnits.length > 0 && <p className="mt-3 text-xs leading-5 text-muted-foreground">{pilotUnits.length} unidades vêm de um piloto de correspondência territorial (TJBA/TJRJ) — cobertura parcial, não o cadastro oficial completo de varas.</p>}
          </section>

          {(expenseTotal || financial?.facts?.length || financial?.payroll?.length) && (() => {
            const facts = (financial?.facts ?? []) as Array<{ reference_year: number; reference_month: number | null; account: string; budget_stage: string; expense_category: string | null; amount_cents: string }>;
            const latestPeriod = facts.length ? facts.reduce((a, b) => (b.reference_year > a.reference_year || (b.reference_year === a.reference_year && (b.reference_month ?? 0) > (a.reference_month ?? 0))) ? b : a) : null;
            const latestFacts = latestPeriod ? facts.filter(f => f.reference_year === latestPeriod.reference_year && f.reference_month === latestPeriod.reference_month) : [];
            const byCategory = new Map<string, number>();
            for (const f of latestFacts) byCategory.set(f.expense_category ?? 'Sem categoria', (byCategory.get(f.expense_category ?? 'Sem categoria') ?? 0) + Number(f.amount_cents));
            const categoryBars = [...byCategory.entries()].sort((a, b) => b[1] - a[1]).map(([label, cents]) => ({ label, value: cents, display: money.format(cents / 100) }));
            const detailRows = latestFacts.slice().sort((a, b) => Number(b.amount_cents) - Number(a.amount_cents));
            const periodLabel = latestPeriod ? `${String(latestPeriod.reference_month).padStart(2, '0')}/${latestPeriod.reference_year}` : null;
            return (
              <section id="financas" className="scroll-mt-24">
                <h2 className="text-2xl font-black">Finanças</h2>
                {expenseTotal && <div className="mt-4"><KpiGrid>
                  <KpiCard label="Despesa total" value={expenseTotal.value_numeric != null ? money.format(Number(expenseTotal.value_numeric)) : '—'} coverage={generalCoverage} comparison={peerHint('JN_EXPENSE_TOTAL', Number(expenseTotal.value_numeric), v => money.format(v)) ?? 'CNJ Justiça em Números · 2025'} />
                  {expensePerCapita?.value_numeric != null && <KpiCard label="Despesa total por habitante" value={money.format(Number(expensePerCapita.value_numeric))} coverage={generalCoverage} comparison={peerHint('JN_EXPENSE_PER_CAPITA', Number(expensePerCapita.value_numeric), v => money.format(v)) ?? 'Razão oficial do CNJ (G7)'} />}
                  {revenueTotal?.value_numeric != null && <KpiCard label="Receita total" value={money.format(Number(revenueTotal.value_numeric))} coverage={generalCoverage} comparison={peerHint('JN_REVENUE_TOTAL', Number(revenueTotal.value_numeric), v => money.format(v))} />}
                  {expenseMagistrates?.value_numeric != null && <KpiCard label="Despesa com magistrados" value={money.format(Number(expenseMagistrates.value_numeric))} coverage={generalCoverage} comparison={stat('JN_EXPENSE_PER_MAGISTRATE')?.value_numeric != null ? `${money.format(Number(stat('JN_EXPENSE_PER_MAGISTRATE')!.value_numeric))} por magistrado (G10a, CNJ)` : magistrates?.value_numeric != null ? `${money.format(Number(expenseMagistrates.value_numeric) / Number(magistrates.value_numeric))} por magistrado` : null} />}
                  {expenseServers?.value_numeric != null && <KpiCard label="Despesa com servidores" value={money.format(Number(expenseServers.value_numeric))} coverage={generalCoverage} comparison={null} />}
                  {expenseBenefits?.value_numeric != null && <KpiCard label="Despesas com benefícios" value={money.format(Number(expenseBenefits.value_numeric))} coverage={generalCoverage} comparison={null} />}
                  {expenseOtherCurrent?.value_numeric != null && <KpiCard label="Outras despesas correntes" value={money.format(Number(expenseOtherCurrent.value_numeric))} coverage={generalCoverage} comparison={peerHint('JN_EXPENSE_OTHER_CURRENT', Number(expenseOtherCurrent.value_numeric), v => money.format(v))} />}
                </KpiGrid></div>}
                {categoryBars.length > 0 && (
                  <div className="mt-6 rounded-2xl border bg-card p-5">
                    <p className="text-sm font-bold">Despesa reportada por categoria{periodLabel ? ` — ${periodLabel}` : ''}</p>
                    <p className="mt-1 text-xs text-muted-foreground">Fonte: Anexo I da Resolução CNJ 102/2009, publicado pelo próprio tribunal — valor reportado do mês, não um total anual.</p>
                    <div className="mt-4"><BarList title="" rows={categoryBars} /></div>
                    <details className="mt-4 text-xs"><summary className="focus-ring w-fit cursor-pointer font-bold text-primary">Ver todas as {detailRows.length} linhas do mês</summary>
                      <div className="mt-2 overflow-x-auto"><table className="w-full min-w-[30rem] text-left text-sm"><thead><tr className="border-b text-muted-foreground"><th className="py-1.5 pr-3 font-semibold">Categoria</th><th className="py-1.5 pr-3 font-semibold">Conta</th><th className="py-1.5 pr-3 text-right font-semibold">Valor</th></tr></thead>
                        <tbody>{detailRows.map(f => <tr key={`${f.expense_category}-${f.account}`} className="border-b last:border-0"><td className="py-1.5 pr-3 text-muted-foreground">{f.expense_category ?? '—'}</td><td className="py-1.5 pr-3">{f.account}</td><td className="py-1.5 pr-3 text-right tabular-nums">{money.format(Number(f.amount_cents) / 100)}</td></tr>)}</tbody>
                      </table></div>
                    </details>
                  </div>
                )}
                {isStj && financial?.payroll?.length > 0 && (() => {
                  // Achado real: `financial.payroll` é 1 linha por mês×tipo_servidor×categoria_vínculo×situação,
                  // não 1 linha por mês — contar `.length` direto rotulava linhas como "meses" (nunca visível
                  // antes: P14.5 nunca chegou a exibir isto no frontend). Meses distintos é o número certo.
                  const months = new Set(financial.payroll.map((p: { reference_year: number; reference_month: number }) => `${p.reference_year}-${p.reference_month}`)).size;
                  return <p className="mt-4 text-xs leading-5 text-muted-foreground">Dado adicional só do STJ: folha agregada mensal (não individual), {months} meses publicados ({financial.payroll.length} linhas por categoria de vínculo) — valores mensais, não anuais.</p>;
                })()}
              </section>
            );
          })()}

          {personnel && (() => {
            const { overview, byCareer, suppliers } = personnel;
            const statusLabel: Record<string, string> = {
              ATIVO_ESTAVEL: 'Ativos estáveis', ATIVO_NAO_ESTAVEL: 'Ativos não-estáveis', VAGO: 'Cargos vagos', EXTINTO: 'Cargos extintos', INATIVO_APOSENTADO: 'Aposentados',
              OCUPADO_COM_VINCULO_OPTANTE: 'Ocupados (optante remuneração efetivo)', OCUPADO_COM_VINCULO_INTEGRAL: 'Ocupados (remuneração integral)', OCUPADO_SEM_VINCULO: 'Ocupados (sem vínculo efetivo)', TERCEIRIZADO_ATIVO: 'Terceirizados',
              EFETIVO: 'Efetivos', CEDIDO_OU_REQUISITADO: 'Cedidos ou requisitados', SEM_VINCULO_COMISSIONADO: 'Sem vínculo (comissionado)', OUTRO_UNIDADE_PRIVATIZADA: 'Unidade privatizada (terceirizados)',
              COMISSIONADO_TJFC1: 'Função comissionada — nível 1', COMISSIONADO_TJFC2: 'Função comissionada — nível 2', COMISSIONADO_TJFC3: 'Função comissionada — nível 3', COMISSIONADO_TJFC4: 'Função comissionada — nível 4', COMISSIONADO_TJFC5: 'Função comissionada — nível 5', COMISSIONADO_TJFC6: 'Função comissionada — nível 6',
              INSTITUIDOR_PENSAO: 'Instituidores de pensão (falecidos)', BENEFICIARIO_PENSAO: 'Beneficiários de pensão',
              COMISSIONADO_OPTANTE_REM_EFETIVO: 'Comissionado (optante remuneração efetivo)', COMISSIONADO_REM_INTEGRAL: 'Comissionado (remuneração integral)', COMISSIONADO_SEM_VINCULO: 'Comissionado (sem vínculo efetivo)',
              OCUPADO: 'Ocupados',
            };
            const annexLabel: Record<string, string> = { ANEXO_IV_A: 'Cargos efetivos', ANEXO_IV_B: 'Cargos em comissão', ANEXO_IV_E: 'Magistrados', ANEXO_VI: 'Terceirizados', ANEXO_V: 'Magistrados (em exercício)', TLP_1_GRAU: 'Lotação — 1º grau (atividade judicante)', TLP_ADMINISTRACAO: 'Lotação — administração' };
            // Fallback genérico pra status sem rótulo fixo em `statusLabel` (ex. cargo eslugado do Anexo V do
            // TJAM: "JUIZ_DE_DIREITO_DE_ENTRANCIA_FINAL" → "Juiz de direito de entrancia final") — nunca
            // mostra a chave crua em maiúsculas na tela.
            const humanizeStatus = (s: string) => s.toLowerCase().replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
            const byAnnex = new Map<string, Array<{ status: string; headcount: number }>>();
            for (const r of overview.byAnnexStatus) { const arr = byAnnex.get(r.source_annex) ?? []; arr.push({ status: r.status, headcount: r.headcount }); byAnnex.set(r.source_annex, arr); }
            // "Pessoas em cargos ocupados" soma só vínculos de base (mutuamente exclusivos entre si).
            // COMISSIONADO_TJFC1-6 é uma função ADICIONAL sobre uma pessoa já contada no vínculo de base dela
            // (mesma pessoa pode ser efetiva E exercer função comissionada — nunca contar 2x, igual ao aviso
            // de `transparencia_judiciario.md` §4.2.6) — por isso nunca soma na mesma conta, só aparece na
            // própria barra do Anexo/TLP. OUTRO_UNIDADE_PRIVATIZADA é força de trabalho terceirizada (unidade
            // privatizada), vai pro mesmo total de TERCEIRIZADO_ATIVO, não pro de "cargos ocupados".
            const BASE_OCCUPIED_STATUSES = new Set(['EFETIVO', 'CEDIDO_OU_REQUISITADO', 'SEM_VINCULO_COMISSIONADO']);
            const TERCEIRIZADO_STATUSES = new Set(['TERCEIRIZADO_ATIVO', 'OUTRO_UNIDADE_PRIVATIZADA']);
            // ANEXO_V (TJAM): o status aqui é o próprio cargo eslugado (DESEMBARGADOR, JUIZ_DE_PAZ...), não um
            // vocabulário fixo de ocupação — mas o parser já exclui vago/total/seção não investigada antes de
            // chegar aqui, então toda linha que sobra É gente em exercício, por desenho.
            const totalAtivos = overview.byAnnexStatus.filter(r => r.status.startsWith('ATIVO') || r.status.startsWith('OCUPADO') || BASE_OCCUPIED_STATUSES.has(r.status) || r.source_annex === 'ANEXO_V').reduce((s, r) => s + r.headcount, 0);
            const totalTerceirizados = overview.byAnnexStatus.filter(r => TERCEIRIZADO_STATUSES.has(r.status)).reduce((s, r) => s + r.headcount, 0);
            const period = overview.latestPeriod ? `${String(overview.latestPeriod.month).padStart(2, '0')}/${overview.latestPeriod.year}` : null;
            return (
              <section id="pessoal" className="scroll-mt-24">
                <h2 className="text-2xl font-black">Pessoal</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Quadro de pessoal publicado pelo próprio tribunal (Anexos da Resolução CNJ 102/2009){period ? `, referência ${period}` : ''} — contagem de cargos e vínculos, nunca remuneração individual.</p>
                <div className="mt-4"><KpiGrid>
                  <KpiCard label="Pessoas em cargos ocupados" value={int.format(totalAtivos)} coverage={generalCoverage} comparison={period} />
                  {totalTerceirizados > 0 && <KpiCard label="Terceirizados em exercício" value={int.format(totalTerceirizados)} coverage={generalCoverage} comparison={period} />}
                </KpiGrid></div>
                {[...byAnnex.entries()].map(([annex, rows]) => (
                  <div key={annex} className="mt-6 rounded-2xl border bg-card p-5">
                    <p className="text-sm font-bold">{annexLabel[annex] ?? annex}</p>
                    <div className="mt-3"><BarList title="" rows={rows.map(r => ({ label: statusLabel[r.status] ?? humanizeStatus(r.status), value: r.headcount, display: int.format(r.headcount) }))} /></div>
                  </div>
                ))}
                {suppliers.topSuppliers.length > 0 && (() => {
                  const fmtYm = (p: { year: number; month: number }) => `${String(p.month).padStart(2, '0')}/${p.year}`;
                  const period = suppliers.period;
                  const isRange = period && (period.from.year !== period.to.year || period.from.month !== period.to.month);
                  const periodLabel = period ? (isRange ? `${fmtYm(period.from)}–${fmtYm(period.to)}` : fmtYm(period.to)) : null;
                  return (
                    <div className="mt-6 rounded-2xl border bg-card p-5">
                      <p className="text-sm font-bold">Maiores fornecedores pagos{periodLabel ? ` — ${periodLabel}` : ''}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Valor efetivamente pago {isRange ? 'no período' : 'no mês'}, não o valor total do contrato — soma de todos os documentos de pagamento do fornecedor {isRange ? 'nesses meses' : 'nesse período'}.</p>
                      <div className="mt-4"><BarList title="" rows={suppliers.topSuppliers.map(s => ({ label: s.supplier_name, value: Number(s.amount_cents), display: `${money.format(Number(s.amount_cents) / 100)} · ${s.payments} pag.` }))} /></div>
                    </div>
                  );
                })()}
              </section>
            );
          })()}

          {themeChapters.length > 0 && (
            <section id="temas" className="scroll-mt-24">
              <h2 className="text-2xl font-black">Temas</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {themeChapters.map(({ themeId, result }) => (
                  <Link key={themeId} href={`/judiciario/temas/${themeId.toLowerCase()}?tribunal=${encodeURIComponent(tribunalId)}`} className="focus-ring rounded-2xl border bg-card p-4 hover:border-primary">
                    <strong className="block">{(result.data as any).meta?.title ?? themeId}</strong>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-primary">Ver indicadores deste tribunal <ArrowRight size={12} /></span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {isStj && stjOverview && (
            <section id="jurisprudencia" className="scroll-mt-24">
              <h2 className="text-2xl font-black">Jurisprudência</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Recorte parcial dos precedentes qualificados do STJ — {int.format((stjOverview.data as any).precedents)} precedentes, {int.format((stjOverview.data as any).processes)} vínculos de processo, {int.format((stjOverview.data as any).mirrors)} espelhos de acórdão e {int.format((stjOverview.data as any).decisions)} decisões. Não representa toda a jurisprudência do STJ.</p>
              {stjSample && (stjSample.data as any).items?.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {(stjSample.data as any).items.map((p: any) => (
                    <li key={p.precedent_id}><Link href={`/judiciario/stj/precedentes/${encodeURIComponent(p.precedent_id)}`} className="font-bold text-primary underline">{p.precedent_type ?? 'Precedente'} {p.precedent_number ?? ''}</Link> <span className="text-xs text-muted-foreground">{p.status}</span></li>
                  ))}
                </ul>
              )}
              <Link href="/judiciario/stj/precedentes" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver todos os precedentes <ArrowRight size={14} /></Link>
            </section>
          )}
          {isStf && stfOverview && (
            <section id="jurisprudencia" className="scroll-mt-24">
              <h2 className="text-2xl font-black">Jurisprudência</h2>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Temas de Repercussão Geral do STF — {int.format((stfOverview.data as any).temas)} temas, {int.format((stfOverview.data as any).withThesis)} com tese fixada, {int.format((stfOverview.data as any).withRepercussion)} com repercussão reconhecida. Só Repercussão Geral; súmulas vinculantes e outras jurisprudências do STF não foram coletadas nesta fase.</p>
              {stfSample && (stfSample.data as any).items?.length > 0 && (
                <ul className="mt-4 space-y-2">
                  {(stfSample.data as any).items.map((t: any) => (
                    <li key={t.tema_number}><Link href={`/judiciario/stf/temas/${t.tema_number}`} className="font-bold text-primary underline">Tema {t.tema_number}</Link> <span className="text-xs text-muted-foreground">{t.titulo ?? t.situation}</span></li>
                  ))}
                </ul>
              )}
              <Link href="/judiciario/stf/temas" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver todos os temas <ArrowRight size={14} /></Link>
              {stfJuris?.availability === 'AVAILABLE' && (
                <div className="mt-6 border-t pt-6">
                  <h3 className="text-lg font-black">Acórdãos e decisões monocráticas</h3>
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Busca pública de jurisprudência do STF — {int.format((stfJuris.data as any).acordaos)} acórdãos e {int.format((stfJuris.data as any).decisoes)} decisões monocráticas{(stfJuris.data as any).minAno && (stfJuris.data as any).maxAno ? `, ${(stfJuris.data as any).minAno}–${(stfJuris.data as any).maxAno}` : ''}.</p>
                  <Link href="/judiciario/stf/jurisprudencia" className="mt-4 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Buscar acórdãos e decisões <ArrowRight size={14} /></Link>
                </div>
              )}
            </section>
          )}
          {isStf && stfPayroll?.availability === 'AVAILABLE' && (() => {
            const payroll = stfPayroll.data as { ano: number; mes: number; ministros: number; assessores: number };
            const MES_NOMES = ['', 'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
            const referencia = `${MES_NOMES[payroll.mes]}/${payroll.ano}`;
            const payrollCoverage = toChartCoverage(stfPayroll.availability, `Referência ${referencia} · STF — divulgação voluntária de remuneração desde 2012`, { from: `${payroll.ano}-${String(payroll.mes).padStart(2, '0')}-01`, to: `${payroll.ano}-${String(payroll.mes).padStart(2, '0')}-28`, grain: 'month' });
            const items = ((stfRoster?.data as { items: any[] } | undefined)?.items ?? []);
            const ativos = items.filter(m => !String(m.situacao_funcional ?? '').startsWith('APOSENTADO'));
            const aposentados = items.filter(m => String(m.situacao_funcional ?? '').startsWith('APOSENTADO'));
            const somaBrutaAtivos = ativos.reduce((s, m) => s + Number(m.remuneracao_bruta ?? 0), 0);
            return (
              <section id="ministros" className="scroll-mt-24">
                <h2 className="text-2xl font-black">Ministros</h2>
                <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Remuneração mensal publicada pelo próprio STF, referência {referencia} — {int.format(payroll.ministros)} Ministros (ativos e aposentados) e {int.format(payroll.assessores)} Assessores de Ministro, nome a nome, com detalhamento oficial por rubrica.</p>

                {ativos.length > 0 && (
                  <>
                    <div className="mt-4"><KpiGrid>
                      <KpiCard label="Ministros em atividade" value={String(ativos.length)} coverage={payrollCoverage} comparison={referencia} />
                      <KpiCard label="Soma bruta mensal (em atividade)" value={money.format(somaBrutaAtivos)} coverage={payrollCoverage} comparison="antes de descontos individuais" />
                    </KpiGrid></div>
                    <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {ativos.map(m => (
                        <MinisterCard key={m.matricula} href={`/judiciario/stf/remuneracao/${m.matricula}`} nome={m.nomeDeGuerra ?? m.nome} fotoUrl={m.fotoUrl} situacao="Em atividade" remuneracaoBruta={m.remuneracao_bruta != null ? Number(m.remuneracao_bruta) : null} />
                      ))}
                    </div>
                  </>
                )}

                {aposentados.length > 0 && (
                  <details className="mt-8">
                    <summary className="focus-ring cursor-pointer text-sm font-bold text-primary">Ver {aposentados.length} Ministros aposentados que ainda constam na divulgação</summary>
                    <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                      {aposentados.map(m => (
                        <MinisterCard key={m.matricula} href={`/judiciario/stf/remuneracao/${m.matricula}`} nome={m.nomeDeGuerra ?? m.nome} fotoUrl={m.fotoUrl} situacao="Aposentado" remuneracaoBruta={m.remuneracao_bruta != null ? Number(m.remuneracao_bruta) : null} />
                      ))}
                    </div>
                  </details>
                )}

                <Link href="/judiciario/stf/remuneracao" className="mt-6 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver remuneração completa, com Assessores de Ministro e detalhamento por rubrica <ArrowRight size={14} /></Link>
              </section>
            );
          })()}

          <section id="metodologia" className="scroll-mt-24">
            <h2 className="text-2xl font-black">Metodologia</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Fórmula, universo, grau e regra de ausência de cada indicador oficial usado neste perfil.</p>
            <div className="mt-4 space-y-2">
              {statistics.filter(s => s.value_numeric != null).slice(0, 8).map(s => <MethodologyPanel key={s.indicator_id} indicator={s as unknown as IndicatorMethodology} summary={s.public_name} />)}
            </div>
          </section>
      </div>
    </main>
  );
}

async function TribunalIndicatorSeries({ tribunalId, indicatorId, title }: { tribunalId: string; indicatorId: string; title: string }) {
  const series = await loadJudiciaryTribunalSeries(tribunalId, indicatorId);
  const items = (series.data as any).items as Array<{ reference_year: number; value_numeric: string | null }>;
  if (!items.length) return <JudiciaryAvailabilityNote availability="NOT_REPORTED" source="CNJ Justiça em Números" />;
  const coverage = toChartCoverage(series.availability, 'CNJ Justiça em Números', { from: `${items[0]!.reference_year}-01-01`, to: `${items.at(-1)!.reference_year}-12-31`, grain: 'year' });
  // MultiLineChart (não LineChart) de propósito: LineChart rotula cada ponto com o valor, o que com 17 anos
  // de série vira sobreposição ilegível (achado real na captura de tela); MultiLineChart já não faz isso
  // (hover + tabela "ver dados"), mesmo padrão já usado com séries longas no panorama do Judiciário.
  return <MultiLineChart title={title} data={items.map(i => ({ label: String(i.reference_year), values: [{ label: title, value: i.value_numeric != null ? Number(i.value_numeric) : null, color: '#115b45' }] }))} coverage={coverage} />;
}
