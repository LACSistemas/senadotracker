import { writeFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { storageConfig, readManifest } from '../../apps/collector/src/exec/storage.ts';
import { pncpBundleRel, readPncpBundle } from '../../apps/collector/src/exec/pncp.ts';
import { openPool } from './db.ts';

/**
 * Reconciliação da P10.7 (somente leitura): RAW × banco, integridade, valores, vínculos, dupla contagem entre domínios e conferência INDEPENDENTE por amostra (relê o JSON bruto do PNCP e compara campo a campo).
 *   EXEC_DATABASE_URL=<banco> npx tsx scripts/exec/edu-reconcile.ts <lista_scan.jsonl> <saida.json> [n_amostra]
 */
const [listFile, outFile, nArg] = process.argv.slice(2); const N = Number(nArg ?? 60);
const pool = openPool(2);
type Row = Record<string, any>;
const all = async (sql: string, a: unknown[] = []): Promise<Row[]> => (await pool.query(sql, a)).rows as Row[];
const one = async (sql: string, a: unknown[] = []): Promise<Row> => (await all(sql, a))[0]!;
const cnt = async (sql: string): Promise<number> => Number((await one(sql)).n);
const R: Record<string, unknown> = { at: new Date().toISOString() };
try {
  // 1. RAW (varredura) x banco por ano de publicação
  const scan = new Map<string, { y: number; v: number | null; cat: number[]; conf: number }>();
  for await (const l of createInterface({ input: createReadStream(listFile!), crlfDelay: Infinity })) { if (!l.trim()) continue; const x = JSON.parse(l); scan.set(x.id, { y: x.y, v: x.v, cat: x.cat, conf: x.conf }); }
  const byYearScan: Record<string, { n: number; soma: number }> = {};
  for (const x of scan.values()) { const a = byYearScan[x.y] ??= { n: 0, soma: 0 }; a.n++; if (x.v != null && x.v <= 1_000_000_000_00) a.soma += x.v; }
  const db = await all(`SELECT year, count(*)::int n, coalesce(sum(valor_global) FILTER (WHERE NOT outlier), 0)::bigint soma FROM civica_exec.exec_edu_contract GROUP BY year ORDER BY year`);
  const rej = new Map((await all(`SELECT year, sum(rejected)::int n FROM civica_exec.exec_edu_ctr_cov WHERE kind = 1 GROUP BY year`)).map(r => [Number(r.year), Number(r.n)]));
  R.raw_x_banco_por_ano = db.map(r => ({ ano: r.year, banco: r.n, raw: byYearScan[r.year]?.n ?? 0, rejeitados_sem_ente_ou_cnpj: rej.get(r.year) ?? 0, igual_raw_menos_rejeitados: r.n === (byYearScan[r.year]?.n ?? 0) - (rej.get(r.year) ?? 0), igual: r.n === (byYearScan[r.year]?.n ?? 0), soma_banco_centavos: Number(r.soma), soma_raw_centavos: byYearScan[r.year]?.soma ?? 0, soma_igual: Number(r.soma) === (byYearScan[r.year]?.soma ?? 0) }));
  R.total = { raw_ids_unicos: scan.size, banco: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract`) };
  // 2. integridade
  const integ: Record<string, number> = {
    classe_sem_contrato: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_class k WHERE NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract c WHERE c.pncp_id = k.pncp_id)`),
    contrato_sem_classe: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract c WHERE NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract_class k WHERE k.pncp_id = c.pncp_id)`),
    fornecedor_inexistente: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract c WHERE c.supplier IS NOT NULL AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_fin_supplier s WHERE s.cnpj = c.supplier)`),
    mesmo_contrato_duas_chaves: await cnt(`SELECT count(*)::int n FROM (SELECT org_cnpj, seq, split_part(pncp_id, '/', 2) ano FROM civica_exec.exec_edu_contract WHERE seq > 0 GROUP BY 1, 2, 3 HAVING count(*) > 1) t`),
  };
  const dbCls = await all(`SELECT c.pncp_id, c.best_confidence conf, array_agg(k.category ORDER BY k.category) cats FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_edu_contract_class k USING (pncp_id) GROUP BY c.pncp_id, c.best_confidence`);
  let div = 0, ausentes = 0;
  for (const r of dbCls) { const s = scan.get(String(r.pncp_id)); if (!s) { ausentes++; continue; } if (s.conf !== Number(r.conf) || [...s.cat].sort((a, b) => a - b).join() !== (r.cats as number[]).join()) div++; }
  integ.classes_divergentes_da_varredura = div; integ.no_banco_e_fora_da_varredura = ausentes; R.integridade = integ;
  // 3. valores
  R.valores = await one(`SELECT count(*) FILTER (WHERE valor_global IS NULL)::int sem_valor, count(*) FILTER (WHERE outlier)::int outliers, count(*) FILTER (WHERE valor_global = 0)::int zerados, count(*) FILTER (WHERE tipo = 7)::int tipo_empenho FROM civica_exec.exec_edu_contract`);
  R.por_confianca = await all(`SELECT best_confidence conf, count(*)::int n, coalesce(sum(valor_global) FILTER (WHERE NOT outlier), 0)::bigint soma FROM civica_exec.exec_edu_contract GROUP BY 1 ORDER BY 1`);
  // 4. vínculos por chave oficial
  R.vinculos = {
    contratos_com_compra: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract WHERE compra IS NOT NULL`),
    compras_publicadas: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_procurement`),
    contratos_com_compra_publicada: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_edu_procurement p ON p.compra = c.compra`),
    contratos_com_cipi: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract WHERE cipi IS NOT NULL`),
    contratos_cipi_com_obra_publicada: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract c JOIN civica_exec.exec_edu_work w ON w.work_id = c.cipi`),
    termos_publicados: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_term`),
    termos_sem_contrato: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_contract_term t WHERE NOT EXISTS (SELECT 1 FROM civica_exec.exec_edu_contract c WHERE c.pncp_id = t.pncp_id)`),
    obras: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_work`),
    empenhos_de_obras: await cnt(`SELECT count(*)::int n FROM civica_exec.exec_edu_work_commit`),
    relacao_contrato_empenho_pagamento_comprovada: 0,
    nota: 'O PNCP nao publica pagamento e o Obrasgov traz empenho, nao pago: nenhuma relacao contrato-empenho-pagamento e comprovada por chave oficial (mesmo CNPJ ou mesmo valor nao e prova).',
  };
  // 5. dupla contagem entre domínios (Segurança x Educação)
  R.dupla_contagem = await one(`SELECT count(*)::int contratos_nos_dois, coalesce(sum(e.valor_global) FILTER (WHERE NOT e.outlier), 0)::bigint valor_centavos FROM civica_exec.exec_edu_contract e JOIN civica_exec.exec_fin_contract f ON f.pncp_id = e.pncp_id`);
  // 6. conferência independente por amostra (relê o JSON bruto)
  const ids = (await all(`SELECT pncp_id FROM civica_exec.exec_edu_contract ORDER BY md5(pncp_id || 'p107') LIMIT $1`, [N])).map(r => String(r.pncp_id));
  const want = new Set(ids); const raw = new Map<string, any>(); const cfg = storageConfig(); const man = await readManifest(cfg);
  for (let y = 2021; y <= 2026 && raw.size < want.size; y++) for (let m = 1; m <= 12; m++) {
    const rel = pncpBundleRel(y, m); if (!man.has(rel)) continue;
    for await (const pg of readPncpBundle(cfg, rel)) { if (pg.s !== 200) continue; for (const c of (JSON.parse(pg.b) as { data?: any[] }).data ?? []) if (want.has(c.numeroControlePNCP)) raw.set(c.numeroControlePNCP, c); }
  }
  const cents = (v: unknown) => v == null ? null : Math.round(Number(v) * 100);
  const dayOf = (v: unknown) => v ? (v instanceof Date ? v.toISOString() : String(v)).slice(0, 10) : null;
  const rows = await all(`SELECT pncp_id, org_cnpj, valor_global, valor_inicial, supplier, signed, compra, tipo FROM civica_exec.exec_edu_contract WHERE pncp_id = ANY($1)`, [ids]); const bad: unknown[] = [];
  for (const r of rows) {
    const c = raw.get(String(r.pncp_id)); if (!c) { bad.push({ id: r.pncp_id, motivo: 'nao achado no RAW' }); continue; }
    const pj = String(c.tipoPessoa ?? '').toUpperCase() === 'PJ' && /^\d{14}$/.test(c.niFornecedor ?? '');
    const exp = { org: Number(c.orgaoEntidade?.cnpj), vg: cents(c.valorGlobal), vi: cents(c.valorInicial), sup: pj ? Number(c.niFornecedor) : null, signed: dayOf(c.dataAssinatura), compra: c.numeroControlePncpCompra ?? null, tipo: Number(c.tipoContrato?.id ?? 0) };
    const got = { org: Number(r.org_cnpj), vg: r.valor_global == null ? null : Number(r.valor_global), vi: r.valor_inicial == null ? null : Number(r.valor_inicial), sup: r.supplier == null ? null : Number(r.supplier), signed: dayOf(r.signed), compra: r.compra, tipo: Number(r.tipo) };
    if (JSON.stringify(exp) !== JSON.stringify(got)) bad.push({ id: r.pncp_id, exp, got });
  }
  R.conferencia_independente = { amostra: ids.length, achados_no_raw: raw.size, divergencias: bad.length, detalhe: bad.slice(0, 5) };
  await writeFile(outFile!, JSON.stringify(R, null, 1));
  console.log(JSON.stringify({ total: R.total, integridade: R.integridade, dupla: R.dupla_contagem, independente: R.conferencia_independente }));
} finally { await pool.end(); }
