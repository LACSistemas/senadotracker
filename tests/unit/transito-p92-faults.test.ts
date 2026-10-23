import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, mkdir, readFile, writeFile, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { zipSync, strToU8 } from 'fflate';
import type { Pool } from 'pg';
import { VolumeError, fetchRaw, readManifest, runPython, storageConfig, volumeGuidOf } from '../../apps/collector/src/exec/storage.ts';
import { collectFrota, collectPrf, collectRenaest, collectSimTransito, fetchChecked, notHtml } from '../../apps/collector/src/exec/transito.ts';

const env = (o: Record<string, string>) => ({ PATH: process.env.PATH ?? '', CIVICA_EXEC_MIN_FREE_GIB: '0', ...o }) as NodeJS.ProcessEnv;
async function sandbox() {
  const dir = await mkdtemp(join(tmpdir(), 'civica-tra-')); await mkdir(join(dir, 'raw'), { recursive: true }); await mkdir(join(dir, 'st'), { recursive: true });
  return { dir, cfg: storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_MANIFESTS_DIR: join(dir, 'raw') })) };
}
const latin = (s: string) => Buffer.from(s, 'latin1');
const sha = (b: Buffer | Uint8Array) => createHash('sha256').update(b).digest('hex');

// ------------------------------------------------------------------------------------------------ extratores (Python)
test('PRF: 1 linha = 1 sinistro (id repetida conta uma vez), três formatos de data, só somas na saída — sem id, km, coordenadas ou horário', async () => {
  const { dir } = await sandbox();
  const csv = ['id;data_inversa;dia_semana;horario;uf;br;km;municipio;causa_acidente;tipo_acidente;classificacao_acidente;fase_dia;sentido_via;condicao_metereologica;tipo_pista;tracado_via;uso_solo;ano;pessoas;mortos;feridos_leves;feridos_graves;ilesos;ignorados;feridos;veiculos',
    '10;11/06/2007;Segunda;15:30:00;MG;381;623.2;OLIVEIRA;x;y;Com Vítimas Fatais;z;w;Ceu Claro;Dupla;Reta;Rural;2007;9;1;4;0;4;0;4;6',
    '10;11/06/2007;Segunda;15:30:00;MG;381;623.2;OLIVEIRA;x;y;Com Vítimas Fatais;z;w;Chuva;Dupla;Reta;Rural;2007;9;1;4;0;4;0;4;6',
    '11;05/07/07;Quinta;10:00:00;MG;381;100;OLIVEIRA;x;y;Sem Vítimas;z;w;Ceu Claro;Dupla;Reta;Rural;2007;2;0;0;0;2;0;0;2',
    '12;2007-12-31;Segunda;10:00:00;SP;116;1;SAO PAULO;x;y;(null);z;w;Ceu Claro;Dupla;Reta;Rural;2007;1;0;0;0;1;0;0;1'].join('\r\n') + '\r\n';
  await writeFile(join(dir, 'datatran2007.zip'), zipSync({ 'datatran2007.csv': latin(csv) }));
  const r = await runPython('scripts/exec/prf_extract.py', [join(dir, 'datatran2007.zip'), join(dir, 'o.json'), '--year', '2007']); assert.equal(r.code, 0, r.err);
  const j = JSON.parse(await readFile(join(dir, 'o.json'), 'utf8'));
  assert.equal(j.sinistros, 3); assert.equal(j.dup_ids, 1); assert.equal(j.rows_read, 4); assert.equal(j.other_year, 0);
  const mg = j.rows.filter((x: unknown[]) => x[0] === 'MG').sort((a: number[], b: number[]) => a[2]! - b[2]!);
  assert.deepEqual(mg.map((x: unknown[]) => [x[2], x[3], x[4]]), [[200706, 1, 1], [200707, 1, 0]]); assert.equal(j.classes.ign, 1);
  const txt = JSON.stringify(j); for (const forbidden of ['623.2', '15:30', 'Segunda', 'OLIVEIRA|', '"11"', '"12"']) assert.equal(txt.includes(forbidden), false, forbidden);
  await writeFile(join(dir, 'bad.csv'), latin('a;b\r\n1;2\r\n')); const bad = await runPython('scripts/exec/prf_extract.py', [join(dir, 'bad.csv'), join(dir, 'b.json'), '--year', '2007']); assert.notEqual(bad.code, 0); assert.match(bad.err, /colunas ausentes/); assert.equal(existsSync(join(dir, 'b.json')), false);
});

