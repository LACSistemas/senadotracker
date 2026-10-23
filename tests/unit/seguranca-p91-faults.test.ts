import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import type { Pool } from 'pg';
import { VolumeError, fetchRaw, runPython, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';
import { collectSimSeg, extractSim, extractVde, locateSimFile, type VdeFile } from '../../apps/collector/src/exec/seguranca.ts';

const env = (o: Record<string, string>) => ({ PATH: process.env.PATH ?? '', CIVICA_EXEC_MIN_FREE_GIB: '0', ...o }) as NodeJS.ProcessEnv;
async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'civica-seg-')); await mkdir(join(dir, 'raw'), { recursive: true }); await mkdir(join(dir, 'st'), { recursive: true });
  return { dir, cfg: storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_MANIFESTS_DIR: join(dir, 'raw') })) };
}
// XLSX mínimo (sem estilos): células inlineStr/numéricas, como o parser em fluxo espera
const col = (i: number) => String.fromCharCode(65 + i);
function xlsx(header: string[], rows: Array<Array<string | number | null>>): Uint8Array {
  const cell = (v: string | number | null, r: number, c: number) => v === null ? '' : typeof v === 'number' ? `<c r="${col(c)}${r}"><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="inlineStr"><is><t>${v.replace(/&/g, '&amp;')}</t></is></c>`;
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${[header, ...rows].map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, i + 1, c)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  return zipSync({ 'xl/worksheets/sheet1.xml': strToU8(sheet) });
}
const HEAD = ['uf', 'municipio', 'evento', 'data_referencia', 'agente', 'arma', 'faixa_etaria', 'feminino', 'masculino', 'nao_informado', 'total_vitima', 'total', 'total_peso', 'abrangencia'];
const serial = (iso: string) => Math.round((Date.parse(iso) - Date.parse('1899-12-30')) / 86400000);
const row = (uf: string, mun: string, ev: string, d: string, vit: number | null, tot: number | null, peso: number | null, ab = 'Estadual') => [uf, mun, ev, serial(d), null, null, null, null, null, null, vit, tot, peso, ab];

test('XLSX válido: soma linhas repetidas, preserva vazio ≠ zero, separa vítimas/total/peso e lista só chaves ≠ 0', async () => {
  const { dir } = await sandbox(); const src = join(dir, 'v.xlsx'); const out = join(dir, 'v.json');
  await writeFile(src, xlsx(HEAD, [
    row('DF', 'BRASÍLIA', 'Homicídio doloso', '2024-01-01', 2, null, null), row('DF', 'BRASÍLIA', 'Homicídio doloso', '2024-01-01', 3, null, null), row('DF', 'NÃO INFORMADO', 'Homicídio doloso', '2024-01-01', 0, null, null),
    row('ES', 'NÃO INFORMADO', 'Apreensão de Cocaína', '2024-01-01', null, 0, 12.5), row('ES', 'NÃO INFORMADO', 'Roubo de veículo', '2024-02-01', null, 4, null), row('ES', 'NÃO INFORMADO', 'Roubo de veículo', '2024-03-01', null, 0, null)]));
  const r = await runPython('scripts/exec/vde_extract.py', [src, out]); assert.equal(r.code, 0, r.err);
  const j = JSON.parse(await readFile(out, 'utf8'));
  assert.equal(j.rows_read, 6);
  const df = j.rows.find((x: unknown[]) => x[0] === 'DF' && x[1] === 'BRASÍLIA'); assert.equal(df[5], 5); assert.equal(df[8], 1, 'uma linha repetida somada');
  assert.equal(j.rows.some((x: unknown[]) => x[1] === 'NÃO INFORMADO' && x[0] === 'DF'), false, 'zero não vai à lista de valores');
  const coc = j.rows.find((x: unknown[]) => x[2] === 'Apreensão de Cocaína'); assert.equal(coc[7], 12.5); assert.equal(coc[6], 0);
  assert.deepEqual(j.competences, [202401, 202402, 202403]);
  const cv = j.cov.find((c: { evento: string; comp: number }) => c.evento === 'Roubo de veículo' && c.comp === 202403); assert.equal(cv.nz, 0); assert.equal(cv.lin, 1);
});

