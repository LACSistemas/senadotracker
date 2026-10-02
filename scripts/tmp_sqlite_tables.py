import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
rows=c.execute("select name from sqlite_master where type='table' and (name like '%staff%' or name like '%cabinet%' or name like '%expense%' or name like '%agenda%' or name like '%operation%' or name like '%party%' or name like '%profile%' or name like '%complement%') order by name").fetchall()
print('\n'.join(x[0] for x in rows))
