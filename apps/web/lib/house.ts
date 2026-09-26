import type { ComponentType } from 'react';
import { Building2, Gavel, Landmark } from 'lucide-react';

export type HouseKey = 'SENADO' | 'CAMARA' | 'CONGRESSO';

export interface HouseInfo {
  label: string;
  short: string;
  icon: ComponentType<{ size?: number; className?: string }>;
  /** Cor de texto/ícone com contraste seguro (uso em texto ≥14px em negrito ou como fill de ícone/dot). */
  text: string;
  /** Preenchimento sólido, para marcadores e trilhas (nunca como texto pequeno). */
  bg: string;
  /** Fundo suave para chips e pills sobre superfícies claras. */
  soft: string;
}

// Câmara reaproveita o par secondary/primary já usado em chips no resto do produto — é o "acento padrão".
// Senado e Congresso reusam --chart-2/--chart-3, já na paleta da marca, apenas re-significados.
export const HOUSE: Record<HouseKey, HouseInfo> = {
  SENADO: { label: 'Senado Federal', short: 'Senado', icon: Landmark, text: 'text-chart-2', bg: 'bg-chart-2', soft: 'bg-chart-2/12' },
  CAMARA: { label: 'Câmara dos Deputados', short: 'Câmara', icon: Building2, text: 'text-primary', bg: 'bg-primary', soft: 'bg-secondary' },
  CONGRESSO: { label: 'Congresso Nacional', short: 'Congresso', icon: Gavel, text: 'text-chart-3', bg: 'bg-chart-3', soft: 'bg-chart-3/12' },
};

export function houseOf(value: string): HouseInfo {
  const key = String(value).toUpperCase();
  return HOUSE[key as HouseKey] ?? HOUSE.SENADO;
}
