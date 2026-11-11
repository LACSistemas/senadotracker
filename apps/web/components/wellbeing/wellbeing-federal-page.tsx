import { HeartHandshake } from 'lucide-react';
import { ChapterShell } from '@/components/security/security-ui';
import { TrendChart } from '@/components/security/trend-chart';
import { StatGrid, BarList } from '@/components/infrastructure/infrastructure-ui';
import type { WellbeingFederalPageData } from '@/lib/wellbeing/federal';

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

export function WellbeingFederalPage({ data }: { data: WellbeingFederalPageData }) {
  const { conditions, work, social, digital, action, sources } = data;
  const ch = (ok: boolean, c: { id: string; number: number; title: string; emptyReason: string }, node: React.ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason} />;

  return <div className="space-y-10">
    {ch(conditions.available, { id: 'condicoes', number: 1, title: 'Condições de vida', emptyReason: conditions.emptyReason }, (
      <ChapterShell accent="violet" icon={HeartHandshake} id="condicoes" number={1} title="Condições de vida" narrative={conditions.narrative} limits={['Dado do Censo Demográfico 2022: uma única fotografia, sem série anual.', 'Água, esgoto e lixo "adequados" seguem a definição do IBGE; o percentual considera só domicílios particulares permanentes.']} sources="Fonte: IBGE, Censo Demográfico 2022.">
        {conditions.incomeBars.length > 0 && <BarList title="Renda domiciliar per capita" rows={conditions.incomeBars} />}
        {conditions.housing.length > 0 && <BarList title="Condições domiciliares adequadas" rows={conditions.housing} />}
        {conditions.gini && <StatGrid items={[conditions.gini]} />}
      </ChapterShell>
    ))}

    {ch(work.available, { id: 'trabalho', number: 2, title: 'Trabalho e oportunidades', emptyReason: work.emptyReason }, (
      <ChapterShell accent="violet" icon={HeartHandshake} id="trabalho" number={2} title="Trabalho e oportunidades" narrative={work.narrative} limits={['Estoque RAIS (anual), estoque de referência do Caged e fluxo mensal do Caged são três medidas diferentes: nunca somadas entre si.', 'O Novo Caged mede vínculos pelo local do estabelecimento; não é taxa de desemprego.']} sources="Fontes: RAIS e Novo Caged (MTE).">
        <StatGrid items={work.stats} />
        {work.raisChart && <TrendChart chart={work.raisChart} />}
        {work.cagedChart && <TrendChart chart={work.cagedChart} />}
      </ChapterShell>
    ))}

    {ch(social.available, { id: 'rede-social', number: 3, title: 'Rede socioassistencial', emptyReason: social.emptyReason }, (
      <ChapterShell accent="violet" icon={HeartHandshake} id="rede-social" number={3} title="Rede socioassistencial" narrative={social.narrative} limits={['CRAS e CREAS são contados pela sede: um município sem CREAS sediado pode ter atendimento regional.', 'Não inclui CadÚnico, Bolsa Família nem BPC: essas fontes ainda não foram publicadas neste domínio.']} sources="Fonte: Censo SUAS 2024 (SAGICAD-MDS).">
        <StatGrid items={social.stats} />
      </ChapterShell>
    ))}

    {ch(digital.available, { id: 'digital', number: 4, title: 'Cotidiano digital', emptyReason: digital.emptyReason }, (
      <ChapterShell accent="violet" icon={HeartHandshake} id="digital" number={4} title="Cotidiano digital" narrative={digital.narrative} limits={['Respostas declaradas pela própria prefeitura ao IBGE (MUNIC), categóricas.', 'O denominador é o número de prefeituras com resposta Sim/Não, não a população.']} sources="Fonte: IBGE, MUNIC 2024.">
        {digital.distribution.length > 0 && <BarList title="Prefeituras com cada serviço digital" rows={digital.distribution} />}
      </ChapterShell>
    ))}

    {ch(action.available, { id: 'acao-publica', number: 5, title: 'Ação pública', emptyReason: action.emptyReason }, (
      <ChapterShell accent="violet" icon={HeartHandshake} id="acao-publica" number={5} title="Ação pública" narrative={action.narrative} limits={['Função 08 (Assistência Social) do Siconfi, só da União.', 'Empenhado, liquidado e pago nunca devem ser somados entre si.']} sources="Fonte: Siconfi (Tesouro Nacional), função 08 — Assistência Social.">
        <StatGrid items={action.stats} />
      </ChapterShell>
    ))}

    <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">{sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">CRAS, CREAS e indicadores digitais são somas reais dos municípios respondentes do Brasil inteiro — a mesma fórmula já usada pelas páginas de UF, generalizada para quando o território é o Brasil.</p>
    </section>
  </div>;
}
