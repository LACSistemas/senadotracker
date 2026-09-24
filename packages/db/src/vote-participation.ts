import { searchText, type Source } from '@senadotracker/domain';

const commonVotes = new Set(['sim', 'nao', 'abstencao', 'votou', 'secreto']);

/** Estados que representam uma ação de voto. Ausência, licença e não registro ficam fora. */
export function countsAsParticipation(source: Source, vote: string | null | undefined) {
  const normalized = searchText(vote ?? '').trim();
  if (commonVotes.has(normalized)) return true;
  return source === 'camara' && normalized === 'obstrucao';
}

const directionalVotes = new Set(['sim', 'nao', 'abstencao']);

/** Voto que revela a posição, para comparar pessoas entre si. Mais estrito que `countsAsParticipation`:
    `votou` e `secreto` registram a ação mas não a direção, então não sustentam concordância nem eixo.
    Devolve o literal normalizado, para a comparação nunca depender da grafia da fonte. */
export function directionalVote(source: Source, vote: string | null | undefined): string | null {
  const normalized = searchText(vote ?? '').trim();
  if (directionalVotes.has(normalized)) return normalized;
  return source === 'camara' && normalized === 'obstrucao' ? normalized : null;
}
