import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
print('sqlite profiles parties',c.execute('select party,count(*) from profiles group by party order by party').fetchall())
