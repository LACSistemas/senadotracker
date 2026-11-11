import Link from 'next/link';
import { ArrowRight, Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { KpiCard, KpiGrid } from '@/components/metrics';
import { SearchBar } from '@/components/data-controls';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { RankedBars } from '@/components/charts';
import { DataTable, type DataColumn } from '@/components/data-table';
import { JudiciaryAvailabilityNote, toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryStfGeneralJurisprudenceOverview, loadJudiciaryStfGeneralJurisprudenceRanking, loadJudiciaryStfGeneralJurisprudenceExplorer } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Jurisprudência do STF · Judiciário · Cívica', description: 'Acórdãos e decisões monocráticas do Supremo Tribunal Federal — busca por processo, relator e ano, com ementa e fonte oficial.' };

const int = new Intl.NumberFormat('pt-BR');
type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
type Row = { doc_id: string; processo_codigo_completo: string | null; classe_sigla: string | null; uf_sigla: string | null; relator_nome: string | null; julgamento_data: string | null; ementa_texto?: string | null; decisao_resumo?: string | null };

function pageUrl(params: Record<string, string | undefined>, page: number) {
  const q = new URLSearchParams(); Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); }); if (page > 1) q.set('pagina', String(page)); return `/judiciario/stf/jurisprudencia?${q}`;
}

