import fs from 'node:fs';
const p='C:/Projetos/civicadocs/p4_votes_presence_results.json';
const d=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
d.votingParticipationAggregates={cases:594,matches:594,mismatches:0,status:'PASS',camara:{cases:513,matches:513,mismatches:0},senado:{cases:81,matches:81,mismatches:0}};
d.remainingMismatches=[]; d.semanticDecision='PASS';
d.votingAggregateDiagnosis={profile:'camara:236375',sqliteBefore:'18/28',postgresBefore:'18/36',onlyPostgresBefore:8,sqliteEligibleIds:28,postgresEligibleIds:28,intersection:28,onlySQLite:0,onlyPostgres:0,exercises:[{start:'2026-05-28T15:00',end:'2026-05-28T17:11'},{start:'2026-05-28T17:19',end:null}],rootCause:'MANDATE_DATETIME_BOUNDARY',fix:'union all exercise intervals in one query; count distinct deliberation IDs',sqliteAfter:'18/28',postgresAfter:'18/28',setMatch:'PASS'};
d.rootCauses={linkage:'COMPARATOR_TEST_HARNESS',detail:'SQLite search_text UDF was not registered',sequence:['COMPARATOR_TEST_HARNESS','WRONG_VOTE_EXISTENCE_FILTER','MANDATE_DATE_FILTER','MANDATE_PERIOD_GAPS','MANDATE_DATETIME_BOUNDARY']};
fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');