test('frota: XLSX com título, fórmula e cabeçalho repetido → linhas de município, vazio ≠ 0, UF/MUNICIPIO e ruído ignorados', async () => {
  const { dir } = await sandbox();
  const H = ['UF', 'MUNICIPIO', 'TOTAL', 'AUTOMOVEL', 'BONDE', 'CAMINHAO', 'CAMINHAO TRATOR', 'CAMINHONETE', 'CAMIONETA', 'CHASSI PLATAF', 'CICLOMOTOR', 'MICRO-ONIBUS', 'MOTOCICLETA', 'MOTONETA', 'ONIBUS', 'QUADRICICLO', 'REBOQUE', 'SEMI-REBOQUE', 'SIDE-CAR', 'OUTROS', 'TRATOR ESTEI', 'TRATOR RODAS', 'TRICICLO', 'UTILITARIO'];
  const col = (i: number) => (i < 26 ? String.fromCharCode(65 + i) : 'A' + String.fromCharCode(65 + i - 26));
  const cell = (v: string | number | null, r: number, c: number) => v === null ? '' : typeof v === 'number' ? `<c r="${col(c)}${r}"><v>${v}</v></c>` : `<c r="${col(c)}${r}" t="inlineStr"><is><t>${v.replace(/&/g, '&amp;')}</t></is></c>`;
  const num = (n: number) => [n, ...new Array(21).fill(0)];
  const data: Array<Array<string | number | null>> = [['Frota de veículos, por tipo e com placa, segundo os Municípios da Federação - JUN/2014'], [null, null, '=SUM(C4:C9)'], H, H, ['AC', 'ACRELANDIA', ...num(4042)], ['AC', 'ASSIS BRASIL', 1046, null, ...new Array(20).fill(0)], ['AC', 'MUNICIPIO NAO INFORMADO', ...num(9)], [null, 'TOTAL', 5097]];
  const sheet = `<?xml version="1.0"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${data.map((r, i) => `<row r="${i + 1}">${r.map((v, c) => cell(v, i + 1, c)).join('')}</row>`).join('')}</sheetData></worksheet>`;
  const wb = '<?xml version="1.0"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="JUN_2014" sheetId="1" r:id="rId1"/></sheets></workbook>';
  const rels = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>';
  const ct = '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>';
  const root = '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>';
  await writeFile(join(dir, 'f.xlsx'), zipSync({ '[Content_Types].xml': strToU8(ct), '_rels/.rels': strToU8(root), 'xl/workbook.xml': strToU8(wb), 'xl/_rels/workbook.xml.rels': strToU8(rels), 'xl/worksheets/sheet1.xml': strToU8(sheet) }));
  const r = await runPython('scripts/exec/frota_extract.py', [join(dir, 'f.xlsx'), join(dir, 'f.json'), '--tmp', dir]); assert.equal(r.code, 0, r.err);
  const j = JSON.parse(await readFile(join(dir, 'f.json'), 'utf8'));
  assert.equal(j.header.length, 22); assert.equal(j.header[0], 'TOTAL'); assert.match(j.title, /JUN\/2014/); assert.equal(j.formula_total, '=SUM(C4:C9)');
  const byName = Object.fromEntries(j.rows.map((x: unknown[]) => [x[1], x]));
  assert.equal(byName['ACRELANDIA'][2], 4042); assert.equal(byName['ASSIS BRASIL'][3], null, 'célula vazia permanece nula'); assert.equal(byName['MUNICIPIO NAO INFORMADO'][2], 9);
  assert.equal(j.rows.some((x: unknown[]) => x[1] === 'TOTAL'), false, 'linha de total sem UF não entra');
  await writeFile(join(dir, 'x.xls'), Buffer.from('<!DOCTYPE html><html></html>')); const bad = await runPython('scripts/exec/frota_extract.py', [join(dir, 'x.xls'), join(dir, 'x.json'), '--tmp', dir]); assert.notEqual(bad.code, 0); assert.equal(existsSync(join(dir, 'x.json')), false);
});

