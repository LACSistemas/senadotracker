import { openPool } from './db.ts';
const pool = openPool(2);
const checks = {
  duplicateFacilityKeys: (await pool.query(`select count(*)::int n from (select source_system,source_key from civica_exec.exec_dam_facility group by 1,2 having count(*)>1) x`)).rows[0].n,
  duplicateAtlasCodes: (await pool.query(`select count(*)::int n from (select ibge7 from civica_exec.exec_dam_atlas_municipality group by 1 having count(*)>1) x`)).rows[0].n,
  facilityRows: (await pool.query(`select source_system,count(*)::int n from civica_exec.exec_dam_facility group by 1 order by 1`)).rows,
  atlasRows: (await pool.query(`select count(*)::int n from civica_exec.exec_dam_atlas_municipality`)).rows[0].n,
  indicatorDefinitions: (await pool.query(`select count(*)::int n from civica_exec.exec_ind_def where indicator_id between 13001 and 13026`)).rows[0].n,
  indicatorValues: (await pool.query(`select count(*)::int n from civica_exec.exec_ind_value where indicator_id between 13001 and 13026`)).rows[0].n,
  activePublications: (await pool.query(`select dataset_id,run_id,state from civica_exec.exec_publication where dataset_id in (150,151,152) order by dataset_id`)).rows,
};
console.log(JSON.stringify(checks, null, 2));
await pool.end();
