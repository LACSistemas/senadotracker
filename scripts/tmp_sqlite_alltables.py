import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for x in c.execute("select name from sqlite_master where type='table' order by name").fetchall(): print(x[0])
