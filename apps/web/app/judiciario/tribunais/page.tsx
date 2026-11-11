import Link from 'next/link';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { SearchBar, FilterBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { toChartCoverage } from '@/components/judiciary/availability';
import { loadJudiciaryTribunalDirectory } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Tribunais · Judiciário · Cívica', description: 'Encontre e compare os tribunais do Poder Judiciário brasileiro por ramo, jurisdição e unidade da Federação, com indicadores, estrutura e recursos de cada instituição.' };

type Params = Record<string, string | string[] | undefined>;
const scalar = (v: string | string[] | undefined) => typeof v === 'string' ? v : undefined;
// Códigos reais de `jud_branch.code` (P14.1) — confirmados por consulta ao vivo; TST entra em TRABALHO,
// TSE em ELEITORAL e STM em SUPERIOR (cada superior sob seu próprio ramo, não um balde único "superiores").
const BRANCHES = [['ESTADUAL', 'Justiça Estadual'], ['FEDERAL', 'Justiça Federal'], ['TRABALHO', 'Justiça do Trabalho'], ['ELEITORAL', 'Justiça Eleitoral'], ['MILITAR', 'Justiça Militar Estadual'], ['SUPERIOR', 'Tribunais Superiores'], ['STF', 'STF'], ['CNJ', 'CNJ']] as const;
const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];
const SORTS = [['nome', 'Nome (A-Z)'], ['casos_novos', 'Casos novos (maior primeiro)'], ['congestionamento', 'Taxa de congestionamento (maior primeiro)']] as const;

function pageUrl(params: Record<string, string | undefined>, page: number) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v) q.set(k, v); });
  if (page > 1) q.set('pagina', String(page));
  return `/judiciario/tribunais?${q}`;
}

type Item = { tribunal_id: string; sigla: string; official_name: string; institutional_level: string; seat_uf: string | null; branch_code: string; branch_name: string; has_jn: boolean; has_finance: boolean; has_units: boolean; casos_novos: string | null; taxa_congestionamento: string | null };

export default async function TribunalDirectoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  const params = await searchParams;
  const search = scalar(params.busca)?.trim();
  const branchCode = scalar(params.ramo);
  const uf = scalar(params.uf)?.toUpperCase();
  const sortRaw = scalar(params.ordenar);
  const sort = sortRaw === 'casos_novos' || sortRaw === 'congestionamento' ? sortRaw : undefined;
  const rawPage = Number(scalar(params.pagina) ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;

  const [dir, ...branchCounts] = await Promise.all([
    loadJudiciaryTribunalDirectory({ ...(search ? { search } : {}), ...(branchCode ? { branchCode } : {}), ...(uf ? { uf } : {}), ...(sort ? { sort } : {}), page, pageSize: 20 }),
    ...BRANCHES.map(([code]) => loadJudiciaryTribunalDirectory({ branchCode: code, pageSize: 1 })),
  ]);
  const items = dir.items as Item[];
  const selected = { busca: search, ramo: branchCode, uf, ordenar: sort };
  const countByBranch = new Map(BRANCHES.map(([code], i) => [code, branchCounts[i]!.total]));

  const money = new Intl.NumberFormat('pt-BR');
  const columns: DataColumn<Item>[] = [
    { key: 'name', header: 'Tribunal', render: item => (
      <div>
        <Link href={`/judiciario/tribunais/${encodeURIComponent(item.tribunal_id)}`} className="font-bold text-primary underline">{item.sigla}</Link>
        <span className="block text-xs text-muted-foreground">{item.official_name}</span>
        {(item.institutional_level === 'CONTROL' || item.institutional_level === 'SUPERIOR') && <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700"><ShieldCheck size={10} aria-hidden /> {item.institutional_level === 'CONTROL' ? 'Órgão de controle' : 'Tribunal superior'}</span>}
      </div>
    ) },
    { key: 'branch', header: 'Ramo', render: item => item.branch_name },
    { key: 'uf', header: 'Jurisdição', render: item => item.seat_uf ?? '—' },
    { key: 'casos', header: 'Casos novos (2025)', align: 'right', render: item => item.casos_novos != null ? money.format(Number(item.casos_novos)) : '—' },
    { key: 'congestion', header: 'Taxa de congestionamento', align: 'right', render: item => item.taxa_congestionamento != null ? `${(Number(item.taxa_congestionamento) * 100).toFixed(1)}%` : '—' },
    { key: 'profile', header: <span className="sr-only">Perfil</span>, align: 'right', render: item => <Link href={`/judiciario/tribunais/${encodeURIComponent(item.tribunal_id)}`} className="inline-flex items-center gap-1 text-sm font-bold text-primary">Ver perfil <ArrowRight size={13} /></Link> },
  ];

  const coverage = toChartCoverage(dir.availability, `${dir.total} instituições no catálogo institucional, ano-base ${dir.year} — nem todas têm estatísticas Justiça em Números publicadas (STF e CNJ, por exemplo, não têm).`, { grain: 'snapshot' });

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="Instituições da Justiça" title="Encontre e compare tribunais." imageUrl="/judiciario-tribunais.svg"
          description="Explore os tribunais brasileiros por ramo, jurisdição e unidade da Federação. Acesse indicadores, estrutura, recursos e dados de cada instituição."
          location={`${dir.total} instituições catalogadas`} />
      </section>

      <section className="page-shell pb-3">
        <nav aria-label="Modo de exploração" className="flex gap-2 border-b">
          <span className="border-b-2 border-primary px-4 py-2.5 text-sm font-bold text-primary">Tribunais ({dir.total})</span>
          <Link href="/judiciario/comparar" className="px-4 py-2.5 text-sm font-bold text-muted-foreground hover:text-primary">Comparar tribunais</Link>
        </nav>
      </section>

      <section className="page-shell pb-6">
        <div className="max-w-xl"><SearchBar action="/judiciario/tribunais" defaultValue={search ?? ''} name="busca" placeholder="Buscar por sigla ou nome (ex.: TJES, TRF2, TST...)" /></div>
        <div className="mt-4"><FilterBar action="/judiciario/tribunais" fields={[
          { name: 'ramo', label: 'Ramo', value: branchCode ?? '', options: [{ value: '', label: `Todos (${dir.total})` }, ...BRANCHES.map(([v, l]) => ({ value: v, label: `${l} (${countByBranch.get(v) ?? 0})` }))] },
          { name: 'uf', label: 'UF / Jurisdição', value: uf ?? '', options: [{ value: '', label: 'Todas' }, ...UFS.map(u => ({ value: u, label: u }))] },
          { name: 'ordenar', label: 'Ordenar por', value: sort ?? 'nome', options: SORTS.map(([v, l]) => ({ value: v, label: l })) },
        ]}><input type="hidden" name="busca" value={search ?? ''} /></FilterBar></div>
      </section>

      <section className="page-shell pb-12">
        <DataTable caption="Diretório de tribunais" columns={columns} rows={items} rowKey={item => item.tribunal_id} coverage={coverage} page={page} pageCount={Math.max(1, Math.ceil(dir.total / 20))} pageHref={next => pageUrl(selected, next)} />
      </section>
    </main>
  );
}
