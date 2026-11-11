import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { loadJudiciaryStjPrecedentDetail } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props) {
  const { id } = await params; const r = await loadJudiciaryStjPrecedentDetail(decodeURIComponent(id));
  const p = (r.data as any)?.precedent; return { title: p ? `${p.precedent_type ?? 'Precedente'} ${p.precedent_number ?? ''} · STJ · Cívica` : 'Precedente · Cívica' };
}

function fmtDate(d: string | null) { return d ? new Date(d).toLocaleDateString('pt-BR') : null; }

export default async function StjPrecedentDetailPage({ params }: Props) {
  const { id } = await params; const precedentId = decodeURIComponent(id);
  const result = await loadJudiciaryStjPrecedentDetail(precedentId);
  if (result.availability === 'NOT_REPORTED' || !result.data) notFound();
  const { precedent, processes, relations } = result.data as { precedent: any; processes: any[]; relations: any[] };

  return (
    <main id="conteudo" tabIndex={-1} className="page-shell py-8">
      <Link href="/judiciario/stj/precedentes" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline"><ArrowLeft size={14} /> Precedentes do STJ</Link>

      <header className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{precedent.precedent_type ?? 'Precedente'} {precedent.precedent_number ?? ''} · {precedent.status ?? 'sem situação publicada'}</p>
        <h1 className="display-title mt-2 text-3xl sm:text-4xl">{precedent.submitted_question ? precedent.submitted_question.slice(0, 140) : `Precedente ${precedent.precedent_id.replace('STJ:PRECEDENT:', '')}`}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{precedent.organ_name ?? 'Órgão não identificado'}{precedent.judgment_date ? ` · julgado em ${fmtDate(precedent.judgment_date)}` : precedent.first_affectation_date ? ` · afetado em ${fmtDate(precedent.first_affectation_date)}` : ''}</p>
      </header>

      <section className="mt-10">
        <h2 className="text-xl font-black">A questão</h2>
        <p className="mt-3 max-w-3xl text-base leading-7">{precedent.submitted_question ?? <span className="text-muted-foreground">Questão submetida não publicada pela fonte para este precedente.</span>}</p>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">A tese</h2>
        {precedent.fixed_thesis ? <p className="mt-3 max-w-3xl rounded-xl border bg-card p-5 text-base leading-7">{precedent.fixed_thesis}</p> : <div className="mt-3"><JudiciaryAvailabilityNote availability="NOT_REPORTED" source="STJ Dados Abertos" limitations={['A tese ainda não foi fixada ou não foi publicada pela fonte para este precedente — não é um resumo gerado, é a ausência real do campo.']} /></div>}
        {precedent.previous_understanding && <p className="mt-3 max-w-3xl text-sm text-muted-foreground"><strong>Entendimento anterior:</strong> {precedent.previous_understanding}</p>}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">Histórico</h2>
        <dl className="mt-3 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {precedent.first_affectation_date && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Afetação</dt><dd className="mt-0.5">{fmtDate(precedent.first_affectation_date)}</dd></div>}
          {precedent.judgment_date && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Julgamento</dt><dd className="mt-0.5">{fmtDate(precedent.judgment_date)}</dd></div>}
          {precedent.publication_date && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Publicação</dt><dd className="mt-0.5">{fmtDate(precedent.publication_date)}</dd></div>}
          {precedent.legislative_reference && <div><dt className="text-xs font-bold uppercase text-muted-foreground">Referência legislativa</dt><dd className="mt-0.5">{precedent.legislative_reference}</dd></div>}
          {precedent.subjects && <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Assuntos</dt><dd className="mt-0.5">{precedent.subjects}</dd></div>}
          {precedent.stf_general_repercussion_number && <div className="sm:col-span-2"><dt className="text-xs font-bold uppercase text-muted-foreground">Repercussão geral STF</dt><dd className="mt-0.5">{precedent.stf_general_repercussion_number} — {precedent.stf_general_repercussion_description}</dd></div>}
        </dl>
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">Processos vinculados ({processes.length})</h2>
        {processes.length ? (
          <ul className="mt-3 divide-y rounded-xl border">
            {processes.slice(0, 30).map(p => (
              <li key={p.process_id} className="p-4 text-sm">
                <p className="font-bold">{p.process_label ?? p.registration_number ?? p.process_id}{p.leading_case && <span className="ml-2 rounded-full bg-[#115b45]/10 px-2 py-0.5 text-[0.65rem] font-bold text-[#115b45]">processo paradigma</span>}</p>
                <p className="mt-1 text-muted-foreground">{p.relator_name ? `Relator(a): ${p.relator_name}` : 'Relator(a) não informado(a)'}{p.origin_court ? ` · origem: ${p.origin_court_sigla ?? p.origin_court}` : ''}{p.origin_uf ? ` (${p.origin_uf})` : ''}</p>
              </li>
            ))}
          </ul>
        ) : <JudiciaryAvailabilityNote availability="NOT_REPORTED" source="STJ Dados Abertos" limitations={['Nenhum processo vinculado publicado para este precedente nesta revisão.']} />}
        {processes.length > 30 && <p className="mt-2 text-xs text-muted-foreground">Mostrando 30 de {processes.length} processos vinculados.</p>}
      </section>

      {relations.length > 0 && (
        <section className="mt-10">
          <h2 className="text-xl font-black">Referências relacionadas</h2>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">{relations.map(r => <li key={r.relation_id}>{r.relation_kind}: {r.source_type} {r.source_id} → {r.target_type} {r.target_id} <span className="text-xs">({r.match_status === 'OFFICIAL_ID' ? 'ID oficial' : r.match_status === 'OFFICIAL_REFERENCE' ? 'referência oficial' : 'não resolvido'})</span></li>)}</ul>
        </section>
      )}

      <section className="mt-10 border-t pt-6">
        <h2 className="text-xl font-black">Fonte</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">STJ Dados Abertos — precedentes qualificados. Este registro é um recorte estruturado do precedente publicado pela fonte oficial; a tese e a questão reproduzidas acima são exatamente o texto publicado pelo STJ, nunca um resumo gerado.</p>
      </section>
    </main>
  );
}
