import sqlite3,json
c=sqlite3.connect('data/senadotracker.sqlite')
for r in c.execute("select a.source,a.scope,a.batch_id,b.reconciliation_json,b.record_count,b.published_at from active_complement_publications a join complement_batches b on b.id=a.batch_id where a.source='camara'").fetchall(): print(r)
