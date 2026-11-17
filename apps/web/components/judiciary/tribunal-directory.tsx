import Link from 'next/link';
import { ShieldCheck } from 'lucide-react';
import type { DataCoverage } from '@senadotracker/domain';
import { SearchBar } from '@/components/data-controls';
import { DataTable, type DataColumn } from '@/components/data-table';
import { AutoSubmitSelect } from './auto-submit-select.tsx';

export interface DirectoryRow { tribunalId: string; sigla: string; officialName: string; branchName: string; seatUf: string | null; institutionalLevel: string; uf: string | null; congestionamento: string | null; processosNovos: string | null; magistrados: string | null; hrefProfile: string; hrefInspect: string }
export interface QuickAccessItem { sigla: string; officialName: string; href: string }

/** V1.1 (mandato "Diretório Imediato") — a entrega principal desta passada: busca, atalhos e uma
 * listagem real dos tribunais visíveis desde o 1º carregamento, sem exigir clique prévio. Reaproveita
 * `DataTable` (tabela no desktop, lista de cards no mobile, de graça) em vez de inventar um 2º
 * layout de linhas compactas. Nunca aparece junto do Canvas investigativo (mandato §4: os 2 caminhos
 * coexistem, mas cada tela mostra só um) — só a `page.tsx` decide qual dos 2 renderizar. */
export function TribunalDirectory({
  searchTerm, branchCode, uf, branches, ufs, quickAccess, rows, coverage, page, pageCount, pageHref, totalCatalog, filteredCount,
}: {
  searchTerm: string | null;
  branchCode: string | undefined;
  uf: string | undefined;
  branches: readonly (readonly [string, string])[];
  ufs: readonly string[];
  quickAccess: QuickAccessItem[];
  rows: DirectoryRow[];
  coverage: DataCoverage;
  page: number;
  pageCount: number;
  pageHref: (p: number) => string;
  totalCatalog: number;
  filteredCount: number;
}) {
  const columns: DataColumn<DirectoryRow>[] = [
    {
      key: 'tribunal', header: 'Tribunal', render: r => (
        <div className="flex items-start gap-2">
          {/* Bandeira derivada da sigla (Estadual/Eleitoral/Militar) — nunca de `seat_uf` (ausente pra
           * quase todo o catálogo, ver coluna "Jurisdição" abaixo); tribunais sem UF única (Federal,
           * Trabalho, Superiores, STF, CNJ) simplesmente não têm bandeira, nunca uma UF chutada. */}
          {r.uf && <img src={`/flags/${r.uf}.svg`} alt="" aria-hidden className="mt-0.5 size-4 shrink-0 rounded-full object-cover ring-1 ring-border" />}
          <span><Link href={r.hrefProfile} className="focus-ring font-bold text-primary underline-offset-2 hover:underline">{r.sigla}</Link> <span className="text-muted-foreground">{r.officialName}</span>{(r.institutionalLevel === 'CONTROL' || r.institutionalLevel === 'SUPERIOR') && <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[0.65rem] font-bold text-amber-700"><ShieldCheck size={10} aria-hidden /> {r.institutionalLevel === 'CONTROL' ? 'Órgão de controle' : 'Tribunal superior'}</span>}</span>
        </div>
      ),
    },
    { key: 'ramo', header: 'Ramo', render: r => <span className="text-muted-foreground">{r.branchName}</span> },
    { key: 'uf', header: 'Jurisdição', render: r => <span className="text-muted-foreground">{r.seatUf ?? '—'}</span> },
    { key: 'congestionamento', header: 'Congestionamento', align: 'right', render: r => <span className="tabular-nums">{r.congestionamento ?? '—'}</span> },
    { key: 'processosNovos', header: 'Processos novos', align: 'right', render: r => <span className="tabular-nums">{r.processosNovos ?? '—'}</span> },
    { key: 'magistrados', header: 'Magistrados', align: 'right', render: r => <span className="tabular-nums">{r.magistrados ?? '—'}</span> },
    { key: 'perfil', header: 'Perfil', align: 'right', render: r => <Link href={r.hrefProfile} className="focus-ring text-xs font-bold text-primary underline-offset-2 hover:underline">Ver perfil</Link> },
    { key: 'investigar', header: 'Investigar', align: 'right', render: r => <Link href={r.hrefInspect} className="focus-ring text-xs font-bold text-primary underline-offset-2 hover:underline">Inspecionar</Link> },
  ];

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border bg-card p-5">
        <div className="max-w-xl">
          <SearchBar action="/judiciario/tribunais" defaultValue={searchTerm ?? ''} name="busca" placeholder="Busque STF, TJSP, TJES, nome ou sigla...">
            {branchCode && <input type="hidden" name="ramo" value={branchCode} />}
            {uf && <input type="hidden" name="uf" value={uf} />}
          </SearchBar>
        </div>
        <form action="/judiciario/tribunais" className="mt-3 flex flex-wrap items-end gap-4">
          <input type="hidden" name="busca" value={searchTerm ?? ''} />
          <label className="text-xs font-bold text-muted-foreground">Ramo da Justiça
            <AutoSubmitSelect name="ramo" defaultValue={branchCode ?? ''} className="mt-1 w-40">
              <option value="">Todos</option>
              {branches.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </AutoSubmitSelect>
          </label>
          <label className="text-xs font-bold text-muted-foreground">UF / Jurisdição
            <AutoSubmitSelect name="uf" defaultValue={uf ?? ''} className="mt-1 w-24">
              <option value="">Todas</option>
              {ufs.map(u => <option key={u} value={u}>{u}</option>)}
            </AutoSubmitSelect>
          </label>
        </form>

        {quickAccess.length > 0 && (
          <div className="mt-4 border-t pt-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Acesso rápido (curadoria editorial)</p>
            <ul aria-label="Acesso rápido" className="mt-2 flex flex-wrap gap-2">
              {quickAccess.map(q => (
                <li key={q.sigla}>
                  <Link href={q.href} title={q.officialName} className="focus-ring inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold hover:border-primary hover:text-primary">{q.sigla}</Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <DataTable<DirectoryRow>
        caption={searchTerm || branchCode || uf ? `Diretório de tribunais — resultados do filtro atual` : 'Diretório de tribunais'}
        columns={columns}
        rows={rows}
        rowKey={r => r.tribunalId}
        coverage={coverage}
        page={page}
        pageCount={pageCount}
        pageHref={pageHref}
      />
      <p className="text-xs text-muted-foreground">
        {filteredCount === totalCatalog ? `${totalCatalog} instituições catalogadas.` : `${filteredCount} de ${totalCatalog} instituições catalogadas correspondem a este filtro.`}
      </p>
    </div>
  );
}
