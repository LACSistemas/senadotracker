import { GraduationCap } from 'lucide-react';
import { ChapterShell, EmptyNote } from '@/components/security/security-ui';
import { TrendChart } from '@/components/security/trend-chart';
import { StatGrid, BarList } from '@/components/infrastructure/infrastructure-ui';
import type { EducationFederalPageData } from '@/lib/education/federal';

function Pending({ id, number, title, reason }: { id: string; number: number; title: string; reason: string }) {
  return <section id={id} aria-labelledby={`${id}-h`} className="scroll-mt-28"><div className="rounded-3xl border border-dashed bg-card p-5 sm:p-6"><p className="eyebrow">Capítulo {number}</p><h2 id={`${id}-h`} className="font-display text-2xl text-[#14304f]">{title}</h2><p className="mt-2 max-w-prose text-sm text-muted-foreground">{reason} Nenhum valor é estimado nem preenchido com zero.</p></div></section>;
}

export function EducationFederalPage({ data }: { data: EducationFederalPageData }) {
  const { network, learning, trajectory, context, structure, teachers, sources } = data;
  const ch = (ok: boolean, c: { id: string; number: number; title: string; emptyReason: string }, node: React.ReactNode) => ok ? node : <Pending id={c.id} number={c.number} title={c.title} reason={c.emptyReason} />;

  return <div className="space-y-10">
    {ch(network.available, { id: 'rede', number: 1, title: 'Quantos estudam', emptyReason: network.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="rede" number={1} title="Quantos estudam" narrative={network.narrative} limits={['Matrícula não é aluno único: o mesmo aluno pode ter mais de uma.', 'Contagem oficial do Censo Escolar, sem recálculo do Cívica.']} sources="Fonte: INEP, Censo Escolar da Educação Básica.">
        <StatGrid items={network.stats} />
        {network.stages.length > 0 && <BarList title="Matrículas por etapa" rows={network.stages} />}
        {network.dependency.length > 0 && <BarList title="Matrículas por rede" rows={network.dependency} />}
      </ChapterShell>
    ))}

    {ch(learning.available, { id: 'aprendizagem', number: 2, title: 'O que os alunos aprendem', emptyReason: learning.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="aprendizagem" number={2} title="O que os alunos aprendem" narrative={learning.narrative} limits={['Valores oficiais do INEP, sem recálculo: o Ideb do Brasil não é a média das escolas.', 'Escalas do Saeb diferem por série e disciplina; não compare etapas nem disciplinas.', 'A meta do Ideb vai só até 2021.']} sources="Fontes: INEP, Saeb e Ideb.">
        {learning.mathChart && <TrendChart chart={learning.mathChart} />}
        {learning.idebChart && <TrendChart chart={learning.idebChart} />}
      </ChapterShell>
    ))}

    {ch(trajectory.available, { id: 'trajetoria', number: 3, title: 'Quem fica pelo caminho', emptyReason: trajectory.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="trajetoria" number={3} title="Quem fica pelo caminho" narrative={trajectory.narrative} limits={['Taxas oficiais do INEP por ano letivo, sem recálculo. Aprovação, reprovação e abandono somam cerca de 100%.', 'Distorção idade-série não é reprovação: mede o atraso em relação à idade esperada.']} sources="Fonte: INEP, Indicadores Educacionais.">
        {trajectory.chart && <TrendChart chart={trajectory.chart} />}
        {trajectory.breakdown && <div className="overflow-x-auto"><table className="w-full min-w-[32rem] text-left text-sm"><caption className="sr-only">{trajectory.breakdown.title}</caption><thead><tr className="border-b text-muted-foreground">{trajectory.breakdown.columns.map(c => <th key={c} scope="col" className="py-1.5 pr-3 font-semibold">{c}</th>)}</tr></thead><tbody>{trajectory.breakdown.rows.map(r => <tr key={r.label} className="border-b last:border-0"><th scope="row" className="py-1.5 pr-3 font-semibold text-[#14304f]">{r.label}</th>{r.cells.map((c, i) => <td key={i} className="py-1.5 pr-3 tabular-nums">{c ?? '—'}</td>)}</tr>)}</tbody></table>{trajectory.breakdown.caption && <p className="mt-2 text-xs text-muted-foreground">{trajectory.breakdown.caption}</p>}</div>}
      </ChapterShell>
    ))}

    {ch(context.available, { id: 'contexto', number: 4, title: 'Contexto das famílias', emptyReason: context.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="contexto" number={4} title="Contexto das famílias" narrative={context.narrative} limits={['O INSE descreve o contexto socioeconômico dos alunos; não mede a qualidade da escola.', '2019 usa uma escala diferente de 2021 e 2023.']} sources="Fonte: INEP, Indicador de Nível Socioeconômico (Saeb).">
        <StatGrid items={context.stats} />
        {context.chart && <TrendChart chart={context.chart} />}
      </ChapterShell>
    ))}

    {ch(structure.available, { id: 'estrutura', number: 5, title: 'Como são as escolas', emptyReason: structure.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="estrutura" number={5} title="Como são as escolas" narrative={structure.narrative} limits={['Informação autodeclarada pela escola no Censo Escolar; o percentual considera só as que responderam.', 'Internet declara acesso, não velocidade nem qualidade.']} sources="Fonte: INEP, Censo Escolar (tabela de infraestrutura).">
        {structure.items.length > 0 ? <BarList title="Escolas com cada item de infraestrutura" rows={structure.items} /> : <EmptyNote title="Sem infraestrutura publicada">Não há dados de infraestrutura escolar para o Brasil nesta edição.</EmptyNote>}
        {structure.universe && <p className="text-xs text-muted-foreground">{structure.universe} na edição mais recente.</p>}
      </ChapterShell>
    ))}

    {ch(teachers.available, { id: 'professores', number: 6, title: 'Quem ensina', emptyReason: teachers.emptyReason }, (
      <ChapterShell accent="teal" icon={GraduationCap} id="professores" number={6} title="Quem ensina" narrative={teachers.narrative} limits={['Docentes distintos: cada professor conta uma vez. Quem leciona em várias escolas não é somado em dobro.', 'Os indicadores de formação descrevem, não ranqueiam.']} sources="Fonte: INEP, Sinopse Estatística e Indicadores Educacionais.">
        <StatGrid items={teachers.stats} />
      </ChapterShell>
    ))}

    <section id="fontes" aria-labelledby="fontes-h" className="scroll-mt-28 rounded-2xl border bg-card p-5 text-sm"><h2 id="fontes-h" className="font-display text-xl">Fontes desta página</h2>
      <ul className="mt-2 space-y-1 text-muted-foreground">{sources.map(s => <li key={s.label}><strong className="text-foreground">{s.label}</strong>: {s.period}</li>)}</ul>
      <p className="mt-3 text-xs text-muted-foreground">Números oficiais do INEP para o Brasil (não uma soma refeita pelo Cívica das 27 UFs) — Enem, Ensino Superior, pós-graduação e contratos de educação só têm leitura por UF ou município nesta base, por isso não aparecem aqui.</p>
    </section>
  </div>;
}
