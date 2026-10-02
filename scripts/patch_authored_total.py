from pathlib import Path
p=Path('apps/web/lib/data-postgres-wave4.ts')
s=p.read_text(encoding='utf-8')
needle="const allAuthored=await pool().query(`SELECT count(DISTINCT a.source||':'||a.proposal_id)::int total FROM civica_poc.proposal_authors a"
i=s.index(needle)
j=s.index('`,[year]);',i)
segment=s[i:j]
if "NULLIF(a.party,'')" not in segment:
    segment=segment+" AND NULLIF(a.party,'') IS NOT NULL"
    s=s[:i]+segment+s[j:]
p.write_text(s,encoding='utf-8')
