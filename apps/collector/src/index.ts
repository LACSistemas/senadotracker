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
if (!isCollect && !isStatus && !isExpense && !isVotes && !isActivity && !isPresence && !isComplement && !isCabinet && !isElection && !isCamaraStaff && !isCamaraBudget && !isSenateStaff) {
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
    db = openDatabase(resolve(directory, 'senadotracker.sqlite'), isStatus || ((isElection||isCamaraStaff||isCamaraBudget||isCabinet||isSenateStaff)&&args.includes('--dry-run')));
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
    } else {const {collectComplement}=await import('./complement.ts');const selected=args[2]==='all'?['senado','camara'] as const:[args[2] as 'senado'|'camara'];for(const source of selected)await collectComplement(db,source,directory,console.log);
    }
  } catch (error) { console.error(error instanceof Error ? error.message : 'Falha na execução'); process.exitCode = 1; }
  finally { db?.close(); }
}
