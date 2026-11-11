import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { JudiciaryAvailabilityNote } from '@/components/judiciary/availability';
import { OfficialPortrait } from '@/components/app-image';
import { loadJudiciaryStfPayrollDetail } from '@/lib/judiciary';

export const dynamic = 'force-dynamic';
type Props = { params: Promise<{ matricula: string }> };

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 2 });
const MES_NOMES = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

type Rubrica = { key: string; letter: string; label: string; gloss: string };
const GROUPS: { title: string; items: Rubrica[] }[] = [
  { title: 'Parcelas de natureza remuneratória', items: [
    { key: 'vencimentos_subsidios', letter: 'A', label: 'Vencimentos / Subsídios', gloss: 'Subsídio do cargo, parcela fixa definida em lei.' },
    { key: 'vantagens_pessoais', letter: 'B', label: 'Vantagens Pessoais', gloss: 'Adicionais pessoais — tempo de serviço, decisões judiciais.' },
    { key: 'vantagens_periodicas_eventuais', letter: 'C', label: 'Vantagens periódicas/eventuais', gloss: 'Serviço extraordinário, substituições, adicionais eventuais.' },
    { key: 'cargo_comissao', letter: 'D', label: 'Cargo em comissão/função comissionada', gloss: 'Retribuição pelo cargo ou função comissionada exercida.' },
    { key: 'bruto_antes_teto', letter: 'E', label: 'Rendimento bruto antes do teto constitucional', gloss: 'Remuneração mensal sem aplicar o teto constitucional.' },
    { key: 'bruto_apos_teto', letter: 'F', label: 'Total bruto após o teto constitucional', gloss: 'Remuneração mensal depois de aplicar o teto constitucional.' },
    { key: 'abono_permanencia', letter: 'G', label: 'Abono de Permanência', gloss: 'Para quem já pode se aposentar, mas opta por continuar.' },
  ]},
  { title: 'Descontos compulsórios', items: [
    { key: 'contribuicao_previdenciaria', letter: 'H', label: 'Contribuição previdenciária', gloss: 'Contribuição previdenciária obrigatória do servidor.' },
    { key: 'imposto_renda', letter: 'I', label: 'Imposto de Renda', gloss: 'Imposto de Renda retido na fonte (IRRF).' },
    { key: 'total_descontos_compulsorios', letter: 'J', label: 'Total de descontos compulsórios', gloss: 'Soma da previdência e do Imposto de Renda.' },
    { key: 'abate_teto', letter: 'K', label: 'Abate teto', gloss: 'Ajuste quando a remuneração total excede o teto constitucional.' },
    { key: 'descontos_diversos', letter: 'L', label: 'Descontos diversos', gloss: 'Pensão alimentícia judicial, consignações, plano de saúde e outros.' },
    { key: 'total_descontos', letter: 'M', label: 'Total de descontos', gloss: 'Soma de todos os descontos compulsórios e diversos.' },
  ]},
  { title: 'Parcelas não permanentes, indenizações e benefícios', items: [
    { key: 'ferias', letter: 'N', label: 'Férias', gloss: 'Terço constitucional de férias ou seu adiantamento.' },
    { key: 'gratificacao_natalina', letter: 'O', label: 'Gratificação natalina e antecipação', gloss: '13º salário ou sua antecipação.' },
    { key: 'auxilios_beneficios', letter: 'P', label: 'Auxílios e benefícios', gloss: 'Auxílio-alimentação, pré-escolar, natalidade, transporte.' },
    { key: 'indenizacoes', letter: 'Q', label: 'Indenizações', gloss: 'Indenização de férias, de transporte e outras previstas em lei.' },
    { key: 'exercicios_anteriores_licenca_premio', letter: 'R', label: 'Exercícios anteriores e licença-prêmio', gloss: 'Pagamento de licença-prêmio convertida em pecúnia.' },
    { key: 'auxilio_moradia', letter: 'S', label: 'Auxílio-Moradia', gloss: 'Auxílio-moradia.' },
  ]},
];

