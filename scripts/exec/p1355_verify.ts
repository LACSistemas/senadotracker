import {openPool} from './db.ts';
const p=openPool(1);
const r=await p.query(`select snapshot_id,status,source_projects,source_contracts,source_commitments,source_physical,edge_rows,verified_pncp_links,verified_payment_links,verified_asset_links from civica_exec.exec_work_integration_snapshot order by snapshot_id desc limit 3`);
const e=await p.query(`select count(*)::int edges,count(*) filter (where validation_status='VERIFIED')::int verified from civica_exec.exec_work_integration_edge`);
console.log(JSON.stringify({snapshots:r.rows,edges:e.rows[0]},null,2));
await p.end();
