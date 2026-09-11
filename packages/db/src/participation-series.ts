import type { DatabaseSync } from 'node:sqlite';
import type { LegislativeSession, LegislativeVote, Profile, Source } from '@senadotracker/domain';
import { reportingCutoff } from './reporting-period.ts';
import { countsAsParticipation } from './vote-participation.ts';

const within = (date: string, profile: Profile) => (profile.exercises ?? []).some(period => date >= period.start.slice(0, 10) && (!period.end || date <= period.end.slice(0, 10)));

export function publishedMonthlyParticipation(db: DatabaseSync, source: Source, externalId: string, year: number) {
  const profileRow = db.prepare(`SELECT p.payload FROM profiles p JOIN active_publications a ON a.batch_id=p.batch_id WHERE a.source=? AND p.external_id=?`).get(source, externalId);
  if (!profileRow) return [];
  const profile = JSON.parse(String(profileRow.payload)) as Profile;
  const officialPresence = source === 'camara' ? db.prepare('SELECT days_json FROM chamber_official_presence WHERE external_id=? AND year=?').get(externalId, year) : null;
  const cutoff = reportingCutoff(year);
  const presenceBatch = db.prepare(`SELECT b.* FROM presence_batches b JOIN active_presence_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source, year);
  const sessions = presenceBatch ? db.prepare(`SELECT payload FROM legislative_sessions WHERE batch_id=? AND eligible=1 AND substr(date,1,10)<=?`).all(String(presenceBatch.id), cutoff).map(row => JSON.parse(String(row.payload)) as LegislativeSession).filter(item => within(item.date, profile)) : [];
  const attended = presenceBatch ? new Set(db.prepare(`SELECT session_id FROM attendance WHERE batch_id=? AND external_id=?`).all(String(presenceBatch.id), externalId).map(row => String(row.session_id))) : new Set<string>();
  const legislativeBatch = db.prepare(`SELECT b.id FROM legislative_batches b JOIN active_legislative_publications a ON a.batch_id=b.id WHERE a.source=? AND a.year=?`).get(source, year);
  const deliberations = legislativeBatch ? db.prepare(`SELECT external_id,date FROM deliberations WHERE batch_id=? AND json_extract(payload,'$.chamberBody')='PLEN' AND substr(date,1,10)<=?`).all(String(legislativeBatch.id), cutoff).map(row => ({ externalId: String(row.external_id), date: String(row.date) })).filter(item => within(item.date, profile)) : [];
  const voteRows = legislativeBatch ? db.prepare(`SELECT external_id,deliberation_id,payload FROM legislative_votes WHERE batch_id=?`).all(String(legislativeBatch.id)) : [];
  const nominal = new Set(voteRows.filter(row => countsAsParticipation(source, (JSON.parse(String(row.payload)) as LegislativeVote).vote)).map(row => String(row.deliberation_id)));
  const voted = new Set(voteRows.filter(row => String(row.external_id) === externalId && countsAsParticipation(source, (JSON.parse(String(row.payload)) as LegislativeVote).vote)).map(row => String(row.deliberation_id)));
  return Array.from({ length: Number(cutoff.slice(5, 7)) }, (_, index) => {
    const month = index + 1;
    const monthlySessions = sessions.filter(item => Number(item.date.slice(5, 7)) === month);
    const attendanceDays = new Map<string, boolean>();
    for (const session of monthlySessions) attendanceDays.set(session.date.slice(0, 10), Boolean(attendanceDays.get(session.date.slice(0, 10))) || attended.has(session.externalId));
    const monthlyVotes = deliberations.filter(item => nominal.has(item.externalId) && Number(item.date.slice(5, 7)) === month);
    return { year, month,
      presence: (() => { const officialDays=officialPresence?JSON.parse(String(officialPresence.days_json)) as Array<{date:string;status:string}>:null;const observed=officialDays?.filter(item=>Number(item.date.slice(3,5))===month);return observed?{numerator:observed.filter(item=>item.status.toLocaleLowerCase('pt-BR').startsWith('presença')).length,denominator:observed.length}:{numerator:presenceBatch?.availability==='available'?[...attendanceDays.values()].filter(Boolean).length:null,denominator:presenceBatch?.availability==='available'?attendanceDays.size:null};})(),
      participation: { numerator: monthlyVotes.length ? monthlyVotes.filter(item => voted.has(item.externalId)).length : null, denominator: monthlyVotes.length || null },
    };
  });
}