export async function generateMetadata({ params }: Props) {
  const { matricula } = await params; const r = await loadJudiciaryStfPayrollDetail(matricula);
  const d = r.data as any; return { title: d ? `${d.nome} · Remuneração STF · Cívica` : 'Remuneração · Cívica' };
}

export default async function StfPayrollDetailPage({ params }: Props) {
  const { matricula } = await params;
  const result = await loadJudiciaryStfPayrollDetail(matricula);
  if (result.availability === 'NOT_REPORTED' || !result.data) notFound();
  const d = result.data as { matricula: string; nome: string; role: string; cargo_efetivo: string | null; cargo_comissionado: string | null; nome_funcao: string | null; lotacao: string | null; situacao_funcional: string | null; ano: number; mes: number; remuneracao_bruta: string | null; remuneracao_liquida: string | null; data_admissao: string | null; rubricas: Record<string, number>; nomeDeGuerra?: string; fotoUrl?: string };
  const referencia = `${MES_NOMES[d.mes]}/${d.ano}`;
  const nomeExibicao = d.nomeDeGuerra ?? d.nome;

  return (
    <main id="conteudo" tabIndex={-1} className="page-shell py-8">
      <Link href="/judiciario/stf/remuneracao" className="inline-flex items-center gap-1 text-sm font-bold text-primary underline"><ArrowLeft size={14} /> Remuneração de Ministros e Assessores</Link>

      <header className="mt-6 flex flex-wrap items-center gap-5">
        {d.role === 'MINISTRO' && (
          <div className="relative size-24 shrink-0 overflow-hidden rounded-2xl bg-muted sm:size-28">
            <OfficialPortrait src={d.fotoUrl} name={nomeExibicao} sizes="112px" />
          </div>
        )}
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{d.role === 'MINISTRO' ? (d.situacao_funcional ?? 'Ministro') : 'Assessor de Ministro'} · Referência {referencia}</p>
          <h1 className="display-title mt-2 text-3xl sm:text-4xl">{nomeExibicao}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{d.lotacao ?? 'Lotação não informada'}{d.data_admissao ? ` · admissão em ${new Date(d.data_admissao).toLocaleDateString('pt-BR')}` : ''}</p>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Remuneração bruta (após teto)</p><p className="mt-1 text-2xl font-black">{d.remuneracao_bruta != null ? money.format(Number(d.remuneracao_bruta)) : '—'}</p></div>
        <div className="rounded-2xl border bg-card p-5"><p className="text-xs font-bold uppercase text-muted-foreground">Remuneração líquida</p><p className="mt-1 text-2xl font-black">{d.remuneracao_liquida != null ? money.format(Number(d.remuneracao_liquida)) : '—'}</p></div>
      </section>

      {GROUPS.map(group => (
        <section key={group.title} className="mt-10">
          <h2 className="text-xl font-black">{group.title}</h2>
          <dl className="mt-3 divide-y rounded-2xl border">
            {group.items.map(item => (
              <div key={item.key} className="flex flex-wrap items-baseline justify-between gap-2 p-4">
                <div>
                  <dt className="text-sm font-bold">({item.letter}) {item.label}</dt>
                  <dd className="mt-0.5 text-xs text-muted-foreground">{item.gloss}</dd>
                </div>
                <dd className="text-sm font-bold tabular-nums">{money.format(d.rubricas[item.key] ?? 0)}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-xl font-black">Fonte</h2>
        <div className="mt-3"><JudiciaryAvailabilityNote availability="AVAILABLE" source="STF — Portal da Transparência (egesp-portal.stf.jus.br)" limitations={result.provenance.limitations} /></div>
        <a href="https://egesp-portal.stf.jus.br/transparencia/rendimento_folha" className="mt-3 inline-flex items-center gap-1 text-sm font-bold text-primary underline">Ver na fonte oficial (STF)</a>
      </section>
    </main>
  );
}
