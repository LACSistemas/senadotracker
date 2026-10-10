/**
 * Ligação entre quem aparece nas despesas publicadas por uma Assembleia e o cadastro corrente de parlamentares.
 * Regras (da mais forte para a mais fraca), sempre sem aproximação por similaridade:
 *   EXACT_ID              o identificador da despesa é um identificador do cadastro da Casa
 *   OFFICIAL_BRIDGE       chave oficial publicada pela própria Casa (ex.: matrícula da ALESP ↔ idParlamentar)
 *   EXACT_UNIQUE_NAME     nome (ou nome parlamentar) igual após normalizar acentos, caixa e "Dep.", único no cadastro
 *   UNIQUE_NAME_NO_TITLE  igual só depois de ignorar tratamentos (Dr., Prof., Cel. …), único no cadastro
 * Nome ambíguo (dois parlamentares com o mesmo nome normalizado) NUNCA é ligado. O que não passa fica UNLINKED e é contado.
 */
export type FinanceLinkMethod = 'EXACT_ID' | 'OFFICIAL_BRIDGE' | 'EXACT_UNIQUE_NAME' | 'UNIQUE_NAME_NO_TITLE';
export interface RosterEntry { id: string; name: string; parliamentaryName?: string | null }
export interface FinanceActor { id: string | null; labels: string[] }
export interface FinanceLink { rosterId: string; method: FinanceLinkMethod }

const DEP = /\b(deputad[oa]s?|dep)\b\.?/g;
const TITLES = /\b(dr|dra|prof|profa|professor|professora|pastor|pastora|delegad[oa]|cel|coronel|cap|capitao|ten|tenente|sgt|sargento|cabo|bispo|padre|major|maj)\b\.?/g;
const fold = (value: string) => value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
export const normalizeActorName = (value: string | null | undefined): string => fold(String(value ?? '')).replace(DEP, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
export const normalizeActorNameNoTitle = (value: string | null | undefined): string => fold(String(value ?? '')).replace(DEP, ' ').replace(TITLES, ' ').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

function index(roster: readonly RosterEntry[], normalize: (value: string | null | undefined) => string): Map<string, Set<string>> {
  const by = new Map<string, Set<string>>();
  for (const entry of roster) for (const name of new Set([normalize(entry.name), normalize(entry.parliamentaryName)].filter(Boolean))) { const set = by.get(name) ?? new Set<string>(); set.add(entry.id); by.set(name, set); }
  return by;
}

/** Resolve um ator de despesa. `bridge` mapeia chave oficial da despesa → id do cadastro. Devolve null quando não há ligação segura. */
export function createFinanceResolver(roster: readonly RosterEntry[], bridge?: ReadonlyMap<string, string>) {
  const ids = new Set(roster.map(entry => entry.id)), exactNames = index(roster, normalizeActorName), looseNames = index(roster, normalizeActorNameNoTitle);
  const unique = (candidates: Array<Set<string> | undefined>): string | null => { const found = new Set<string>(); for (const set of candidates) { if (!set) continue; if (set.size > 1) return null; found.add([...set][0]!); } return found.size === 1 ? [...found][0]! : null; };
  return (actor: FinanceActor): FinanceLink | null => {
    if (actor.id && ids.has(actor.id)) return { rosterId: actor.id, method: 'EXACT_ID' };
    const bridged = actor.id ? bridge?.get(actor.id) : undefined; if (bridged && ids.has(bridged)) return { rosterId: bridged, method: 'OFFICIAL_BRIDGE' };
    const labels = [...actor.labels, ...(actor.id && !/^\d+$/.test(actor.id) ? [actor.id] : [])].filter(Boolean);
    const exact = unique(labels.map(label => exactNames.get(normalizeActorName(label)))); if (exact) return { rosterId: exact, method: 'EXACT_UNIQUE_NAME' };
    const loose = unique(labels.map(label => looseNames.get(normalizeActorNameNoTitle(label)))); if (loose) return { rosterId: loose, method: 'UNIQUE_NAME_NO_TITLE' };
    return null;
  };
}

/** Ponte oficial por Casa. Só existe quando a própria Casa publica as duas chaves no mesmo documento. */
export function officialBridgeFromRosterPayload(house: string, body: string): Map<string, string> {
  const bridge = new Map<string, string>();
  if (house === 'SP') {
    // Portal da ALESP: { content: [{ idParlamentar, nuMatricula, ... }] }; despesas_gabinetes.json usa a mesma matrícula.
    try { for (const row of (JSON.parse(body) as { content?: Array<{ idParlamentar?: number | string; nuMatricula?: number | string }> }).content ?? []) if (row.idParlamentar != null && row.nuMatricula != null) bridge.set(String(row.nuMatricula), String(row.idParlamentar)); } catch { /* corpo ilegível: sem ponte, nada é ligado por ela */ }
  }
  return bridge;
}
