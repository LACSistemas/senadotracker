import type { Pool, PoolClient } from 'pg';
import type { RevisionAdapter } from './revision-contract.ts';

/** Generic revision boundary. It deliberately carries opaque payloads: domain adapters own rows. */
export interface RevisionRepository<T> extends RevisionAdapter<T> { noOp(previous: string | null, incoming: string): boolean; }

export class InMemoryRevisionRepository<T> implements RevisionRepository<T> {
  private active: string | null = null; private staged = new Map<string, T>(); private preserved = new Set<string>();
  constructor(initial: string | null = null) { this.active = initial; }
  async getActiveRevision(): Promise<string | null> { return this.active; }
  async stageRevision(revision: string, value: T): Promise<void> { this.staged.set(revision, value); }
  async validateStage(revision: string): Promise<void> { if (!this.staged.has(revision)) throw new Error(`staged revision missing: ${revision}`); }
  async promoteRevisionAtomically(revision: string): Promise<void> { await this.validateStage(revision); this.active = revision; }
  async preservePreviousRevision(revision: string | null): Promise<void> { if (revision) this.preserved.add(revision); }
  noOp(previous: string | null, incoming: string): boolean { return previous === incoming; }
  snapshot(): { active: string | null; staged: string[]; preserved: string[] } { return { active: this.active, staged: [...this.staged.keys()], preserved: [...this.preserved] }; }
}

export interface PostgresRevisionRepositoryOptions { readonly schema: string; readonly house: string; readonly domain: string; readonly table?: string; }
/** SQL boundary only; callers provide opaque staged payload persistence. No domain table knowledge. */
export class PostgresRevisionRepository<T> implements RevisionRepository<T> {
  private readonly table: string;
  constructor(private readonly pool: Pool, private readonly options: PostgresRevisionRepositoryOptions, private readonly persistStage: (client: PoolClient, revision: string, value: T) => Promise<void>, private readonly validate: (client: PoolClient, revision: string) => Promise<void>) { this.table = options.table ?? 'public_domain_revisions'; }
  async getActiveRevision(): Promise<string | null> { const result = await this.pool.query(`SELECT revision_id FROM ${this.options.schema}.active_publications WHERE house=$1 AND domain=$2`, [this.options.house, this.options.domain]); return result.rows[0]?.revision_id ?? null; }
  async stageRevision(revision: string, value: T): Promise<void> { const client = await this.pool.connect(); try { await client.query('BEGIN'); await this.persistStage(client, revision, value); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async validateStage(revision: string): Promise<void> { const client = await this.pool.connect(); try { await this.validate(client, revision); } finally { client.release(); } }
  async promoteRevisionAtomically(revision: string): Promise<void> { const client = await this.pool.connect(); try { await client.query('BEGIN'); await client.query(`UPDATE ${this.options.schema}.${this.table} SET status='rejected' WHERE house=$1 AND domain=$2 AND status='active' AND revision_id<>$3`, [this.options.house, this.options.domain, revision]); await client.query(`INSERT INTO ${this.options.schema}.active_publications(house,domain,revision_id,activated_at) VALUES($1,$2,$3,now()) ON CONFLICT(house,domain) DO UPDATE SET revision_id=excluded.revision_id,activated_at=excluded.activated_at`, [this.options.house, this.options.domain, revision]); await client.query('COMMIT'); } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } }
  async preservePreviousRevision(_revision: string | null): Promise<void> { /* revisions are immutable; rejection changes only the active pointer */ }
  noOp(previous: string | null, incoming: string): boolean { return previous === incoming; }
}
