import { openDatabase } from '@senadotracker/db';

const path=process.argv[2]??'data/senadotracker.sqlite';
const before=openDatabase(path,true);
const profilesBefore=Number(before.prepare('SELECT count(*) n FROM profiles').get()!.n);
const expensesBefore=Number(before.prepare('SELECT count(*) n FROM expenses').get()!.n);
before.close();

const db=openDatabase(path);
try{
  const versions=db.prepare('SELECT count(*) n,max(version) latest FROM schema_migrations').get()!;
  const tables=db.prepare(`SELECT count(*) n FROM sqlite_master WHERE type='table' AND name IN ('staff_snapshot_batches','functional_staff_assignments','cabinet_budget_batches','cabinet_monthly_budgets')`).get()!;
  const profilesAfter=Number(db.prepare('SELECT count(*) n FROM profiles').get()!.n);
  const expensesAfter=Number(db.prepare('SELECT count(*) n FROM expenses').get()!.n);
  if(profilesBefore!==profilesAfter||expensesBefore!==expensesAfter||Number(versions.latest)!==10||Number(tables.n)!==4)throw new Error('Migração da Fase 3 não reconciliou');
  console.log(JSON.stringify({migrations:Number(versions.n),latest:Number(versions.latest),phase3Tables:Number(tables.n),profilesBefore,profilesAfter,expensesBefore,expensesAfter}));
}finally{db.close()}
