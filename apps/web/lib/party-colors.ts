/**
 * Cor estável por partido, a mesma em /deputados e /senadores. Paleta neutra (matiz por ângulo áureo, saturação e
 * luminosidade contidas, no tom do restante do Cívica) — de propósito NÃO usa as cores oficiais dos partidos, para a
 * interface não sugerir alinhamento político. A cor só distingue; não codifica espectro nem avaliação.
 */
const ORDER = ['PL', 'PT', 'UNIÃO', 'PP', 'PSD', 'MDB', 'REPUBLICANOS', 'PSB', 'PDT', 'PSDB', 'PODE', 'PSOL', 'AVANTE', 'SOLIDARIEDADE', 'PCdoB', 'PV', 'CIDADANIA', 'NOVO', 'REDE', 'PRD', 'DC', 'MISSÃO', 'AGIR', 'PMB', 'PRTB', 'PMN', 'PATRIOTA', 'PROS', 'PTB', 'PSC', 'PHS'];
const SIZE = 48;
const palette: string[] = Array.from({ length: SIZE }, (_, i) => {
  const hue = (i * 137.508 + 158) % 360;               // ângulo áureo: vizinhos na ordem ficam longe no círculo cromático
  const lightness = [40, 52, 46][i % 3]!;               // alterna luminosidade para separar fatias vizinhas
  return `hsl(${hue.toFixed(1)} 48% ${lightness}%)`;
});
const hash = (value: string) => { let h = 2166136261; for (const c of value) { h ^= c.codePointAt(0)!; h = Math.imul(h, 16777619); } return h >>> 0; };
export const NEUTRAL_PARTY_COLOR = 'hsl(150 6% 56%)';

export function partyColor(party: string): string {
  if (!party || party === 'Sem partido') return NEUTRAL_PARTY_COLOR;
  const index = ORDER.indexOf(party);
  return palette[index >= 0 ? index : ORDER.length + hash(party) % (SIZE - ORDER.length)]!;
}
