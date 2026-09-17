import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runCli } from './cli.ts';

const args = process.argv.slice(2);
const isCollect = args.length === 3 && args[0] === 'collect' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!);
const isStatus = args.length === 1 && args[0] === 'status';
const isExpense = args.length === 5 && args[0] === 'collect-expenses' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!) && args[3] === '--year' && /^20\d{2}$/.test(args[4]!);
const isVotes = args.length === 5 && args[0] === 'collect-votes' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!) && args[3] === '--year' && /^20\d{2}$/.test(args[4]!);
const isActivity = args.length === 3 && args[0] === 'collect-activity' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!);
const isPresence = args.length === 5 && args[0] === 'collect-presence' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!) && args[3] === '--year' && /^20\d{2}$/.test(args[4]!);
const isComplement = args.length === 3 && args[0] === 'collect-complement' && args[1] === '--source' && ['senado','camara','all'].includes(args[2]!);
const option=(name:string)=>{const index=args.indexOf(name);return index>=0?args[index+1]:undefined};
const isCabinet = args[0] === 'import-cabinet' && option('--source')==='senado' && /^20\d{2}-(0[1-9]|1[0-2])$/.test(option('--competence')??'') && Boolean(option('--file'));
const isElection=args[0]==='import-elections'&&/^20(18|22)$/.test(option('--year')??'')&&Boolean(option('--candidates'))&&Boolean(option('--assets'));
const isCamaraStaff=args[0]==='collect-camara-staff';
const isCamaraBudget=args[0]==='collect-camara-budget'&&/^20\d{2}$/.test(option('--year')??'');
const isSenateStaff=args[0]==='collect-senate-staff'&&/^20\d{2}$/.test(option('--year')??'');
const isThemes=args[0]==='collect-themes'&&/^20\d{2}$/.test(option('--year')??'');
const isCamaraPropositions=args[0]==='collect-camara-propositions'&&Boolean(option('--ids'));
const isSenateProcesses=args[0]==='collect-senate-processes'&&/^20\d{2}$/.test(option('--year')??'');
const isSenateAgenda=args[0]==='collect-senate-agenda'&&/^20\d{2}$/.test(option('--year')??'');
const isCamaraAgenda=args[0]==='collect-camara-agenda'&&/^20\d{2}$/.test(option('--year')??'');
const isPropositionEnrichment=args[0]==='collect-proposition-enrichment'&&['senado','camara','all'].includes(option('--source')??'')&&/^20\d{2}$/.test(option('--year')??'');
// npm/PowerShell combinations may consume named options while forwarding a root
// workspace script. Accept the documented named form and an equivalent positional
// fallback so `collect-house-operations all 2026` remains deterministic.
const houseOperationsSource=option('--source')??(args[0]==='collect-house-operations'?args[1]:undefined);
const houseOperationsYear=option('--year')??(args[0]==='collect-house-operations'?args[2]:undefined);
const isHouseOperations=args[0]==='collect-house-operations'&&['senado','camara','all'].includes(houseOperationsSource??'')&&/^20\d{2}$/.test(houseOperationsYear??'');
if (!isCollect && !isStatus && !isExpense && !isVotes && !isActivity && !isPresence && !isComplement && !isCabinet && !isElection && !isCamaraStaff && !isCamaraBudget && !isSenateStaff && !isThemes && !isCamaraPropositions && !isSenateProcesses && !isSenateAgenda && !isCamaraAgenda && !isPropositionEnrichment && !isHouseOperations) {
  const result = runCli(args);
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  process.exitCode = result.exitCode;
} else {
  // Delay SQLite import so help/errors are side-effect free.
  const { openDatabase, listPublished } = await import('@senadotracker/db');
  const projectDirectory=resolve(fileURLToPath(new URL('../../../',import.meta.url)));
  const directory = resolve(process.env.SENADOTRACKER_DATA_DIR ?? resolve(projectDirectory,'data'));
  let db: ReturnType<typeof openDatabase> | undefined;
  try {
    db = openDatabase(resolve(directory, 'senadotracker.sqlite'), isStatus || ((isElection||isCamaraStaff||isCamaraBudget||isCabinet||isSenateStaff||isThemes||isSenateProcesses||isSenateAgenda||isCamaraAgenda)&&args.includes('--dry-run')));
    if (isStatus) {
      console.log(JSON.stringify({ publishedCount: listPublished(db, { pageSize: 1 }).total, runs: db.prepare('SELECT id,source,status,started_at,finished_at,expected_count,error FROM ingestion_runs ORDER BY started_at DESC LIMIT 10').all() }, null, 2));
    } else if (isCollect) {
      const { collectSource } = await import('./collect.ts');
      const selected = args[2] === 'all' ? ['senado','camara'] as const : [args[2] as 'senado' | 'camara'];
      for (const source of selected) await collectSource({ db, source, rawDirectory: resolve(directory, 'raw'), progress: console.log });
    } else if(isExpense) {
      const { collectExpenses } = await import('./expenses.ts');
      const selected = args[2] === 'all' ? ['senado','camara'] as const : [args[2] as 'senado'|'camara'];
      for (const source of selected) await collectExpenses(db, source, Number(args[4]), resolve(directory, 'raw'), console.log);
    } else if(isVotes) {const {collectVotes}=await import('./votes.ts');const selected=args[2]==='all'?['senado','camara'] as const:[args[2] as 'senado'|'camara'];for(const source of selected)await collectVotes(db,source,Number(args[4]),resolve(directory,'raw'),console.log);
    } else if(isActivity) {const {collectActivity}=await import('./activity.ts');const selected=args[2]==='all'?['senado','camara'] as const:[args[2] as 'senado'|'camara'];for(const source of selected)await collectActivity(db,source,directory,console.log);
    } else if(isPresence) {const {collectPresence}=await import('./presence.ts');const selected=args[2]==='all'?['senado','camara'] as const:[args[2] as 'senado'|'camara'];for(const source of selected)await collectPresence(db,source,Number(args[4]),directory,console.log);
    } else if(isCabinet){const {importSenateCabinetPayroll}=await import('./cabinet.ts');const report=option('--report');const result=await importSenateCabinetPayroll(db,resolve(projectDirectory,option('--file')!),option('--competence')!,resolve(directory,'raw'),{dryRun:args.includes('--dry-run'),...(report?{reportFile:resolve(projectDirectory,report)}:{})});console.log(JSON.stringify(result,null,2));
    } else if(isElection){const {importTseLocal}=await import('./elections.ts');const complementFile=option('--complement'),reportFile=option('--report');const result=await importTseLocal(db,{year:Number(option('--year')),candidatesFile:option('--candidates')!,assetsFile:option('--assets')!,rawDirectory:resolve(directory,'raw'),dryRun:args.includes('--dry-run'),...(complementFile?{complementFile}:{}),...(reportFile?{reportFile:resolve(projectDirectory,reportFile)}:{}),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isCamaraStaff){const {collectCamaraStaff}=await import('./camara-cabinet.ts');const file=option('--file'),report=option('--report');const result=await collectCamaraStaff(db,{rawDirectory:resolve(directory,'raw'),dryRun:args.includes('--dry-run'),...(file?{file:resolve(projectDirectory,file)}:{}),...(report?{reportFile:resolve(projectDirectory,report)}:{})});console.log(JSON.stringify(result,null,2));
    } else if(isCamaraBudget){const {collectCamaraBudgets}=await import('./camara-cabinet.ts');const report=option('--report'),ids=option('--ids')?.split(',').map(x=>x.trim()).filter(Boolean);const result=await collectCamaraBudgets(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','camara-budget'),dryRun:args.includes('--dry-run'),...(report?{reportFile:resolve(projectDirectory,report)}:{}),...(ids?.length?{ids}:{}),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isSenateStaff){const {collectSenateStaff}=await import('./senate-staff.ts');const report=option('--report'),consolidated=option('--consolidated'),ids=option('--ids')?.split(',').map(x=>x.trim()).filter(Boolean);const result=await collectSenateStaff(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','senate-staff'),dryRun:args.includes('--dry-run'),...(report?{reportFile:resolve(projectDirectory,report)}:{}),...(consolidated?{consolidatedFile:resolve(projectDirectory,consolidated)}:{}),...(ids?.length?{ids}:{}),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isThemes){const {collectCamaraThemes}=await import('./themes.ts');const file=option('--file');const result=await collectCamaraThemes(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),dryRun:args.includes('--dry-run'),...(file?{file:resolve(projectDirectory,file)}:{})});console.log(JSON.stringify(result,null,2));
    } else if(isCamaraPropositions){const {collectCamaraPropositionDetails}=await import('./camara-proposition-details.ts');const ids=option('--ids')!.split(',').map(value=>value.trim()).filter(Boolean);console.log(JSON.stringify(await collectCamaraPropositionDetails(db,{ids,rawDirectory:resolve(directory,'raw')}),null,2));
    } else if(isSenateProcesses){const {collectSenateProcesses}=await import('./senate-processes.ts');const ids=option('--ids')?.split(',').map(value=>value.trim()).filter(Boolean);const result=await collectSenateProcesses(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','senate-processes'),dryRun:args.includes('--dry-run'),...(ids?.length?{ids}:{}),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isSenateAgenda){const {collectSenateCommissionAgenda}=await import('./senate-agenda.ts');const result=await collectSenateCommissionAgenda(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','senate-agenda'),dryRun:args.includes('--dry-run'),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isCamaraAgenda){const {collectCamaraAgenda}=await import('./camara-agenda.ts');const result=await collectCamaraAgenda(db,{year:Number(option('--year')),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','camara-agenda'),dryRun:args.includes('--dry-run'),progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isPropositionEnrichment){const {collectPropositionEnrichment}=await import('./proposition-enrichment.ts');const limit=Number(option('--limit')??25);const result=await collectPropositionEnrichment(db,{source:option('--source') as 'senado'|'camara'|'all',year:Number(option('--year')),limit,directory,progress:message=>console.error(message)});console.log(JSON.stringify(result,null,2));
    } else if(isHouseOperations){const {collectHouseOperations}=await import('./house-operations.ts');const selected=houseOperationsSource==='all'?['senado','camara'] as const:[houseOperationsSource as 'senado'|'camara'];if(selected.includes('senado')&&!args.includes('--dry-run')){const candidates=db.prepare(`SELECT DISTINCT json_extract(d.payload,'$.proposalId') id FROM deliberations d JOIN active_legislative_publications a ON a.batch_id=d.batch_id WHERE a.source='senado' AND a.year=? AND json_extract(d.payload,'$.approved')=1 AND json_extract(d.payload,'$.proposalId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM proposal_enrichment_items e JOIN active_proposal_enrichment_publications ae ON ae.batch_id=e.batch_id AND ae.source=e.source AND ae.proposal_id=e.proposal_id AND ae.kind=e.kind WHERE e.source='senado' AND e.proposal_id=json_extract(d.payload,'$.proposalId') AND e.kind='matter_detail')`).all(Number(houseOperationsYear)).map(row=>String(row.id));if(candidates.length){console.error(`Senado: enriquecendo ${candidates.length} materias aprovadas antes do agregado`);const {collectSenateProcesses}=await import('./senate-processes.ts');await collectSenateProcesses(db,{year:Number(houseOperationsYear),ids:candidates,rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache','senate-processes'),progress:message=>console.error(message)})}}if(selected.includes('camara')&&!args.includes('--dry-run')){const candidates=db.prepare(`SELECT DISTINCT p.external_id FROM proposals p JOIN active_activity_publications a ON a.batch_id=p.batch_id WHERE a.source='camara' AND json_extract(p.payload,'$.status') LIKE '%Norma Jur%' AND NOT EXISTS(SELECT 1 FROM proposal_enrichment_items r JOIN active_proposal_enrichment_publications ar ON ar.batch_id=r.batch_id AND ar.source=r.source AND ar.proposal_id=r.proposal_id AND ar.kind=r.kind WHERE r.source='camara' AND r.proposal_id=p.external_id AND r.kind='relationship' AND json_extract(r.payload,'$.relation')='principal') AND NOT EXISTS(SELECT 1 FROM proposal_enrichment_items m JOIN active_proposal_enrichment_publications am ON am.batch_id=m.batch_id AND am.source=m.source AND am.proposal_id=m.proposal_id AND am.kind=m.kind WHERE m.source='camara' AND m.proposal_id=p.external_id AND m.kind='movement' AND (json_extract(m.payload,'$.description') LIKE '%Norma Jur%' OR m.label LIKE '%Norma Jur%'))`).all().map(row=>String(row.external_id));if(candidates.length){console.error(`Câmara: enriquecendo ${candidates.length} proposições terminais antes do agregado`);const {collectCamaraPropositionDetails}=await import('./camara-proposition-details.ts');await collectCamaraPropositionDetails(db,{ids:candidates,rawDirectory:resolve(directory,'raw')})}}for(const source of selected)console.log(JSON.stringify(await collectHouseOperations(db,{source,year:Number(houseOperationsYear),rawDirectory:resolve(directory,'raw'),cacheDirectory:resolve(directory,'cache'),dryRun:args.includes('--dry-run'),progress:message=>console.error(message)}),null,2));
    } else {const {collectComplement}=await import('./complement.ts');const selected=args[2]==='all'?['senado','camara'] as const:[args[2] as 'senado'|'camara'];for(const source of selected)await collectComplement(db,source,directory,console.log);
    }
  } catch (error) { console.error(error instanceof Error ? error.message : 'Falha na execução'); process.exitCode = 1; }
  finally { db?.close(); }
}
