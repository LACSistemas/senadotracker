import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for t in ['commission_meetings','commission_meeting_versions','commission_agenda_items','commission_agenda_item_versions','commission_meeting_bodies']:
 print(t,c.execute(f'select count(*) from {t}').fetchone()[0], c.execute(f'select source,count(*) from {t} group by source').fetchall() if 'source' in [x[1] for x in c.execute(f'pragma table_info({t})').fetchall()] else '')
for q in ["select count(distinct id) from commission_meetings where source='camara'", "select count(distinct external_id) from commission_meetings where source='camara'", "select count(distinct meeting_id) from commission_agenda_items where source='camara'", "select count(*) from commission_agenda_items where source='camara'", "select min(scheduled_date),max(scheduled_date) from commission_meetings where source='camara'"]:
 try: print(q,c.execute(q).fetchone())
 except Exception as e: print(e)
