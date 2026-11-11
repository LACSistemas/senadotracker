import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryStjPrecedents, loadJudiciaryStjOverview } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Precedentes do STJ · Judiciário · Cívica', description: 'Precedentes qualificados do Superior Tribunal de Justiça — questão, tese fixada, situação e processos vinculados, com fonte oficial.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
const int = new Intl.NumberFormat('pt-BR');
type Precedent = { precedent_id: string; precedent_type: string | null; precedent_number: string | null; status: string | null; judgment_date: string | null; first_affectation_date: string | null; organ_name: string | null; submitted_question: string | null };

function pageUrl(params: Record<string, string | undefined>, page: number) {
  const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); }); if (page > 1) q.set('pagina', String(page)); return `/judiciario/stj/precedentes?${q}`;
}

export default async function StjPrecedentExplorerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const status = scalar(params.situacao);
  const type = scalar(params.tipo);
  const year = scalar(params.ano) ? Number(scalar(params.ano)) : undefined;
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [overview, result] = await Promise.all([
    loadJudiciaryStjOverview(),
    loadJudiciaryStjPrecedents({ ...(status ? { status } : {}), ...(type ? { type } : {}), ...(year ? { year } : {}), page, pageSize: 20 }),
  ]);
  const data = result.data as { total: number; page: number; pageSize: number; items: Precedent[] };
  const ov = overview.data as { precedents: number; processes: number; mirrors: number; decisions: number; distinctProcessCount: number };

  const columns: DataColumn<Precedent>[] = [
    { key: 'id', header: 'Precedente', render: p => <Link href={`/judiciario/stj/precedentes/${encodeURIComponent(p.precedent_id)}`} className="font-bold text-primary underline">{p.precedent_type ?? 'Precedente'} {p.precedent_number ?? p.precedent_id.replace('STJ:PRECEDENT:', '')}</Link> },
    { key: 'question', header: 'Questão submetida', render: p => <span className="line-clamp-2 text-sm">{p.submitted_question ?? '—'}</span> },
    { key: 'status', header: 'Situação', render: p => p.status ?? '—' },
    { key: 'organ', header: 'Órgão', render: p => p.organ_name ?? '—' },
    { key: 'date', header: 'Julgamento', render: p => p.judgment_date ? new Date(p.judgment_date).toLocaleDateString('pt-BR') : (p.first_affectation_date ? `afetado em ${new Date(p.first_affectation_date).toLocaleDateString('pt-BR')}` : '—') },
  ];
  const coverage = toChartCoverage(result.availability, `Recorte parcial: ${int.format(ov.mirrors)} espelhos de acórdão e ${int.format(ov.decisions)} decisões — não é toda a jurisprudência do STJ.`, { grain: 'snapshot' });

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="STJ · Jurisprudência" title="Precedentes qualificados" description="Teses fixadas pelo Superior Tribunal de Justiça em recursos repetitivos, incidentes de resolução de demandas repetitivas e controvérsias — o que orienta decisões em milhares de processos semelhantes."
          location={`${int.format(ov.precedents)} precedentes · ${int.format(ov.processes)} vínculos de processo · ${int.format(ov.distinctProcessCount)} processos distintos`} />
      </section>
      <section className="page-shell py-6">
        <div className="max-w-xl"><SearchBar action="/judiciario/stj/precedentes" defaultValue="" name="busca" placeholder="Buscar por tipo ou número..." /></div>
        <div className="mt-4"><FilterBar action="/judiciario/stj/precedentes" fields={[
          { name: 'situacao', label: 'Situação', value: status ?? '', options: [{ value: '', label: 'Todas' }, { value: 'Vinculada a Tema', label: 'Vinculada a Tema' }, { value: 'Suspensão indeferida', label: 'Suspensão indeferida' }] },
          { name: 'tipo', label: 'Tipo', value: type ?? '', options: [{ value: '', label: 'Todos' }, { value: 'Controvérsia', label: 'Controvérsia' }, { value: 'SIRDR', label: 'SIRDR' }] },
        ]} /></div>
      </section>
      <section className="page-shell pb-16">
        <DataTable caption="Precedentes qualificados do STJ" columns={columns} rows={data.items} rowKey={p => p.precedent_id} coverage={coverage} page={page} pageCount={Math.max(1, Math.ceil(data.total / 20))} pageHref={next => pageUrl({ situacao: status, tipo: type, ano: year ? String(year) : undefined }, next)} />
      </section>
      <section className="border-t bg-card py-10"><div className="page-shell rounded-2xl border border-dashed p-6 text-sm text-muted-foreground"><Scale className="mb-2" /><strong className="text-foreground">Recorte, não o acervo completo.</strong><p className="mt-2">231 espelhos de acórdão e 2.644 decisões cobrem uma janela parcial — nem todo precedente tem um espelho ou decisão vinculada publicados aqui.</p><Link href="/judiciario/temas" className="mt-3 inline-flex items-center gap-1 font-bold text-primary underline">Ver outros temas <ArrowRight size={14} /></Link></div></section>
    </main>
  );
}
