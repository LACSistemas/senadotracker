import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for t in [x[0] for x in c.execute("select name from sqlite_master where type='table'").fetchall() if 'cost' in x or 'salary' in x or 'pay' in x or 'staff' in x]:
 print(t,c.execute(f'pragma table_info({t})').fetchall(),c.execute(f'select * from {t} limit 1').fetchall())
