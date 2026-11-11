import { HeartPulse } from 'lucide-react';
import { ChapterShell } from '@/components/security/security-ui';
import { StatGrid, BarList } from '@/components/infrastructure/infrastructure-ui';
import type { HealthFederalPageData } from '@/lib/health-federal';

const compYear = (c: number | null) => c != null ? Math.floor(c / 100) : null;
const compMonth = (c: number | null) => c != null ? c % 100 : null;

export function HealthFederalPage({ data }: { data: HealthFederalPageData }) {
  const { competence, stats, facilityTypes, bedTypes, distribution } = data;
  const compLabel = competence != null ? `${String(compMonth(competence)).padStart(2, '0')}/${compYear(competence)}` : 'sem competência';
  const min = distribution.at(-1)?.value; const max = distribution[0]?.value; const median = distribution[Math.floor(distribution.length / 2)]?.value;

  return <div className="space-y-10">
    <ChapterShell accent="amber" icon={HeartPulse} id="panorama" number={1} title="Panorama" narrative={{ question: 'Como o Brasil cuida da saúde da população?', answer: `${stats[0]?.value ?? '—'} estabelecimentos no cadastro, com ${stats[2]?.value ?? '—'} leitos existentes (competência ${compLabel}).`, context: 'CNES é um registro censitário: somar estabelecimentos e leitos entre municípios e estados é uma leitura válida.', invite: '' }} limits={['Mais estabelecimentos ou leitos cadastrados não significa necessariamente melhor atendimento.', 'Contagem do cadastro vigente (CNES), não uma pesquisa amostral.']} sources={`Fonte: CNES/DataSUS, competência ${compLabel}.`}>
      <StatGrid items={stats} />
      {facilityTypes.length > 0 && <BarList title="Estabelecimentos por tipo" rows={facilityTypes} />}
      {bedTypes.length > 0 && <BarList title="Leitos por tipo (existentes; nota: quantos são SUS)" rows={bedTypes} />}
    </ChapterShell>

    <ChapterShell accent="amber" icon={HeartPulse} id="distribuicao" number={2} title="Distribuição entre os estados" narrative={{ question: 'Como os leitos se distribuem entre os 27 estados?', answer: min != null && max != null ? `De ${min.toFixed(2)} a ${max.toFixed(2)} leitos por mil habitantes entre os estados.` : 'Sem distribuição publicada.', context: 'Uma distribuição real, não um ranking de qualidade — mais leitos cadastrados não significa necessariamente melhor atendimento.', invite: '' }} limits={['Leitos por mil habitantes usa a população mais recente publicada por estado, que pode ser de anos diferentes entre si.', 'Não equivale a acesso efetivo: não mede filas, distância ou qualidade do atendimento.']} sources="Fonte: CNES/DataSUS (leitos) e IBGE (população).">
      {median != null && <p className="text-sm text-muted-foreground">Mediana entre os estados: <strong className="text-[#14304f]">{median.toFixed(2)}</strong> leitos por mil habitantes.</p>}
      <BarList title="Leitos por mil habitantes, por estado" rows={distribution.map(d => ({ label: `${d.name} (${d.uf})`, value: d.value, display: d.value.toFixed(2) }))} />
    </ChapterShell>

    <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
      <p className="mt-2 text-muted-foreground">CNES/DataSUS, competência {compLabel}.</p>
      <p className="mt-3 text-xs text-muted-foreground">Esta página é mais enxuta que as de Educação, Bem-estar, Segurança e Infraestrutura: nesta base, só o panorama atual e a distribuição territorial de Saúde têm leitura nacional pronta — evolução temporal, internações e vacinação são lidas por UF ou município. Veja cada estado em <a href="/estados" className="underline">/estados</a>.</p>
    </section>
  </div>;
}
