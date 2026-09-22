import {openDatabase} from '@senadotracker/db';
const path=process.env.SENADOTRACKER_DB_PATH??'data/senadotracker.sqlite';
const db=openDatabase(path);
try{console.log(`Schema version: ${db.prepare('SELECT max(version) version FROM schema_migrations').get()?.version??'unknown'}`)}finally{db.close()}
