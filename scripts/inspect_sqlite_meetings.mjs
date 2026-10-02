import { DatabaseSync } from 'node:sqlite';
const d=new DatabaseSync('data/senadotracker.sqlite');
console.log(d.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name LIKE '%commission%'").all());
for (const t of ['commission_meetings','commission_agenda_items']) {
  console.log(t,d.prepare(`SELECT count(*) n FROM ${t}`).get(),d.prepare(`PRAGMA table_info(${t})`).all());
}
console.log('meetings',d.prepare("SELECT source,count(*) n,max(scheduled_date) max FROM commission_meetings WHERE scheduled_date >= '2026-01-01' AND scheduled_date < '2027-01-01' GROUP BY source").all());
console.log('items',d.prepare("SELECT i.source,count(*) n,count(DISTINCT meeting_id) meetings,count(DISTINCT proposal_id) matters FROM commission_agenda_items i JOIN commission_meetings m ON m.id=i.meeting_id WHERE i.active=1 AND m.scheduled_date >= '2026-01-01' AND m.scheduled_date < '2027-01-01' GROUP BY i.source").all());
