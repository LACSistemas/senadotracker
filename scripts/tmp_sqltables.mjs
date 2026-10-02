import { DatabaseSync } from 'node:sqlite'; const db=new DatabaseSync('data/senadotracker.sqlite'); console.log(db.prepare("select name from sqlite_master where type='table' order by name").all());
