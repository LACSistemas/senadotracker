import Link from 'next/link';
import Image from 'next/image';

/** Logos das fontes de dado do Cívica como um todo (não de uma página específica). Pedido real do
 * usuário: "esses logos são pra todas as páginas, é pra fontes do Cívica as a whole" — e depois "temos
 * muito mais sources que isso, olhe todos nossos collectors", daí a lista cobrir os 3 poderes + agências
 * federais + 3 fontes internacionais, levantada a partir do que os coletores em `apps/collector/src/exec/`
 * e `apps/collector/src/` realmente usam (TSE/eleições, Siconfi/Tesouro, INEP, CNES/Saúde, PNCP→AGU não
 * encontrado com licença clara então omitido, trânsito/DNIT, mineração/ANM, energia/ANEEL, transparência/CGU).
 * Logos do Wikimedia Commons marcados `PD-textlogo`/CC0/CC-BY como domínio público ou de uso livre com
 * atribuição (mesmo padrão já usado pro TSE); PNUD/OCDE mantidos como estavam (uso de marca de terceiro,
 * sem tag de domínio público — por isso mantidos pequenos e com atribuição visível via link). Com 18 fontes
 * a faixa não cabe numa linha só: ela desliza (ver `.source-logos-track` em app/globals.css), pausa no
 * hover/foco, e nunca anima se o usuário pede `prefers-reduced-motion` (fica estática, com quebra de linha). */
const SOURCE_LOGOS = [
  { name: 'Senado Federal', href: 'https://www12.senado.leg.br/dados-abertos/', src: '/source-logos/senado.png' },
  { name: 'Câmara dos Deputados', href: 'https://dadosabertos.camara.leg.br/', src: '/source-logos/camara.png' },
  { name: 'STF', href: 'https://portal.stf.jus.br/', src: '/source-logos/stf.svg' },
  { name: 'STJ', href: 'https://www.stj.jus.br/', src: '/source-logos/stj.svg' },
  { name: 'CNJ', href: 'https://www.cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/', src: '/source-logos/cnj.png' },
  { name: 'DataJud', href: 'https://www.cnj.jus.br/sistemas/datajud/', src: '/source-logos/datajud.jpg' },
  { name: 'TSE', href: 'https://dadosabertos.tse.jus.br/', src: '/source-logos/tse.png' },
  { name: 'IBGE', href: 'https://www.ibge.gov.br/', src: '/source-logos/ibge.svg' },
  { name: 'INEP', href: 'https://www.gov.br/inep/', src: '/source-logos/inep.png' },
  { name: 'Ministério da Saúde', href: 'https://www.gov.br/saude/', src: '/source-logos/saude.png' },
  { name: 'Tesouro Nacional', href: 'https://www.gov.br/tesouronacional/', src: '/source-logos/tesouro.png' },
  { name: 'CGU — Portal da Transparência', href: 'https://portaldatransparencia.gov.br/', src: '/source-logos/cgu.png' },
  { name: 'DNIT', href: 'https://www.gov.br/dnit/', src: '/source-logos/dnit.png' },
  { name: 'ANM', href: 'https://www.gov.br/anm/', src: '/source-logos/anm.jpg' },
  { name: 'ANEEL', href: 'https://www.gov.br/aneel/', src: '/source-logos/aneel.png' },
  { name: 'PNUD', href: 'https://www.undp.org/', src: '/source-logos/undp.svg' },
  { name: 'OCDE', href: 'https://www.oecd.org/', src: '/source-logos/oecd.png' },
  { name: 'Our World in Data', href: 'https://ourworldindata.org/', src: '/source-logos/owid.png' },
] as const;

function SourceLogoRow({ duplicate = false }: { duplicate?: boolean }) {
  return SOURCE_LOGOS.map(l => (
    <li key={`${duplicate ? 'dup' : 'main'}-${l.name}`} className="shrink-0" aria-hidden={duplicate || undefined}>
      <a href={l.href} target="_blank" rel="noopener noreferrer" tabIndex={duplicate ? -1 : undefined} className="focus-ring flex items-center opacity-75 transition hover:opacity-100" title={l.name}>
        <img src={l.src} alt={duplicate ? '' : l.name} className="h-6 w-auto object-contain sm:h-7" />
      </a>
    </li>
  ));
}

export function AppFooter(){return <footer className="mt-20 border-t bg-card">
  <div className="overflow-hidden border-b py-5" role="group" aria-label="Fontes de dados do Cívica">
    <ul className="source-logos-track flex w-max flex-nowrap items-center gap-x-10">
      <SourceLogoRow />
      <SourceLogoRow duplicate />
    </ul>
  </div>
  <div className="page-shell grid gap-8 py-10 md:grid-cols-[1.4fr_1fr_1fr]"><div><Image src="/civica-logo.png" alt="Cívica" width={122} height={43} className="h-8 w-auto object-contain" /><p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">Dados públicos de Legislativo, Executivo e Judiciário com contexto, período, cobertura e origem verificável.</p></div><nav aria-label="Rodapé" className="grid content-start gap-2 text-sm"><strong>Explore</strong><Link className="underline" href="/legislativo">Legislativo</Link><Link className="underline" href="/executivo">Executivo</Link><Link className="underline" href="/judiciario">Judiciário</Link><Link className="underline" href="/comparar">Comparar</Link><Link className="underline" href="/metodologia">Metodologia</Link></nav><div className="grid content-start gap-2 text-sm"><strong>Fontes oficiais</strong><a className="underline" href="https://www12.senado.leg.br/dados-abertos/">Senado Federal ↗</a><a className="underline" href="https://dadosabertos.camara.leg.br/">Câmara dos Deputados ↗</a><a className="underline" href="https://www.cnj.jus.br/pesquisas-judiciarias/justica-em-numeros/">CNJ — Justiça em Números ↗</a><a className="underline" href="https://www.ibge.gov.br/">IBGE ↗</a></div></div>
</footer>}
