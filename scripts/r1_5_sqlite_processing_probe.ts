import {DatabaseSync} from 'node:sqlite'; import {publishedProcessingObservations,publishedHouseOperationSummary} from '../packages/db/src/index.ts';
const db=new DatabaseSync('data/senadotracker.sqlite',{readOnly:true}); console.log(publishedHouseOperationSummary(db,'senado',2026)); console.log(publishedProcessingObservations(db,'senado',2026).slice(0,20)); db.close();
