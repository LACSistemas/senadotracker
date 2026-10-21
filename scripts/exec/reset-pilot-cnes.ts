import { writeFile } from 'node:fs/promises';
import { SPECS, lockSlice, RUN_STATUS } from '@senadotracker/db';
import { openPool } from './db.ts';

/**
 * Reinício controlado da carga PILOTO do CNES de uma UF (SP/MG tinham só 202607–202609). O motor de intervalos exige competências contíguas a partir do início
 * e não sabe anteceder histórico; por isso a fatia piloto é desfeita (somente linhas de civica_exec dessa UF e desses 3 datasets) e recarregada de 201301 em diante.
 * O RAW dos três meses é preservado e, depois da recarga, os slice_hash de 202607–202609 devem ser idênticos aos de antes (conferido em outro passo).
 * Salvaguardas: só roda se a UF tiver publicação CNES exclusivamente a partir de 202607 (piloto) e nenhum run mais antigo.
 * Uso: node --import tsx scripts/exec/reset-pilot-cnes.ts <ufCode> <ufCode> ...
 */
const pool = openPool(2);
try {
  for (const ufCode of process.argv.slice(2).map(Number)) {
    const c = await pool.connect();
    try {
      await c.query('BEGIN'); await c.query("SET LOCAL lock_timeout = '15s'");
      for (const ds of [3, 4, 5]) await lockSlice(c, ds, ufCode);
      const mins = (await c.query(`SELECT dataset_id, min(competence)::int m FROM civica_exec.exec_publication WHERE uf = $1 AND dataset_id IN (3,4,5) GROUP BY 1`, [ufCode])).rows;
      if (!mins.length) { console.log(`UF ${ufCode}: nada publicado, nada a desfazer`); await c.query('ROLLBACK'); continue; }
      if (mins.some(r => r.m < 202607)) throw new Error(`UF ${ufCode} já tem histórico anterior a 202607: recusado`);
      const before = (await c.query(`SELECT p.dataset_id, p.competence, encode(r.slice_hash,'hex') h FROM civica_exec.exec_publication p JOIN civica_exec.exec_ingestion_run r USING (run_id) WHERE p.uf = $1 AND p.dataset_id IN (3,4,5) ORDER BY 1,2`, [ufCode])).rows;
      const runs = (await c.query(`SELECT run_id FROM civica_exec.exec_ingestion_run WHERE uf = $1 AND dataset_id IN (3,4,5)`, [ufCode])).rows.map(r => Number(r.run_id));
      const del: Record<string, number> = {};
      for (const spec of [SPECS.cnes_equip_v, SPECS.cnes_leito_v, SPECS.cnes_estab_v]) del[spec.name] = (await c.query(`DELETE FROM civica_exec.${spec.name} WHERE ${spec.scopeSql}`, [ufCode])).rowCount ?? 0;
      del.change_log = (await c.query(`DELETE FROM civica_exec.exec_change_log WHERE run_id = ANY($1::bigint[])`, [runs])).rowCount ?? 0;
      del.publication = (await c.query(`DELETE FROM civica_exec.exec_publication WHERE uf = $1 AND dataset_id IN (3,4,5)`, [ufCode])).rowCount ?? 0;
      await c.query(`UPDATE civica_exec.exec_ingestion_run SET status = $2 WHERE run_id = ANY($1::bigint[])`, [runs, RUN_STATUS.ROLLED_BACK]);
      // identidades criadas só por esta carga piloto (first_seen >= 202607, sem nenhum intervalo remanescente): serão recriadas com o first_seen correto
      del.estab_identity = (await c.query(`DELETE FROM civica_exec.exec_sau_cnes_estab e WHERE e.entity_id IN (SELECT entity_id FROM civica_exec.exec_entity WHERE uf_code = $1) AND e.first_seen >= 202607 AND e.origin = 1
        AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_sau_cnes_estab_v v WHERE v.cnes = e.cnes) AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_sau_hosp_mes_subgrupo h WHERE h.cnes = e.cnes)`, [ufCode])).rowCount ?? 0;
      await c.query('COMMIT');
      await writeFile(`docs/executivo-collector-plan/execucao/saude-nacional-p1/_reset_pilot_${ufCode}.json`, JSON.stringify({ ufCode, at: new Date().toISOString(), deleted: del, hashesBefore: before }, null, 1));
      console.log(`UF ${ufCode}: desfeito`, JSON.stringify(del));
    } catch (e) { try { await c.query('ROLLBACK'); } catch { /* */ } throw e; } finally { c.release(); }
  }
} finally { await pool.end(); }
