import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { sha256File, storageConfig, type ManifestEntry } from '../../apps/collector/src/exec/storage.ts';

/**
 * Verificação do RAW: compara (a) manifesto × arquivos de uma raiz e, opcionalmente, (b) uma raiz de origem × a de destino.
 * Uso: node --import tsx scripts/exec/raw-verify.ts [--src data/exec-raw] [--csv caminho.csv]
 * Sem --src, só confere o RAW configurado contra o MANIFEST.jsonl dele.
 */
const arg = (k: string) => process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : undefined;
async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const e of await readdir(dir, { withFileTypes: true })) { const p = join(dir, e.name); if (e.isDirectory()) out.push(...await walk(p)); else out.push(p); }
  return out;
}
const cfg = storageConfig();
const src = arg('--src');
const csv = arg('--csv');
const manifest = new Map<string, ManifestEntry>();
for (const line of (await readFile(join(cfg.rawDir, 'MANIFEST.jsonl'), 'utf8')).split('\n')) if (line.trim()) { const e = JSON.parse(line) as ManifestEntry; manifest.set(e.relPath, e); }
const files = (await walk(cfg.rawDir)).map(f => relative(cfg.rawDir, f).split(sep).join('/')).filter(f => f !== 'MANIFEST.jsonl');
let bad = 0, checked = 0, bytes = 0; const rows: string[] = ['dataset,caminho_relativo,bytes,sha256,competencia,uf,retencao,verificacao'];
const missing: string[] = [];
for (const rel of files) {
  const abs = join(cfg.rawDir, rel); const h = await sha256File(abs); const size = (await stat(abs)).size; const m = manifest.get(rel);
  let state = m ? (m.sha256 === h && m.bytes === size ? 'ok_manifesto' : 'DIVERGE_MANIFESTO') : 'fora_do_manifesto';
  if (src) { try { const hs = await sha256File(join(src, rel)); state += hs === h ? '+ok_origem' : '+DIVERGE_ORIGEM'; if (hs !== h) bad++; } catch { state += '+sem_origem'; } }
  if (state.includes('DIVERGE')) bad++;
  checked++; bytes += size;
  rows.push([m?.dataset ?? '', rel, size, h, m?.competence ?? '', m?.uf ?? '', m?.retention ?? '', state].join(','));
}
for (const rel of manifest.keys()) if (!files.includes(rel)) missing.push(rel);
if (csv) { await mkdir(join(csv, '..'), { recursive: true }); await writeFile(csv, rows.join('\n') + '\n'); }
console.log(JSON.stringify({ rawDir: cfg.rawDir, arquivos: checked, bytes, manifestoEntradas: manifest.size, manifestoSemArquivo: missing.length, divergentes: bad, foraDoManifesto: rows.filter(r => r.endsWith('fora_do_manifesto') || r.includes('fora_do_manifesto+')).length }));
if (bad || missing.length) { console.error('FALHA', missing.slice(0, 5)); process.exit(1); }
