from pathlib import Path
p=Path('apps/web/lib/data-postgres-wave4.ts')
s=p.read_text(encoding='utf-8')
s=s.replace("external_id::text id,month::int,sum(spent_cents)", "external_id::text id,month::int AS month_num,sum(spent_cents)")
s=s.replace("Number(r.month)`,Number(r.value)", "Number(r.month_num)`,Number(r.value)")
p.write_text(s,encoding='utf-8')
