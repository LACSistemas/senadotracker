import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for q in ["select json_extract(payload,'$.party') party,count(*) n from proposal_authors where json_extract(payload,'$.party') is not null group by party order by n desc limit 20", "select party,count(*) n from proposal_authors where party is not null group by party order by n desc limit 20", "select party,count(*) n from profiles group by party order by n desc limit 20"]:
 try: print(q,c.execute(q).fetchall())
 except Exception as e: print(e)
