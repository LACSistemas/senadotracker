import { openPool } from './db.ts';
import { JUDICIARY_SCHEMA } from '../../packages/db/src/postgres-judiciary.ts';
import { getJudiciaryExpenseByIncisoNational } from '../../packages/db/src/postgres-judiciary-financial.ts';

const pool = openPool(2);
const fmt = (cents: number) => `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
try {
  const db = (await pool.query<{ current_database: string }>('SELECT current_database()')).rows[0]?.current_database;
  if (db !== 'projetoeleitor_db') throw new Error(`DATABASE_GUARD failed: ${db}`);

  const rows = await getJudiciaryExpenseByIncisoNational(pool);
  console.log('--- Por Inciso (nacional, todos os anos) ---');
  for (const r of rows) console.log(`${r.inciso_code ?? '?'} | ${r.label} | ${r.nature} | ${fmt(Number(r.amount_cents))} | ${r.tribunals_reporting} tribunais`);

  const naoClassificado = rows.find(r => r.inciso_code === null);
  console.log(`\nBalde "Não classificado": ${naoClassificado ? fmt(Number(naoClassificado.amount_cents)) : 'R$ 0,00 (nenhuma linha)'}`);

  const totalDespesa = rows.filter(r => r.nature === 'DESPESA').reduce((s, r) => s + Number(r.amount_cents), 0);
  console.log(`\nTotal "despesa corrente" nacional (exclui Inciso VI/Receitas): ${fmt(totalDespesa)}`);

  const sumFn = rows.reduce((s, r) => s + Number(r.amount_cents), 0);
  const sumRaw = Number((await pool.query(`SELECT sum(amount_cents)::bigint s FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE publication_revision_id=(SELECT revision_id FROM ${JUDICIARY_SCHEMA}.jud_publication_revision WHERE scope='JUD_FINANCE' AND is_active=true) AND budget_stage='EXPENSE_REPORTED'`)).rows[0]?.s ?? 0);
  console.log(`\nConferência de soma: função=${fmt(sumFn)} vs raw EXPENSE_REPORTED=${fmt(sumRaw)} — ${sumFn === sumRaw ? 'OK, nenhuma linha perdida' : 'DIVERGENTE — investigar'}`);

  console.log('\n--- Cobertura por tribunal e Inciso (quem falta em cada um) ---');
  const byInciso = await pool.query(`
    SELECT code, array_agg(DISTINCT tribunal_id ORDER BY tribunal_id) AS reportam
    FROM (SELECT DISTINCT tribunal_id, ${JUDICIARY_SCHEMA}.jud_fin_inciso_code(expense_category,tribunal_id,account) AS code
          FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE budget_stage='EXPENSE_REPORTED') s
    WHERE code IS NOT NULL GROUP BY code ORDER BY code`);
  const todosTribunais = [...new Set((await pool.query(`SELECT DISTINCT tribunal_id FROM ${JUDICIARY_SCHEMA}.jud_fin_fact WHERE budget_stage='EXPENSE_REPORTED'`)).rows.map(r => r.tribunal_id as string))].sort();
  for (const r of byInciso.rows) {
    const reportam: string[] = r.reportam;
    const faltam = todosTribunais.filter(t => !reportam.includes(t));
    console.log(`Inciso ${r.code}: ${reportam.length}/${todosTribunais.length} tribunais${faltam.length ? ` — faltam: ${faltam.join(', ')}` : ''}`);
  }
} catch (e) { console.error(e); process.exitCode = 1; } finally { await pool.end(); }
