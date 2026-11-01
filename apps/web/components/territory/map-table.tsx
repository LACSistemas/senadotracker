import Link from 'next/link';
import { flagLabels, type MapMetric } from './territory-ui';

/** Alternativa tabular ao Atlas Vivo (P3, Parte VI.11.2/11.3 do mandato: "o mapa deve ser acessível
 * também por uma interface tabular"). Mesmos dados do mapa — nenhum valor a mais nem a menos — listados
 * em ordem alfabética (não por valor): nenhum dos indicadores do mapa tem `ranking_allowed` marcado no
 * catálogo, então a tabela não insinua um ranking que a própria definição do indicador não autoriza. */
export function MapTable({ names, values, flags, metric }: {
  names: Map<number, string>; values: Map<number, number>; flags: Map<number, number>; metric: MapMetric;
}) {
  const fmt = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: metric.digits, maximumFractionDigits: metric.digits });
  const rows = [...names.entries()].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'));
  return (
    <div className="overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full text-sm">
        <caption className="sr-only">Municípios por {metric.label}, em ordem alfabética</caption>
        <thead><tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
          <th scope="col" className="px-4 py-3">Município</th>
          <th scope="col" className="px-4 py-3">{metric.label} ({metric.unit})</th>
          <th scope="col" className="px-4 py-3">Ressalvas</th>
        </tr></thead>
        <tbody>
          {rows.map(([id, name]) => {
            const v = values.get(id); const fl = flagLabels(flags.get(id) ?? 0);
            return <tr key={id} className="border-b last:border-0 hover:bg-secondary">
              <td className="px-4 py-2.5"><Link href={`/municipios/${id}`} className="font-semibold text-primary hover:underline">{name}</Link></td>
              <td className="px-4 py-2.5 tnum">{v === undefined ? '—' : fmt.format(v)}</td>
              <td className="px-4 py-2.5 text-xs text-muted-foreground">{fl.length ? fl.join('; ') : '—'}</td>
            </tr>;
          })}
        </tbody>
      </table>
    </div>
  );
}
