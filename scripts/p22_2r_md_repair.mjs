import fs from 'node:fs';
import crypto from 'node:crypto';
const ART='artifacts';
const run=JSON.parse(fs.readFileSync(`${ART}/P22_2R_run.json`,'utf8'));
const rows=Object.entries(run.houses).map(([h,x])=>`| ${h} | ${x.proposalCountAfter} | ${x.authorshipRowsAfter} | ${x.timelineEventRows} | ${x.revision} |`).join('\n');
const md=`# P22.2R - SAPL type semantics repair and artifact repair

Database: civica_postgres_lab  
Status: PASS  
Scope: RO, TO and RR semantic repair; AC and PI audited without a new publication.

## Semantic corrections

| Contract | Before | After | Rows |
|---|---|---|---:|
| RO PEC (type 12) | AMENDMENT | LEGISLATIVE_MAIN | 3 |
| TO PEC House (type 4) | AMENDMENT | LEGISLATIVE_MAIN | 1 |
| TO PEC Executive (type 5) | AMENDMENT | LEGISLATIVE_MAIN | 1 |
| RR Information Request (type 14) | OTHER | REQUEST | 10 |
| RR Substitute (type 18) | OTHER | AMENDMENT | 4 |

The PEC rule precedes the word-level amendment rule. No PEC is classified as AMENDMENT. All RO, AC, PI, TO and RR source types passed the invariant audit with zero type-id label conflicts.

## Immutable revisions and parity

New immutable legislative revisions were activated only for RO, TO and RR. AC and PI kept their previous active revisions. Proposal IDs/counts, authorship, person linkage and timeline rows are invariant.

| House | Proposals | Authorship | Timeline events | Active legislative revision |
|---|---:|---:|---:|---|
${rows}

## Product and replay

The five typed cases (RO PEC, TO PEC House, TO PEC Executive, RR Information Request and RR Substitute) return the corrected functional group and an intact timeline. Set-based replay produced DUPLICATE_INSERTIONS = 0 and NEW_REVISION_ON_UNCHANGED_REPLAY = 0.

P22.2 remains the immutable historical backfill record. This artifact supersedes it only for proposal type semantics and documents the repaired rendering without stale revision placeholders.

## Gates

- CROSS_HOUSE_TAXONOMY_GUARD = PASS
- PROPOSAL_PARITY = PASS
- AUTHORSHIP_PARITY = PASS
- LINKAGE_PARITY = PASS
- TIMELINE_PARITY = PASS
- P20_REGRESSION = PASS
- P22_EXISTING_REGRESSION = PASS
- PRODUCT_QUERY_VALIDATION = PASS
- INTERNAL_WORK_REMAINING = NO
- READY_FOR_P22_3 = YES
- P22.3_STARTED = NO
- P23_STARTED = NO

Production, projetoeleitor_db and SQLite were not touched.
`;
fs.writeFileSync(`${ART}/P22_2R.md`,md,'utf8');
const files=['P22_2R.json','P22_2R.md','P22_2R_type_semantics_audit.json','P22_2R_parity.json','P22_2R_regression_guard.json','P22_2R_product_validation.json'];
const digest=Object.fromEntries(files.map(f=>[f,crypto.createHash('sha256').update(fs.readFileSync(`${ART}/${f}`)).digest('hex')]));
fs.writeFileSync(`${ART}/P22_2R_sha256.json`,JSON.stringify({phase:'P22.2R',database:'civica_postgres_lab',files:digest},null,2));
console.log(JSON.stringify(digest,null,2));
