import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
print(c.execute('pragma table_info(proposal_authors)').fetchall())