test('XLSX corrompido ou sem colunas obrigatórias falha com código ≠ 0 e não deixa saída parcial', async () => {
  const { dir } = await sandbox();
  await writeFile(join(dir, 'bad.xlsx'), Buffer.from('isto não é um zip'));
  const a = await runPython('scripts/exec/vde_extract.py', [join(dir, 'bad.xlsx'), join(dir, 'a.json')]); assert.notEqual(a.code, 0); assert.equal(existsSync(join(dir, 'a.json')), false);
  await writeFile(join(dir, 'noc.xlsx'), xlsx(HEAD.filter(h => h !== 'total_peso'), [['ES', 'X', 'Y', 45000, 1, 1, 1, 1, 1, 1, 1, 'Estadual']]));
  const b = await runPython('scripts/exec/vde_extract.py', [join(dir, 'noc.xlsx'), join(dir, 'b.json')]); assert.notEqual(b.code, 0); assert.match(b.err, /colunas ausentes/); assert.equal(existsSync(join(dir, 'b.json')), false);
  const trunc = xlsx(HEAD, [row('ES', 'VITÓRIA', 'Homicídio doloso', '2024-01-01', 1, null, null)]); await writeFile(join(dir, 'trunc.xlsx'), trunc.slice(0, Math.floor(trunc.length / 2)));
  const c = await runPython('scripts/exec/vde_extract.py', [join(dir, 'trunc.xlsx'), join(dir, 'c.json')]); assert.notEqual(c.code, 0);
});

test('DBC inválido do SIM falha sem produzir agregados', async () => {
  const { dir } = await sandbox(); await writeFile(join(dir, 'DOES2024.dbc'), Buffer.from('não é um DBC'));
  const r = await runPython('scripts/exec/sim_seg_extract.py', [join(dir, 'DOES2024.dbc'), join(dir, 'o.json'), '--year', '2024', '--tmp', join(dir, 'st')]);
  assert.notEqual(r.code, 0); assert.equal(existsSync(join(dir, 'o.json')), false);
});

test('arquivo incompleto no RAW (tamanho ≠ manifesto) é recusado antes de decodificar', async () => {
  const { dir, cfg } = await sandbox(); await mkdir(join(dir, 'raw', 'datasus', 'sim', 'definitivo'), { recursive: true });
  await writeFile(join(dir, 'raw', 'datasus', 'sim', 'definitivo', 'DOES2024.dbc'), Buffer.alloc(100));
  await writeFile(join(dir, 'raw', 'MANIFEST.jsonl'), JSON.stringify({ url: 'ftp://x', relPath: 'datasus/sim/definitivo/DOES2024.dbc', sha256: 'ab'.repeat(32), bytes: 5000, fetchedAt: '2026-10-20T00:00:00Z', sourceModifiedAt: null, competence: 202401, uf: 32, retention: 1, dataset: 'sim' }) + '\n');
  const f = await locateSimFile(cfg, 'ES', 2024); assert.ok(f); assert.equal(f.prelim, false);
  await assert.rejects(extractSim(cfg, f), /tamanho 100 difere do manifesto/);
  assert.equal((await readdir(join(dir, 'st'))).length, 0, 'nada foi escrito no staging');
  assert.equal(await locateSimFile(cfg, 'ES', 2013), null);
});