test('infrações: layouts wide UTF-16, wide com aspas duplicadas e long com colunas em outra ordem dão o mesmo resultado; milhar com ponto; vazio ≠ 0', async () => {
  const { dir } = await sandbox();
  const wideLines = ['"UF Jurisdição Veículo (Desc)","ACRE","ALAGOAS"', '"Infração","Qt Infração c/ NP","Qt Infração c/ NP"', '"5002","1.234","7"', '"5010","","3"', '"9130","","1"'];
  await writeFile(join(dir, 'wide.csv'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(wideLines.join('\r\n') + '\r\n', 'utf16le')]));
  const dq = wideLines.map(l => '"' + l.replace(/"/g, '""') + '"').join('\r\n') + '\r\n';
  await writeFile(join(dir, 'dq.csv'), Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(dq, 'utf16le')]));
  await writeFile(join(dir, 'long.csv'), Buffer.from('﻿COD_INFRACAO;UF;QUANTIDADE\r\n5002;ACRE;1234\r\n5002;ALAGOAS;7\r\n5010;ALAGOAS;3\r\n9130;ALAGOAS;1\r\n5010;ACRE;\r\n', 'utf8'));
  const out: Array<Array<[string, number, number]>> = [];
  for (const f of ['wide', 'dq', 'long']) { const r = await runPython('scripts/exec/infr_extract.py', [join(dir, f + '.csv'), join(dir, f + '.json')]); assert.equal(r.code, 0, `${f}: ${r.err}`); const j = JSON.parse(await readFile(join(dir, f + '.json'), 'utf8')); out.push((j.rows as Array<[string, number, number]>).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))); }
  assert.deepEqual(out[0], [['ACRE', 5002, 1234], ['ALAGOAS', 5002, 7], ['ALAGOAS', 5010, 3], ['ALAGOAS', 9130, 1]]); assert.deepEqual(out[1], out[0]); assert.deepEqual(out[2], out[0]);
  await writeFile(join(dir, 'other.csv'), 'REGIAO;UF;SEXO\r\nN;AC;M\r\n'); const bad = await runPython('scripts/exec/infr_extract.py', [join(dir, 'other.csv'), join(dir, 'o.json')]); assert.notEqual(bad.code, 0); assert.match(bad.err, /layout desconhecido/);
});

