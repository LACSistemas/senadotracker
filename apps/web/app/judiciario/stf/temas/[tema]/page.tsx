import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { loadJudiciaryStfTemaDetail } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ tema: string }> };

export async function generateMetadata({ params }: Props) {
  const { tema } = await params; const r = await loadJudiciaryStfTemaDetail(tema);
  const t = r.data as any; return { title: t ? `Tema ${t.tema_number} · Repercussão Geral STF · Cívica` : 'Tema · Cívica' };
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : null; }

export default async function StfTemaDetailPage({ params }: Props) {
  const { tema } = await params;
  const result = await loadJudiciaryStfTemaDetail(tema);
  if (result.availability === 'NOT_REPORTED' || !result.data) notFound();
  const t = result.data as { tema_number: string; leading_case: string | null; relator_name: string | null; titulo: string | null; descricao: string | null; assuntos: string | null; manifestacao_url: string | null; acordao_search_url: string | null; has_repercussion: boolean | null; judgment_date: string | null; situation: string | null; thesis: string | null; thesis_date: string | null; observation: string | null };

  return (
    <main id="conteudo" tabIndex={-1} className="page-shell py-8">
      <Link href="/judiciario/stf/temas" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline"><ArrowLeft size={14} /> Temas de Repercussão Geral</Link>

      <header className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Tema {t.tema_number} · {t.situation ?? 'situação não informada'}{t.has_repercussion !== null && ` · ${t.has_repercussion ? 'repercussão reconhecida' : 'sem repercussão'}`}</p>
        <h1 className="display-title mt-2 text-3xl sm:text-4xl">{t.titulo ?? `Tema ${t.tema_number}`}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t.relator_name ?? 'Relator(a) não informado(a)'}{t.leading_case ? ` · leading case: ${t.leading_case}` : ''}{t.judgment_date ? ` · julgado em ${fmtDate(t.judgment_date)}` : ''}</p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-black">A questão</h2>
        <p className="mt-3 max-w-3xl text-base leading-7">{t.descricao ?? <span className="text-muted-foreground">Descrição não publicada pela fonte para este tema.</span>}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">A tese</h2>
        {t.thesis ? <p className="mt-3 max-w-3xl rounded-xl border bg-card p-5 text-base leading-7">{t.thesis}</p> : <div className="mt-3"><JudiciaryAvailabilityNote availability="NOT_REPORTED" source="STF — exportação pública de Repercussão Geral" limitations={['A tese ainda não foi fixada ou não foi publicada pela fonte para este tema — não é um resumo gerado, é a ausência real do campo.']} /></div>}
        {t.thesis_date && <p className="mt-3 text-sm text-muted-foreground">Tese fixada em {fmtDate(t.thesis_date)}.</p>}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">Histórico</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {t.leading_case && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Leading case</dt><dd className="mt-0.5">{t.leading_case}</dd></div>}
          {t.judgment_date && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Julgamento</dt><dd className="mt-0.5">{fmtDate(t.judgment_date)}</dd></div>}
          {t.assuntos && <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Assuntos</dt><dd className="mt-0.5">{t.assuntos}</dd></div>}
          {t.observation && <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Observação</dt><dd className="mt-0.5">{t.observation}</dd></div>}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">Fonte</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">STF — exportação pública de Repercussão Geral (portal.stf.jus.br). Este registro é um recorte estruturado do tema publicado pela fonte oficial; a tese e a descrição reproduzidas acima são exatamente o texto publicado pelo STF, nunca um resumo gerado.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm">
          {t.manifestacao_url && <a href={t.manifestacao_url} className="font-bold text-primary underline">Ver manifestação de repercussão geral →</a>}
          {t.acordao_search_url && <a href={t.acordao_search_url} className="font-bold text-primary underline">Buscar acórdão →</a>}
        </div>
      </section>
    </main>
  );
}
