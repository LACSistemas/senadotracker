import { DatabaseSync } from 'node:sqlite';
const db = new DatabaseSync('data/senadotracker.sqlite', { readOnly: true });
const row = db.prepare('PRAGMA quick_check').get();
console.log(JSON.stringify(row));
db.close();
