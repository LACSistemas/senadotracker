import Link from 'next/link';
import { ArrowRight, FileQuestion, Gavel, HeartCrack, Info, Scale } from 'lucide-react';
import { InstitutionHero } from '@/components/heroes';
import { loadJudiciaryThemesCatalog, loadJudiciaryThemeOverview } from '@/lib/judiciary-themes';
import type { JudiciaryThemeId } from '@senadotracker/db';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Temas · Judiciário · Cívica', description: 'Execução fiscal, violência doméstica, justiça criminal e outros recortes temáticos do Judiciário brasileiro, com fonte e metodologia oficiais.' };

const int = new Intl.NumberFormat('pt-BR');
type ThemeMeta = { themeId: string; title: string; description: string; status: string; officialSource: string; notes: string[]; indicatorCount: number };
const DESTAQUE_IDS: JudiciaryThemeId[] = ['TAX_EXECUTION', 'DOMESTIC_VIOLENCE', 'CONCILIATION'];
const DESTAQUE_ICON: Partial<Record<JudiciaryThemeId, typeof Scale>> = { TAX_EXECUTION: Gavel, DOMESTIC_VIOLENCE: HeartCrack, CONCILIATION: Scale };

export default async function JudiciaryThemesHubPage() {
  const themes = await loadJudiciaryThemesCatalog();
  const data = themes.data as ThemeMeta[];
  // indicatorCount=0 nunca vira card com número: LABOR tem status PARTIAL_COVERAGE mas 0 indicadores
  // próprios nesta revisão (o texto já explica isso) — sem a contagem, é tema em investigação de verdade.
  const real = data.filter(t => (t.status === 'AVAILABLE' || t.status === 'PARTIAL_COVERAGE') && t.indicatorCount > 0);
  const documentary = data.filter(t => !((t.status === 'AVAILABLE' || t.status === 'PARTIAL_COVERAGE') && t.indicatorCount > 0));

  const headlines = await Promise.all(real.map(async t => {
    const overview = await loadJudiciaryThemeOverview(t.themeId as JudiciaryThemeId, { year: 2025 });
    const metrics = (overview.data as any).metrics as Array<{ indicator_id: string; public_name: string; aggregation_allowed: string; value: string | null; metric_availability: string }>;
    const headline = metrics?.find(m => m.aggregation_allowed === 'SUM' && m.value != null) ?? metrics?.[0] ?? null;
    return { themeId: t.themeId, headline };
  }));
  const headlineByTheme = new Map(headlines.map(h => [h.themeId, h.headline]));
  const totalIndicators = real.reduce((s, t) => s + t.indicatorCount, 0);

  return (
    <main id="conteudo" tabIndex={-1}>
      <section className="page-shell py-8">
        <InstitutionHero context="Justiça · Temas" title="Quais conflitos mobilizam a Justiça brasileira?" imageUrl="/judiciario-temas.svg"
          description="Explore os principais assuntos que chegam aos tribunais, com dados oficiais, evolução no tempo e recortes por ramo e instituição."
          location={`${totalIndicators} indicadores oficiais em ${real.length} temas`} />
      </section>

      <section className="page-shell py-10">
        <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
          <nav aria-label="Temas" className="space-y-1 text-sm">
            <span className="block rounded-lg bg-secondary px-3 py-2 font-bold text-primary">Visão geral</span>
            {real.map(t => <Link key={t.themeId} href={`/judiciario/temas/${t.themeId.toLowerCase()}`} className="focus-ring block rounded-lg px-3 py-2 font-semibold text-muted-foreground hover:bg-secondary/60 hover:text-foreground">{t.title}</Link>)}
          </nav>

          <div>
            <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
              <div>
                <h2 className="text-xl font-black">Visão geral dos temas</h2>
                <p className="mt-1 text-sm text-muted-foreground">Cada tema usa seu próprio indicador principal — eles não compartilham um mesmo total nacional (ver nota ao lado), por isso aparecem lado a lado, nunca como fatias de um mesmo todo.</p>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {real.map(t => {
                    const h = headlineByTheme.get(t.themeId);
                    return (
                      <Link key={t.themeId} href={`/judiciario/temas/${t.themeId.toLowerCase()}`} className="focus-ring group rounded-2xl border bg-card p-4 transition hover:border-primary">
                        <strong className="block text-sm leading-tight">{t.title}</strong>
                        {h ? (
                          <>
                            <p className="mt-2 text-2xl font-black tabular-nums">{h.value != null ? int.format(Number(h.value)) : '—'}</p>
                            <p className="mt-0.5 text-xs text-muted-foreground">{h.public_name}</p>
                          </>
                        ) : <p className="mt-2 text-sm text-muted-foreground">Sem indicador principal elegível</p>}
                      </Link>
                    );
                  })}
                </div>
              </div>
              <aside className="h-fit rounded-2xl border bg-card p-5">
                <Info className="text-primary" aria-hidden />
                <h3 className="mt-2 text-sm font-black">Sobre os dados</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Cada tema usa a métrica oficial que o CNJ realmente publica para aquele assunto — a maioria é "processos baixados", um é "casos novos", outro é um índice. Eles não são partes de um mesmo total nacional: somá-los produziria um número sem significado.</p>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">Fonte: CNJ — Justiça em Números (edição 2026).</p>
              </aside>
            </div>

            <div className="mt-10">
              <h2 className="text-xl font-black">Temas em destaque</h2>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                {DESTAQUE_IDS.filter(id => real.some(t => t.themeId === id)).map(id => {
                  const t = real.find(x => x.themeId === id)!;
                  const h = headlineByTheme.get(id);
                  const Icon = DESTAQUE_ICON[id] ?? Scale;
                  return (
                    <Link key={id} href={`/judiciario/temas/${id.toLowerCase()}`} className="focus-ring group rounded-2xl border bg-card p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
                      <Icon className="text-primary" aria-hidden />
                      <strong className="mt-3 block">{t.title}</strong>
                      <p className="mt-1 text-sm text-muted-foreground">{h?.value != null ? `${int.format(Number(h.value))} — ${h.public_name.toLowerCase()}` : t.description}</p>
                      <span className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-primary">Ver tema <ArrowRight size={12} className="transition group-hover:translate-x-1" /></span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-t bg-card py-10">
        <div className="page-shell">
          <h2 className="text-xl font-black">Todos os temas</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {real.map(t => (
              <Link key={t.themeId} href={`/judiciario/temas/${t.themeId.toLowerCase()}`} className="focus-ring group flex flex-col rounded-2xl border bg-background p-5 transition hover:-translate-y-0.5 hover:border-primary hover:shadow-sm">
                <strong className="text-lg leading-tight">{t.title}</strong>
                <p className="mt-2 flex-1 text-sm leading-6 text-muted-foreground">{t.description}</p>
                <div className="mt-4 flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">{t.indicatorCount} indicadores · {t.officialSource}</span>
                  <span className="inline-flex items-center gap-1 font-bold text-primary">Explorar <ArrowRight size={13} className="transition group-hover:translate-x-1" /></span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {documentary.length > 0 && (
        <section className="py-10">
          <div className="page-shell">
            <h2 className="flex items-center gap-2 text-xl font-bold"><FileQuestion size={18} className="text-muted-foreground" aria-hidden /> Temas em investigação</h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Fontes e metodologia já identificadas, mas sem fatos estruturados elegíveis publicados nesta revisão — não aparecem como números porque ainda não há dado para mostrar com segurança.</p>
            <ul className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {documentary.map(t => (
                <li key={t.themeId} className="rounded-xl border border-dashed p-4"><strong className="block text-sm">{t.title}</strong><p className="mt-1 text-xs leading-5 text-muted-foreground">{t.notes[0] ?? t.description}</p></li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </main>
  );
}
