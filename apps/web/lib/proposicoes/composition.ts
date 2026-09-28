import type { FunctionalGroupCount } from '@senadotracker/db';
import { GROUPS, OTHER_COLOR, OTHER_LABEL, type GroupMeta } from './taxonomy';

export interface CompositionEntry {
  key: string; label: string; verb: string; description: string; color: string;
  count: number; share: number; topTypes: FunctionalGroupCount['topTypes'];
  /** Presente só no segmento "Outras formas": os grupos menores que ele reúne. */
  children?: CompositionEntry[];
}

export const OTHER_KEY = '__other';

/**
 * Entradas da composição na ordem taxonômica FIXA (nunca por tamanho: a cor segue a entidade e a ordem é o que
 * mantém vizinhos distinguíveis para daltônicos). Os três grupos menores dobram em "Outras formas" — o skill de
 * dataviz limita a 7 matizes nomeados —, e ficam acessíveis ao expandir. Grupos sem ocorrência não aparecem.
 */
export function composeEntries(groups: FunctionalGroupCount[], total: number, fold = true): CompositionEntry[] {
  const byKey = new Map(groups.map(group => [group.group, group]));
  const entry = (meta: GroupMeta): CompositionEntry | null => {
    const group = byKey.get(meta.key);
    if (!group || !group.count) return null;
    return { key: meta.key, label: meta.label, verb: meta.verb, description: meta.description, color: meta.color, count: group.count, share: total ? group.count / total : 0, topTypes: group.topTypes };
  };
  const present = (list: readonly GroupMeta[]) => list.map(entry).filter((item): item is CompositionEntry => item !== null);
  const head = present(GROUPS.filter(meta => !fold || !meta.tail)), tail = fold ? present(GROUPS.filter(meta => meta.tail)) : [];
  if (tail.length) {
    const count = tail.reduce((sum, item) => sum + item.count, 0);
    head.push({ key: OTHER_KEY, label: OTHER_LABEL, verb: OTHER_LABEL, description: 'Reúne as formas menores: mensagens e comunicações institucionais, recursos, representações e petições, e atos especiais.', color: OTHER_COLOR, count, share: total ? count / total : 0, topTypes: [], children: tail });
  }
  return head;
}

/** Compõe a partir de um vetor de contagens na ordem de PROPOSITION_GROUP_ORDER (usado por DNA e ritmo). */
export function entriesFromCounts(counts: readonly number[], fold = true): CompositionEntry[] {
  const total = counts.reduce((sum, value) => sum + value, 0);
  return composeEntries(GROUPS.map((meta, index) => ({ group: meta.key, count: counts[index] ?? 0, share: total ? (counts[index] ?? 0) / total : 0, topTypes: [] })), total, fold);
}
