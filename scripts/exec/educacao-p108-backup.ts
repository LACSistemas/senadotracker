import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';

try { (process as unknown as { loadEnvFile?: (p?: string) => void }).loadEnvFile?.('.env'); } catch { /* env already supplied */ }
const out = process.argv[2] ?? 'artifacts/projetoeleitor_p108_prepublication_20261027.dump';
await mkdir('artifacts', { recursive: true });
const args = ['-Fc', '-n', 'civica_exec', '-h', process.env.DB_HOST ?? 'localhost', '-p', process.env.DB_PORT ?? '5432', '-U', process.env.DB_USER ?? '', '-d', process.env.DB_NAME ?? '', '-f', out, '--no-owner', '--no-privileges'];
const env = { ...process.env, PGPASSWORD: process.env.DB_PASSWORD ?? process.env.PGPASSWORD };
const child = spawn('pg_dump', args, { stdio: ['ignore', 'inherit', 'inherit'], env });
const code = await new Promise<number>((resolve) => child.on('close', (c) => resolve(c ?? 1)));
if (code !== 0) throw new Error(`pg_dump exited ${code}`);
console.log(JSON.stringify({ out, database: process.env.DB_NAME, schema: 'civica_exec', format: 'custom' }, null, 2));
