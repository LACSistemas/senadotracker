export interface ReconciliationResult {
  readonly sourceCount: number;
  readonly parsedCount: number;
  readonly unchanged: number;
  readonly added: number;
  readonly removed: number;
  readonly changed: number;
  readonly duplicateLogicalIds: number;
  readonly semanticHashBefore: string | null;
  readonly semanticHashAfter: string;
  readonly noOp: boolean;
}

function stable(value: unknown): string { return JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a], [b]) => a.localeCompare(b))) : item); }
export function reconcileSnapshot<T>(previous: readonly T[], incoming: readonly T[], keyOf: (value: T) => string, semanticOf: (value: T) => unknown = value => value): ReconciliationResult {
  const previousGroups = new Map<string, T[]>(); const incomingGroups = new Map<string, T[]>();
  for (const value of previous) previousGroups.set(keyOf(value), [...(previousGroups.get(keyOf(value)) ?? []), value]);
  for (const value of incoming) incomingGroups.set(keyOf(value), [...(incomingGroups.get(keyOf(value)) ?? []), value]);
  const ids = new Set([...previousGroups.keys(), ...incomingGroups.keys()]); let unchanged = 0; let added = 0; let removed = 0; let changed = 0; let duplicates = 0;
  for (const id of ids) { const before = previousGroups.get(id) ?? []; const after = incomingGroups.get(id) ?? []; if (before.length > 1 || after.length > 1) duplicates += Math.max(before.length, after.length); const n = Math.min(before.length, after.length); for (let i = 0; i < n; i++) stable(semanticOf(before[i]!)) === stable(semanticOf(after[i]!)) ? unchanged++ : changed++; if (after.length > before.length) added += after.length - before.length; if (before.length > after.length) removed += before.length - after.length; }
  const semanticHashBefore = previous.length ? stable(previous.map(semanticOf)) : null; const semanticHashAfter = stable(incoming.map(semanticOf));
  return { sourceCount: incoming.length, parsedCount: incoming.length, unchanged, added, removed, changed, duplicateLogicalIds: duplicates, semanticHashBefore, semanticHashAfter, noOp: added === 0 && removed === 0 && changed === 0 };
}