test('RENAEST: agregação em fluxo sem dado pessoal; veículo órfão e código IBGE inválido são contados; saída sem endereço, CEP, coordenadas, hora ou número do acidente', async () => {
  const { dir } = await sandbox();
  const A = 'num_acidente;chv_localidade;data_acidente;uf_acidente;ano_acidente;mes_acidente;mes_ano_acidente;codigo_ibge;dia_semana;fase_dia;tp_acidente;cond_meteorologica;end_acidente;num_end_acidente;cep_acidente;bairro_acidente;km_via_acidente;latitude_acidente;longitude_acidente;hora_acidente;tp_rodovia;cond_pista;tp_cruzamento;tp_pavimento;tp_curva;lim_velocidade;tp_pista;ind_guardrail;ind_cantcentral;ind_acostamento;qtde_acidente;qtde_acid_com_obitos;qtde_envolvidos;qtde_feridosilesos;qtde_obitos';
  const ac = (n: number, uf: string, ibge: string, ym: [number, number], tp: string, fat: number, env: number, ob: number) => [n, `${uf}${ibge}${ym[0]}${String(ym[1]).padStart(2, '0')}`, '2024-01-05', uf, ym[0], ym[1], `${String(ym[1]).padStart(2, '0')}${ym[0]}`, ibge, 'x', 'DIA', tp, 'CLARO', 'RUA SECRETA 123', '123', '29000-000', 'CENTRO', '10', '-20,1', '-40,2', '12:30', 'MUNICIPAL', 'x', 'x', 'x', 'x', '60', 'x', 'x', 'x', 'x', 1, fat, env, env - ob, ob].join(';');
  const acidentes = [A, ac(1, 'ES', '3205309', [2024, 1], 'COLISAO', 1, 3, 1), ac(2, 'ES', '3205309', [2024, 1], 'CHOQUE', 0, 2, 0), ac(3, 'ES', '0000000', [2024, 2], 'COLISAO', 0, 1, 0), ac(4, 'RS', '4314902', [2024, 1], 'COLISAO', 1, 1, 1)].join('\r\n') + '\r\n';
  const vit = ['num_acidente;chv_localidade;data_acidente;uf_acidente;ano_acidente;mes_acidente;mes_ano_acidente;faixa_idade;genero;tp_envolvido;gravidade_lesao;equip_seguranca;ind_motorista;susp_alcool;qtde_envolvidos;qtde_feridosilesos;qtde_obitos',
    '1;k;d;ES;2024;1;012024;ENTRE 30 E 34 ANOS;MASCULINO;MOTORISTA;OBITO;x;SIM;x;1;0;1', '1;k;d;ES;2024;1;012024;ENTRE 18 E 24 ANOS;FEMININO;PASSAGEIROS;LEVE;x;NAO;x;2;2;0', '2;k;d;ES;2024;1;012024;NAO INFORMADO;MASCULINO;MOTORISTA;SEM FERIMENTO;x;SIM;x;2;2;0'].join('\r\n') + '\r\n';
  const veic = ['num_acidente;tipo_veiculo;ind_veic_estrangeiro;qtde_veiculos', '1;AUTOMOVEL;NAO;2', '2;MOTOCICLETA;NAO;1', '999;AUTOMOVEL;NAO;4'].join('\r\n') + '\r\n';
  const loc = ['chv_localidade;ano_referencia;mes_referencia;mes_ano_referencia;regiao;uf;codigo_ibge;municipio;regiao_metropolitana;qtde_habitantes;frota_total;frota_circulante', 'ES3205309202401;2024;01;012024;SUDESTE;ES;3205309;VITORIA;nao;300000;1;1', 'ES3205200202401;2024;01;012024;SUDESTE;ES;3205200;VILA VELHA;nao;400000;1;1', 'ES3205309202402;2024;02;022024;SUDESTE;ES;3205309;VITORIA;nao;300000;1;1'].join('\r\n') + '\r\n';
  await writeFile(join(dir, 'r.zip'), zipSync({ 'Acidentes_DadosAbertos_20260912.csv': latin(acidentes), 'Vitimas_DadosAbertos_20260912.csv': latin(vit), 'TipoVeiculo_DadosAbertos_20260912.csv': latin(veic), 'Localidade_DadosAbertos_20260912.csv': latin(loc) }));
  const r = await runPython('scripts/exec/renaest_extract.py', [join(dir, 'r.zip'), join(dir, 'r.json')]); assert.equal(r.code, 0, r.err);
  const j = JSON.parse(await readFile(join(dir, 'r.json'), 'utf8'));
  assert.equal(j.acidentes, 4); assert.equal(j.veiculos_total, 7); assert.equal(j.veiculos_orfaos, 1);
  const es = j.muni.filter((x: unknown[]) => x[0] === 'ES' && x[2] === 202401).sort((a: unknown[], b: unknown[]) => String(a[1]).localeCompare(String(b[1])));
  assert.deepEqual(es[0].slice(3), [2, 1, 1, 5, 4]); assert.equal(j.muni.some((x: unknown[]) => x[1] === '0000000' && x[3] === 1), true);
  assert.deepEqual(j.gravidade.filter((x: unknown[]) => x[0] === 'ES').map((x: unknown[]) => [x[2], x[3]]).sort(), [['LEVE', 2], ['OBITO', 1], ['SEM FERIMENTO', 2]]);
  assert.deepEqual(j.veiculo.map((x: unknown[]) => [x[2], x[3]]).sort(), [['AUTOMOVEL', 2], ['MOTOCICLETA', 1]]);
  assert.deepEqual(j.cov.filter((x: unknown[]) => x[0] === 'ES' && x[1] === 202401).map((x: unknown[]) => x.slice(2)), [[2, 1, 1]]);
  const txt = JSON.stringify(j); for (const forbidden of ['RUA SECRETA', '29000-000', 'CENTRO', '-20,1', '12:30', '2024-01-05', 'MASCULINO', 'FEMININO', 'ENTRE 30']) assert.equal(txt.includes(forbidden), false, forbidden);
});

