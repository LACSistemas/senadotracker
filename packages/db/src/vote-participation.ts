import { searchText, type Source } from '@senadotracker/domain';

const commonVotes = new Set(['sim', 'nao', 'abstencao', 'votou', 'secreto']);

/** Estados que representam uma ação de voto. Ausência, licença e não registro ficam fora. */
export function countsAsParticipation(source: Source, vote: string | null | undefined) {
  const normalized = searchText(vote ?? '').trim();
  if (commonVotes.has(normalized)) return true;
  return source === 'camara' && normalized === 'obstrucao';
}
