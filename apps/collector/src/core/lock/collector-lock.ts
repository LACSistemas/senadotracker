export interface CollectorLockKey { readonly house: string; readonly domain: string; readonly provider: string; }
const keyOf = (key: CollectorLockKey): string => `${key.house}:${key.domain}:${key.provider}`;
export class InMemoryCollectorLock {
  private tails = new Map<string, Promise<void>>();
  async withLock<T>(key: CollectorLockKey, operation: () => Promise<T>): Promise<T> { const id = keyOf(key); const previous = this.tails.get(id) ?? Promise.resolve(); let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; }); this.tails.set(id, previous.then(() => gate)); await previous; try { return await operation(); } finally { release(); if (this.tails.get(id) === gate) this.tails.delete(id); } }
}
