import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, BarChart3, Building2, FileSearch, Landmark, Scale, Trophy, Users } from 'lucide-react';
import { Breadcrumb } from '@/components/breadcrumb';

export const metadata: Metadata = { title: 'Investigar · Cívica', description: 'Ferramentas para quem quer ir fundo: rankings, fornecedores, patrimônio, proposições e comparações.' };

const TOOLS = [
  { href: '/legislativo/rankings', icon: Trophy, title: 'Rankings', text: 'Quem gasta mais, vota mais, apresenta mais — sempre com o universo e o período explicados.' },
  { href: '/comparar', icon: Scale, title: 'Comparar parlamentares', text: 'Coloque duas ou mais pessoas lado a lado em custos, votos e atuação.' },
  { href: '/legislativo/fornecedores', icon: Building2, title: 'Fornecedores', text: 'Quem recebe dinheiro público do Senado e da Câmara, quanto e de quem.' },
  { href: '/legislativo/fornecedores/radar', icon: BarChart3, title: 'Radar de fornecedores', text: 'Padrões que merecem uma segunda olhada, sem acusar ninguém.' },
  { href: '/legislativo/fornecedores-parlamentares', icon: Users, title: 'Fornecedores por parlamentar', text: 'A rede de empresas que cada parlamentar pagou com a cota.' },
  { href: '/legislativo/patrimonio', icon: Landmark, title: 'Patrimônio declarado', text: 'Bens declarados ao TSE em cada eleição. Não é o patrimônio de hoje.' },
  { href: '/legislativo/proposicoes/explorar', icon: FileSearch, title: 'Proposições', text: 'Projetos por número, tema, tipo ou autoria, com a tramitação oficial.' },
] as const;

export default function InvestigarPage() {
  return <main id="conteudo" tabIndex={-1} className="hero-wash">
    <div className="page-shell py-10 sm:py-14">
      <Breadcrumb items={[{ label: 'Início', href: '/' }, { label: 'Investigar' }]} />
      <header className="mt-6 max-w-3xl">
        <p className="eyebrow">Ferramentas</p>
        <h1 className="prop-thesis mt-3 text-[clamp(2.2rem,5vw,3.6rem)]">Investigar os <em>dados</em></h1>
        <p className="mt-4 text-lg leading-8 text-muted-foreground">Para quem quer ir além do perfil de cada parlamentar. Todas as ferramentas usam apenas registros oficiais publicados e mostram o que não foi publicado como “—”.</p>
      </header>
      <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{TOOLS.map(tool => <li key={tool.href}>
        <Link href={tool.href} className="focus-ring card-lift flex h-full min-h-32 flex-col rounded-2xl border bg-card p-5 no-underline">
          <span className="grid size-10 place-items-center rounded-xl bg-secondary text-primary"><tool.icon size={18} aria-hidden="true" /></span>
          <strong className="mt-3 text-lg">{tool.title}</strong>
          <span className="mt-1 flex-1 text-sm leading-6 text-muted-foreground">{tool.text}</span>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary">Abrir <ArrowRight size={14} aria-hidden="true" /></span>
        </Link>
      </li>)}</ul>
    </div>
  </main>;
}