// ------------------------------------------------------------------------------------------------ rede: HTML por limite de taxa, queda no meio do download, deduplicação
async function serve(handler: Parameters<typeof createServer>[1]): Promise<{ url: string; server: Server }> {
  const server = createServer(handler); await new Promise<void>(ok => server.listen(0, '127.0.0.1', ok));
  const addr = server.address(); return { url: `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : 0}`, server };
}
test('portal que devolve HTML (limite de taxa) é rejeitado, nada vai ao RAW nem ao manifesto, e a tentativa seguinte recupera o arquivo', async () => {
  const { cfg, dir } = await sandbox(); const payload = Buffer.from('UF;Cod_Infracao;Quantidade\r\nACRE;5002;25\r\n'); let hits = 0;
  const { url, server } = await serve((_req, res) => { hits++; if (hits <= 2) { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!DOCTYPE html><html><body>muitas requisições</body></html>'); } else { res.writeHead(200, { 'content-type': 'text/csv', 'content-length': payload.length }); res.end(payload); } });
  try {
    await assert.rejects(fetchRaw(cfg, { url: `${url}/a.csv`, relPath: 'transito/x/a.csv', competence: 202401, uf: 0, retention: 1, dataset: 't', accept: notHtml, retries: 0 }), /conteúdo inesperado/);
    assert.equal(existsSync(join(dir, 'raw', 'transito', 'x', 'a.csv')), false); assert.equal(existsSync(join(dir, 'raw', 'transito', 'x', 'a.csv.part')), false); assert.equal(existsSync(join(dir, 'raw', 'MANIFEST.jsonl')), false);
    const ok = await fetchChecked(cfg, { url: `${url}/a.csv`, relPath: 'transito/x/a.csv', competence: 202401, uf: 0, retention: 1, dataset: 't', accept: notHtml }, 3);
    assert.equal(ok.sha256, sha(payload)); assert.equal((await readManifest(cfg)).size, 1); assert.equal(hits >= 3, true);
  } finally { server.close(); }
});

test('retomada real de download parcial: o servidor derruba a conexão em 1 MiB; o curl retoma com Range e o arquivo final é idêntico (SHA-256)', async () => {
  const { cfg, dir } = await sandbox(); const payload = Buffer.alloc(4 * 1024 * 1024); for (let i = 0; i < payload.length; i++) payload[i] = (i * 31 + 7) & 255;
  const ranges: Array<string | undefined> = []; let first = true;
  const { url, server } = await serve((req, res) => {
    const range = req.headers.range; ranges.push(range);
    const start = range ? Number(/bytes=(\d+)-/.exec(range)![1]) : 0;
    if (range) res.writeHead(206, { 'content-length': payload.length - start, 'content-range': `bytes ${start}-${payload.length - 1}/${payload.length}`, 'accept-ranges': 'bytes' });
    else res.writeHead(200, { 'content-length': payload.length, 'accept-ranges': 'bytes' });
    if (first && !range) { first = false; res.write(payload.subarray(0, 1024 * 1024)); setTimeout(() => res.destroy(), 80); return; }
    res.end(payload.subarray(start));
  });
  try {
    const e = await fetchRaw(cfg, { url: `${url}/grande.zip`, relPath: 'transito/prf/grande.zip', competence: 202401, uf: 0, retention: 1, dataset: 't', retries: 3 });
    assert.equal(e.bytes, payload.length); assert.equal(e.sha256, sha(payload));
    assert.equal(sha(await readFile(join(dir, 'raw', 'transito', 'prf', 'grande.zip'))), sha(payload));
    assert.ok(ranges.some(r => r && /^bytes=\d+-$/.test(r) && Number(/(\d+)/.exec(r)![1]) >= 1024 * 1024 - 1), `nenhuma requisição Range de retomada: ${JSON.stringify(ranges)}`);
    assert.equal(existsSync(join(dir, 'raw', 'transito', 'prf', 'grande.zip.part')), false);
  } finally { server.close(); }
});

test('fonte republicada: mesmo conteúdo em outra pasta não duplica (dedupeByHash); conteúdo diferente vira nova versão', async () => {
  const { cfg, dir } = await sandbox(); let body = Buffer.from('versao-1'.repeat(1000));
  const { url, server } = await serve((_r, res) => { res.writeHead(200, { 'content-length': body.length }); res.end(body); });
  try {
    const a = await fetchRaw(cfg, { url: `${url}/f`, relPath: 'transito/d1/f.xlsx', competence: 1, uf: 0, retention: 1, dataset: 't', dedupeByHash: true });
    const b = await fetchRaw(cfg, { url: `${url}/f`, relPath: 'transito/d2/f.xlsx', competence: 1, uf: 0, retention: 1, dataset: 't', dedupeByHash: true });
    assert.equal(b.reused, true); assert.equal(b.relPath, a.relPath); assert.equal(existsSync(join(dir, 'raw', 'transito', 'd2', 'f.xlsx')), false);
    body = Buffer.from('versao-2'.repeat(1000));
    const c = await fetchRaw(cfg, { url: `${url}/f`, relPath: 'transito/d3/f.xlsx', competence: 1, uf: 0, retention: 1, dataset: 't', dedupeByHash: true });
    assert.equal(c.reused, false); assert.notEqual(c.sha256, a.sha256); assert.equal((await readManifest(cfg)).size, 2);
  } finally { server.close(); }
});

test('SSD ausente ou trocado: nenhuma coleta de trânsito lê o banco nem grava', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'civica-vol-')); const real = await volumeGuidOf(dir); if (process.platform !== 'win32' || !real) return;
  const cfg = storageConfig(env({ CIVICA_EXEC_RAW_DIR: join(dir, 'raw'), CIVICA_EXEC_STAGING_DIR: join(dir, 'st'), CIVICA_EXEC_VOLUME_ID: '00000000-0000-0000-0000-000000000000' }));
  const pool = { query: () => { throw new Error('o banco não deveria ser consultado'); } } as unknown as Pool;
  for (const run of [() => collectSimTransito(pool, cfg, { year: 2024, ufs: ['ES'] }), () => collectFrota(pool, cfg, { inventory: [] }), () => collectPrf(pool, cfg, { ids: new Map() }), () => collectRenaest(pool, cfg, {})]) await assert.rejects(run(), VolumeError);
  assert.equal(existsSync(join(dir, 'raw')), false); void readdir; void stat;
});