test('definitivo substitui preliminar na escolha do arquivo; preliminar mais recente vence entre preliminares', async () => {
  const { dir, cfg } = await sandbox();
  const e = (rel: string, at: string) => JSON.stringify({ url: 'x', relPath: rel, sha256: rel.length.toString(16).padStart(64, '0'), bytes: 1, fetchedAt: at, sourceModifiedAt: null, competence: 202501, uf: 32, retention: 1, dataset: 'sim' });
  await writeFile(join(dir, 'raw', 'MANIFEST.jsonl'), [e('datasus/sim/prelim/2026-10-20/DOES2025.dbc', '2026-10-20T10:00:00Z'), e('datasus/sim/prelim/2026-10-21/DOES2025.dbc', '2026-10-21T10:00:00Z')].join('\n') + '\n');
  assert.equal((await locateSimFile(cfg, 'ES', 2025))!.relPath, 'datasus/sim/prelim/2026-10-21/DOES2025.dbc');
  await writeFile(join(dir, 'raw', 'MANIFEST.jsonl'), [e('datasus/sim/prelim/2026-10-21/DOES2025.dbc', '2026-10-21T10:00:00Z'), e('datasus/sim/definitivo/DOES2025.dbc', '2026-11-01T10:00:00Z')].join('\n') + '\n');
  const f = (await locateSimFile(cfg, 'ES', 2025))!; assert.equal(f.prelim, false); assert.match(f.relPath, /definitivo/);
});

test('download interrompido/indisponível: erro, nenhum arquivo parcial e nenhuma entrada no manifesto', async () => {
  const { dir, cfg } = await sandbox();
  await assert.rejects(fetchRaw(cfg, { url: 'http://127.0.0.1:9/bancovde-2099.xlsx', relPath: 'seguranca/sinesp-vde/2026-10-21/bancovde-2099.xlsx', competence: 209901, uf: 0, retention: 1, dataset: 'sinesp_vde', userAgent: 'teste' }), /download falhou/);
  assert.equal(existsSync(join(dir, 'raw', 'seguranca', 'sinesp-vde', '2026-10-21', 'bancovde-2099.xlsx')), false);
  assert.equal(existsSync(join(dir, 'raw', 'MANIFEST.jsonl')), false);
});

test('cache de extração do VDE é reaproveitado (hash do arquivo + versão do parser) e a extração é a do arquivo certo', async () => {
  const { dir, cfg } = await sandbox(); const rel = 'seguranca/sinesp-vde/2026-10-21/bancovde-2024.xlsx'; await mkdir(join(dir, 'raw', 'seguranca', 'sinesp-vde', '2026-10-21'), { recursive: true });
  const bytes = xlsx(HEAD, [row('ES', 'VITÓRIA', 'Homicídio doloso', '2024-01-01', 4, null, null)]); await writeFile(join(dir, 'raw', rel), bytes);
  const f: VdeFile = { year: 2024, reused: false, entry: { url: 'x', relPath: rel, sha256: 'cd'.repeat(32), bytes: bytes.length, fetchedAt: '2026-10-21T00:00:00Z', sourceModifiedAt: null, competence: 202401, uf: 0, retention: 1, dataset: 'sinesp_vde' } };
  const j1 = await extractVde(cfg, f); assert.equal(j1.rows.length, 1);
  await writeFile(join(dir, 'raw', rel), Buffer.from('apagado'));      // se o cache não fosse usado, a segunda extração falharia
  const j2 = await extractVde(cfg, f); assert.deepEqual(j2.rows, j1.rows);
});

test('SSD ausente ou trocado: a coleta aborta com VolumeError antes de qualquer leitura de banco ou gravação', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-vol-')); const real = await volumeGuidOf(dir);
  if (process.platform !== 'win32' || !real) return;
  const cfg = storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_VOLUME_ID: '00000000-0000-0000-0000-000000000000' }));
  const pool = { query: () => { throw new Error('o banco não deveria ser consultado'); } } as unknown as Pool;
  await assert.rejects(collectSimSeg(pool, cfg, { year: 2024, ufs: ['ES'] }), VolumeError);
  assert.equal(existsSync(join(dir, 'raw')), false);
});
