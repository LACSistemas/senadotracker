import Link from 'next/link';
import { ArrowUpRight, Landmark, Search } from 'lucide-react';

const EXPLORE = '/legislativo/proposicoes/explorar';
const STARTS = [
  { href: `${EXPLORE}?tema=${encodeURIComponent('Saúde')}`, title: 'Por assunto', text: 'Proposições com tema Saúde na cobertura disponível' },
  { href: `${EXPLORE}?grupo=requerimentos`, title: 'Por tipo de atividade', text: 'Requerimentos, emendas e pareceres' },
  { href: `${EXPLORE}?casa=camara`, title: 'Por Casa', text: 'Comece pela Câmara ou pelo Senado' },
] as const;

/** Fecha a página levando ao explorador. O href é ASCII e aponta para a rota real (sem acento, sem duplicar /legislativo). */
export function ExploreCta() {
  return <section id="explorar" className="band-gradient text-white" aria-labelledby="explorar-titulo">
    <div className="page-shell py-16 lg:py-20">
      <p className="eyebrow text-emerald-200">07 · continue</p>
      <h2 id="explorar-titulo" className="prop-h2 mt-3 max-w-3xl text-4xl sm:text-5xl">Agora investigue uma proposição por conta própria.</h2>
      <p className="mt-4 max-w-2xl text-lg leading-8 text-emerald-50/85">Escolha uma Casa, um grupo, um tema ou uma matéria e abra os dados publicados.</p>
      <Link href={EXPLORE} className="focus-ring mt-8 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-emerald-950 transition-transform hover:-translate-y-0.5">Explorar todas as proposições <Search size={17} aria-hidden="true" /></Link>
      <ul className="mt-12 grid gap-4 md:grid-cols-3">{STARTS.map(start => <li key={start.href}><Link href={start.href} className="focus-ring group block h-full rounded-2xl border border-white/20 bg-white/[.07] p-5 transition-colors hover:bg-white/[.13]">
        <p className="flex items-center justify-between text-sm font-bold">{start.title}<ArrowUpRight size={16} className="opacity-70 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" /></p>
        <p className="mt-2 text-sm leading-6 text-emerald-50/80">{start.text}</p></Link></li>)}</ul>
      <p className="mt-12 flex items-center gap-2 text-sm text-emerald-100/70"><Landmark size={14} aria-hidden="true" /> Metodologia e cobertura acompanham cada publicação.</p>
    </div>
  </section>;
}
