import Link from 'next/link';
import { OfficialPortrait } from '@/components/app-image';

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function MinisterCard({ href, nome, fotoUrl, situacao, remuneracaoBruta }: { href: string; nome: string; fotoUrl?: string | null | undefined; situacao: string; remuneracaoBruta: number | null }) {
  return (
    <Link href={href} className="focus-ring group flex flex-col overflow-hidden rounded-2xl border bg-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md">
      <div className="relative aspect-[3/4] w-full overflow-hidden bg-muted">
        <OfficialPortrait src={fotoUrl} name={nome} sizes="(max-width: 640px) 45vw, 220px" />
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-wide text-muted-foreground">{situacao}</p>
        <p className="font-black leading-tight group-hover:text-primary">{nome}</p>
        <p className="mt-auto pt-2 text-sm font-bold tabular-nums">
          {remuneracaoBruta != null ? money.format(remuneracaoBruta) : 'Sem dado'}
          <span className="font-normal text-muted-foreground"> /mês bruto</span>
        </p>
      </div>
    </Link>
  );
}
