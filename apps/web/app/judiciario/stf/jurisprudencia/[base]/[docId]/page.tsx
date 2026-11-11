import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { loadJudiciaryStfGeneralJurisprudenceDoc } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ base: string; docId: string }> };
type Doc = {
  base: 'acordao' | 'decisao'; doc_id: string; processo_codigo_completo: string | null; classe_sigla: string | null; uf_sigla: string | null;
  relator_nome: string | null; orgao_julgador: string | null; is_repercussao_geral: boolean | null; is_decisao_presidencia: boolean | null;
  julgamento_data: string | null; publicacao_data: string | null; ementa_texto: string | null; decisao_resumo: string | null;
  inteiro_teor_url: string | null; dje_url: string | null;
};

function isValidBase(base: string): base is 'acordao' | 'decisao' { return base === 'acordao' || base === 'decisao'; }

export async function generateMetadata({ params }: Props) {
  const { base, docId } = await params;
  if (!isValidBase(base)) return { title: 'Jurisprudência · Cívica' };
  const result = await loadJudiciaryStfGeneralJurisprudenceDoc(docId, base);
  const d = result.data as Doc | null;
  return { title: d ? `${d.processo_codigo_completo ?? d.doc_id} · Jurisprudência STF · Cívica` : 'Jurisprudência · Cívica' };
}

export default async function StfJurisprudenciaDocPage({ params }: Props) {
  const { base, docId } = await params;
  if (!isValidBase(base)) notFound();
  const result = await loadJudiciaryStfGeneralJurisprudenceDoc(docId, base);
  if (result.availability !== 'AVAILABLE' || !result.data) notFound();
  const d = result.data as Doc;
  const texto = base === 'acordao' ? d.ementa_texto : d.decisao_resumo;

  return (
    <main id="conteudo" tabIndex={-1} className="page-shell py-8">
      <Link href="/judiciario/stf/jurisprudencia" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline"><ArrowLeft size={14} /> Jurisprudência do STF</Link>

      <header className="mt-6">
        <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">
          {base === 'acordao' ? 'Acórdão' : 'Decisão monocrática'}{d.classe_sigla ? ` · ${d.classe_sigla}` : ''}{d.uf_sigla ? ` · ${d.uf_sigla}` : ''}
          {d.is_repercussao_geral ? ' · Repercussão Geral' : ''}{d.is_decisao_presidencia ? ' · Presidência' : ''}
        </p>
        <h1 className="display-title mt-2 text-3xl sm:text-4xl">{d.processo_codigo_completo ?? d.doc_id}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {d.relator_nome ? `Relator(a): ${d.relator_nome}` : 'Relator(a) não informado'}{d.orgao_julgador ? ` · ${d.orgao_julgador}` : ''}
          {d.julgamento_data ? ` · julgado em ${new Date(d.julgamento_data).toLocaleDateString('pt-BR')}` : ''}
          {d.publicacao_data ? ` · publicado em ${new Date(d.publicacao_data).toLocaleDateString('pt-BR')}` : ''}
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-xl font-black">{base === 'acordao' ? 'Ementa' : 'Resumo da decisão'}</h2>
        {base === 'decisao' && <p className="mt-2 text-xs text-muted-foreground">Resumo truncado do início do texto — o teor completo está só na fonte oficial, linkada abaixo.</p>}
        <p className="mt-3 whitespace-pre-wrap rounded-2xl border bg-card p-5 text-sm leading-6">{texto || 'Sem texto disponível para este documento.'}</p>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        {d.inteiro_teor_url && <a href={d.inteiro_teor_url} className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold text-primary underline">Inteiro teor (STF) <ArrowRight size={14} /></a>}
        {d.dje_url && <a href={d.dje_url} className="inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-bold text-primary underline">Publicação no DJe <ArrowRight size={14} /></a>}
      </section>

      <section className="mt-10">
        <h2 className="text-xl font-black">Fonte</h2>
        <div className="mt-3"><JudiciaryAvailabilityNote availability="AVAILABLE" source="STF — jurisprudencia.stf.jus.br (busca pública de jurisprudência)" limitations={result.provenance.limitations} /></div>
      </section>
    </main>
  );
}
