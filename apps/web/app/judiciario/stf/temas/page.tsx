import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryStfOverview, loadJudiciaryStfTemas } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Repercussão Geral do STF · Judiciário · Cívica', description: 'Temas de repercussão geral julgados ou em julgamento pelo Supremo Tribunal Federal — título, tese fixada, relator e situação, com fonte oficial.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
const int = new Intl.NumberFormat('pt-BR');
type Tema = { tema_number: string; leading_case: string | null; relator_name: string | null; titulo: string | null; situation: string | null; has_repercussion: boolean | null; judgment_date: string | null; thesis: string | null };

function pageUrl(params: Record<string, string | undefined>, page: number) {
  const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); }); if (page > 1) q.set('pagina', String(page)); return `/judiciario/stf/temas?${q}`;
}

export default async function StfTemasExplorerPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const situation = scalar(params.situacao);
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [overview, result] = await Promise.all([
    loadJudiciaryStfOverview(),
    loadJudiciaryStfTemas({ ...(situation ? { situation } : {}), page, pageSize: 20 }),
  ]);
  const data = result.data as { total: number; page: number; pageSize: number; items: Tema[] };
  const ov = overview.data as { temas: number; withThesis: number; withRepercussion: number };

  const columns: DataColumn<Tema>[] = [
    { key: 'tema', header: 'Tema', render: t => <Link href={`/judiciario/stf/temas/${t.tema_number}`} className="font-bold text-primary underline">Tema {t.tema_number}</Link> },
    { key: 'titulo', header: 'Título', render: t => <span className="line-clamp-2 text-sm">{t.titulo ?? '—'}</span> },
    { key: 'leading', header: 'Leading case', render: t => t.leading_case ?? '—' },
    { key: 'relator', header: 'Relator', render: t => t.relator_name ?? '—' },
    { key: 'situacao', header: 'Situação', render: t => t.situation ?? '—' },
    { key: 'rg', header: 'Repercussão', render: t => t.has_repercussion === true ? 'Há' : t.has_repercussion === false ? 'Não há' : '—' },
  ];
  const coverage = toChartCoverage(result.availability, `${int.format(ov.temas)} temas, ${int.format(ov.withThesis)} com tese fixada — recorte de Repercussão Geral, não é toda a jurisprudência do STF.`, { grain: 'snapshot' });

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="STF · Repercussão Geral" title="Temas de repercussão geral" description="O mecanismo pelo qual o Supremo Tribunal Federal seleciona questões constitucionais para fixar uma tese que orienta todos os processos semelhantes no país — análogo aos recursos repetitivos do STJ."
          location={`${int.format(ov.temas)} temas · ${int.format(ov.withThesis)} com tese fixada · ${int.format(ov.withRepercussion)} com repercussão reconhecida`} />
      </section>
      <section className="page-shell py-6">
        <FilterBar action="/judiciario/stf/temas" fields={[
          { name: 'situacao', label: 'Situação', value: situation ?? '', options: [{ value: '', label: 'Todas' }, { value: 'Trânsito em Julgado', label: 'Trânsito em Julgado' }, { value: 'Em julgamento', label: 'Em julgamento' }, { value: 'Cancelado', label: 'Cancelado' }, { value: 'Acórdão de Repercussão Geral publicado', label: 'Acórdão de RG publicado' }] },
        ]} />
      </section>
      <section className="page-shell pb-16">
        <DataTable caption="Temas de Repercussão Geral do STF" columns={columns} rows={data.items} rowKey={t => t.tema_number} coverage={coverage} page={page} pageCount={Math.max(1, Math.ceil(data.total / 20))} pageHref={next => pageUrl({ situacao: situation }, next)} />
      </section>
      <section className="border-t bg-card py-10"><div className="page-shell rounded-2xl border border-dashed p-6 text-sm text-muted-foreground"><Scale className="mb-2" /><strong className="text-foreground">Repercussão Geral, não o acervo completo do STF.</strong><p className="mt-2">Súmulas vinculantes e outras formas de jurisprudência do STF não foram coletadas nesta fase.</p><Link href="/judiciario/stj/precedentes" className="mt-3 inline-flex items-center gap-1 font-bold text-primary underline">Ver precedentes do STJ <ArrowRight size={14} /></Link></div></section>
    </main>
  );
}
