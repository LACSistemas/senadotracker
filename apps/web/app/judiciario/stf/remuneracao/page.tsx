import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { MinisterCard } from '@/components/judiciary/minister-card';
import { loadJudiciaryStfPayrollSummary, loadJudiciaryStfPayrollRoster } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Remuneração de Ministros do STF · Judiciário · Cívica', description: 'Remuneração mensal de Ministros (ativos e aposentados) e de Assessores de Ministro do Supremo Tribunal Federal, com a divulgação oficial do próprio STF.' };

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const MES_NOMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
type Row = { matricula: string; nome: string; role: 'MINISTRO' | 'ASSESSOR_MINISTRO'; cargo_efetivo: string | null; cargo_comissionado: string | null; lotacao: string | null; situacao_funcional: string | null; remuneracao_bruta: string | null; remuneracao_liquida: string | null; nomeDeGuerra?: string; fotoUrl?: string };

export default async function StfRemuneracaoPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const roleFilter = scalar(params.cargo);
  const role = roleFilter === 'ministro' ? 'MINISTRO' as const : roleFilter === 'assessor' ? 'ASSESSOR_MINISTRO' as const : undefined;

  const [summary, roster] = await Promise.all([
    loadJudiciaryStfPayrollSummary(),
    loadJudiciaryStfPayrollRoster(role ? { role } : {}),
  ]);
  if (summary.availability !== 'AVAILABLE') {
    return (
      <main id="conteudo" tabIndex={-1} className="page-shell py-12">
        <JudiciaryAvailabilityNote availability={summary.availability} source="STF — Portal da Transparência" limitations={summary.provenance.limitations} />
      </main>
    );
  }
  const s = summary.data as { ano: number; mes: number; ministros: number; assessores: number; totalBrutoMinistros: string | null; totalLiquidoMinistros: string | null };
  const items = (roster.data as { items: Row[] }).items;
  const referencia = `${MES_NOMES[s.mes]}/${s.ano}`;
  const lastDay = new Date(s.ano, s.mes, 0).getDate();
  const mm = String(s.mes).padStart(2, '0');
  const coverage = toChartCoverage(roster.availability, `${items.length} pessoas · referência ${referencia} · STF — divulgação voluntária de remuneração desde 2012`, { from: `${s.ano}-${mm}-01`, to: `${s.ano}-${mm}-${String(lastDay).padStart(2, '0')}`, grain: 'month' });

  const ministros = items.filter(r => r.role === 'MINISTRO');
  const ativos = ministros.filter(r => !String(r.situacao_funcional ?? '').startsWith('APOSENTADO'));
  const aposentados = ministros.filter(r => String(r.situacao_funcional ?? '').startsWith('APOSENTADO'));
  const assessores = items.filter(r => r.role === 'ASSESSOR_MINISTRO');

  const assessorColumns: DataColumn<Row>[] = [
    { key: 'nome', header: 'Nome', render: r => <Link href={`/judiciario/stf/remuneracao/${r.matricula}`} className="font-bold text-primary underline">{r.nome}</Link> },
    { key: 'lotacao', header: 'Gabinete', render: r => <span className="text-sm">{r.lotacao ?? '—'}</span> },
    { key: 'bruto', header: 'Remuneração bruta', render: r => r.remuneracao_bruta != null ? money.format(Number(r.remuneracao_bruta)) : '—' },
    { key: 'liquido', header: 'Remuneração líquida', render: r => r.remuneracao_liquida != null ? money.format(Number(r.remuneracao_liquida)) : '—' },
  ];

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="STF · Portal da Transparência" title="Remuneração de Ministros e Assessores"
          description={<>Remuneração mensal publicada pelo próprio Supremo Tribunal Federal — divulgação voluntária de contracheques desde 2012. Recorte restrito a Ministros (ativos e aposentados) e a quem ocupa o cargo comissionado de Assessor de Ministro; não ao quadro de pessoal inteiro do Tribunal.</>}
          location={`Referência: ${referencia}`} />
      </section>

      <section className="page-shell py-6">
        <KpiGrid>
          <KpiCard label="Ministros (ativos e aposentados)" value={String(s.ministros)} coverage={coverage} comparison={referencia} />
          <KpiCard label="Assessores de Ministro" value={String(s.assessores)} coverage={coverage} comparison="cargo comissionado" />
          <KpiCard label="Soma bruta — Ministros" value={s.totalBrutoMinistros != null ? money.format(Number(s.totalBrutoMinistros)) : '—'} coverage={coverage} comparison={referencia} />
          <KpiCard label="Soma líquida — Ministros" value={s.totalLiquidoMinistros != null ? money.format(Number(s.totalLiquidoMinistros)) : '—'} coverage={coverage} comparison="após descontos individuais" />
        </KpiGrid>
        <div className="mt-4"><JudiciaryAvailabilityNote availability="AVAILABLE" source="STF — egesp-portal.stf.jus.br/transparencia" limitations={summary.provenance.limitations} /></div>
      </section>

      <section className="page-shell py-6">
        <FilterBar action="/judiciario/stf/remuneracao" fields={[
          { name: 'cargo', label: 'Cargo', value: roleFilter ?? '', options: [{ value: '', label: 'Todos' }, { value: 'ministro', label: 'Ministros' }, { value: 'assessor', label: 'Assessores de Ministro' }] },
        ]} />
      </section>

      {ministros.length > 0 && (
        <section className="page-shell pb-10">
          <h2 className="text-xl font-black">Ministros</h2>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {ativos.map(r => (
              <MinisterCard key={r.matricula} href={`/judiciario/stf/remuneracao/${r.matricula}`} nome={r.nomeDeGuerra ?? r.nome} fotoUrl={r.fotoUrl} situacao="Em atividade" remuneracaoBruta={r.remuneracao_bruta != null ? Number(r.remuneracao_bruta) : null} />
            ))}
          </div>
          {aposentados.length > 0 && (
            <details className="mt-6">
              <summary className="focus-ring cursor-pointer text-sm font-bold text-primary">Ver {aposentados.length} Ministros aposentados</summary>
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {aposentados.map(r => (
                  <MinisterCard key={r.matricula} href={`/judiciario/stf/remuneracao/${r.matricula}`} nome={r.nomeDeGuerra ?? r.nome} fotoUrl={r.fotoUrl} situacao="Aposentado" remuneracaoBruta={r.remuneracao_bruta != null ? Number(r.remuneracao_bruta) : null} />
                ))}
              </div>
            </details>
          )}
        </section>
      )}

      {assessores.length > 0 && (
        <section className="page-shell pb-16">
          <h2 className="text-xl font-black">Assessores de Ministro</h2>
          <div className="mt-4"><DataTable caption="Remuneração de Assessores de Ministro do STF" columns={assessorColumns} rows={assessores} rowKey={r => r.matricula} coverage={coverage} /></div>
        </section>
      )}

      <section className="border-t bg-card py-10">
        <div className="page-shell rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          <Scale className="mb-2" />
          <strong className="text-foreground">Por que líquido e bruto diferem tanto?</strong>
          <p className="mt-2">A remuneração líquida reflete descontos individuais — Imposto de Renda, contribuição previdenciária, pensões judiciais, consignações — que variam de pessoa para pessoa e não indicam tratamento desigual. O detalhamento completo por rubrica, exatamente como o STF publica, está na página de cada pessoa.</p>
          <a href="https://egesp-portal.stf.jus.br/transparencia/rendimento_folha" className="mt-3 inline-flex items-center gap-1 font-bold text-primary underline">Ver na fonte oficial (STF) <ArrowRight size={14} /></a>
        </div>
      </section>
    </main>
  );
}