export default async function StfJurisprudenciaPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const base = scalar(params.base) === 'decisao' ? 'decisao' as const : 'acordao' as const;
  const relator = scalar(params.relator);
  const anoRaw = scalar(params.ano) ? Number(scalar(params.ano)) : undefined;
  const ano = anoRaw && Number.isInteger(anoRaw) ? anoRaw : undefined;
  const q = scalar(params.q);
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [overview, ranking, explorer] = await Promise.all([
    loadJudiciaryStfGeneralJurisprudenceOverview(),
    loadJudiciaryStfGeneralJurisprudenceRanking(base),
    loadJudiciaryStfGeneralJurisprudenceExplorer({ base, ...(relator ? { relator } : {}), ...(ano ? { ano } : {}), ...(q ? { q } : {}), page, pageSize: 20 }),
  ]);

  if (overview.availability !== 'AVAILABLE') {
    return (
      <main id="conteudo" tabIndex={-1} className="page-shell py-12">
        <JudiciaryAvailabilityNote availability={overview.availability} source="STF — jurisprudencia.stf.jus.br" limitations={overview.provenance.limitations} />
      </main>
    );
  }
  const ov = overview.data as { acordaos: number; decisoes: number; minAno: number | null; maxAno: number | null };
  const rankItems = (ranking.data as { items: { relator_nome: string; casos: number }[] }).items.slice(0, 15)
    .map(r => ({ key: r.relator_nome, label: r.relator_nome, value: r.casos, href: pageUrl({ base, relator: r.relator_nome, ano: ano ? String(ano) : undefined, q }, 1) }));
  const data = explorer.data as { total: number; page: number; pageSize: number; items: Row[] };
  const coverage = toChartCoverage(explorer.availability, `${base === 'acordao' ? 'Acórdãos' : 'Decisões monocráticas'} · metadados + ${base === 'acordao' ? 'ementa completa' : 'resumo truncado'} · texto integral só na fonte oficial do STF`, { from: ov.minAno ? `${ov.minAno}-01-01` : null, to: ov.maxAno ? `${ov.maxAno}-12-31` : null, grain: 'year' });

  const columns: DataColumn<Row>[] = [
    { key: 'processo', header: 'Processo', render: r => <Link href={`/judiciario/stf/jurisprudencia/${base}/${encodeURIComponent(r.doc_id)}`} className="font-bold text-primary underline">{r.processo_codigo_completo ?? r.doc_id}</Link> },
    { key: 'classe', header: 'Classe', render: r => r.classe_sigla ?? '—' },
    { key: 'uf', header: 'UF', render: r => r.uf_sigla ?? '—' },
    { key: 'relator', header: 'Relator', render: r => r.relator_nome ?? '—' },
    { key: 'trecho', header: base === 'acordao' ? 'Ementa' : 'Resumo da decisão', render: r => <span className="line-clamp-2 text-sm">{(r.ementa_texto ?? r.decisao_resumo) || '—'}</span> },
    { key: 'julgamento', header: 'Julgamento', render: r => r.julgamento_data ? new Date(r.julgamento_data).toLocaleDateString('pt-BR') : '—' },
  ];

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="STF · Jurisprudência" title="Acórdãos e decisões monocráticas"
          description={<>Busca pública de jurisprudência do próprio Supremo Tribunal Federal — acórdãos de colegiado e decisões monocráticas, com ementa ou resumo e link para o inteiro teor oficial.</>}
          location={`${int.format(ov.acordaos)} acórdãos · ${int.format(ov.decisoes)} decisões monocráticas${ov.minAno && ov.maxAno ? ` · ${ov.minAno}–${ov.maxAno}` : ''}`} />
      </section>

      <section className="page-shell py-6">
        <KpiGrid>
          <KpiCard label="Acórdãos" value={int.format(ov.acordaos)} coverage={coverage} comparison="colegiado" />
          <KpiCard label="Decisões monocráticas" value={int.format(ov.decisoes)} coverage={coverage} comparison="relator individual" />
          <KpiCard label="Período coberto" value={ov.minAno && ov.maxAno ? `${ov.minAno}–${ov.maxAno}` : '—'} coverage={coverage} comparison={null} />
        </KpiGrid>
      </section>

      {rankItems.length > 0 && (
        <section className="page-shell py-6">
          <RankedBars title={`Casos por relator — ${base === 'acordao' ? 'acórdãos' : 'decisões monocráticas'} (top 15)`} items={rankItems} coverage={coverage} />
        </section>
      )}

      <section className="page-shell py-6">
        <SearchBar action="/judiciario/stf/jurisprudencia" defaultValue={q ?? ''} name="q" placeholder="Buscar por processo ou ementa/resumo…">
          <input type="hidden" name="pagina" value="1" />
          <NativeSelect name="base" defaultValue={base} className="h-12 rounded-full border px-3 text-sm sm:w-60">
            <option value="acordao">Acórdãos</option>
            <option value="decisao">Decisões monocráticas</option>
          </NativeSelect>
          <Input type="number" name="ano" defaultValue={ano ?? ''} placeholder="Ano" min={ov.minAno ?? 1892} max={ov.maxAno ?? new Date().getFullYear()} className="h-12 w-28 rounded-full" />
        </SearchBar>
        {relator && <p className="mt-3 text-sm">Filtrando por relator: <strong>{relator}</strong> · <Link href={pageUrl({ base, ano: ano ? String(ano) : undefined, q }, 1)} className="font-bold text-primary underline">limpar</Link></p>}
      </section>

      <section className="page-shell pb-16">
        <DataTable caption={`${base === 'acordao' ? 'Acórdãos' : 'Decisões monocráticas'} do STF`} columns={columns} rows={data.items} rowKey={r => r.doc_id} coverage={coverage}
          page={page} pageCount={Math.max(1, Math.ceil(data.total / 20))} pageHref={next => pageUrl({ base, relator, ano: ano ? String(ano) : undefined, q }, next)} />
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">
          <Scale className="mb-2" />
          <strong className="text-foreground">Por que não o texto integral?</strong>
          <p className="mt-2">O texto completo de 1,13 milhão de documentos passaria de 17GB — fora do orçamento deste banco. Guardamos metadados e {base === 'acordao' ? 'a ementa completa' : 'um resumo do início da decisão'}; o link de cada processo leva ao inteiro teor na fonte oficial do STF.</p>
          <a href="https://jurisprudencia.stf.jus.br" className="mt-3 inline-flex items-center gap-1 font-bold text-primary underline">Ver na fonte oficial (STF) <ArrowRight size={14} /></a>
        </div>
      </section>
    </main>
  );
}
