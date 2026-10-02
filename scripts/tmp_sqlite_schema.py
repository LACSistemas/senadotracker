import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for t in ['cabinet_monthly_budgets','cabinet_staff','functional_staff_assignments','staff_snapshot_batches','party_memberships','commission_agenda_items','commission_agenda_item_versions','legislative_complements','complement_batches','active_complement_publications','expenses','expense_batches','active_expense_publications']:
 print('\n###',t)
 print(c.execute(f'pragma table_info({t})').fetchall())
 print(c.execute(f'select * from {t} limit 2').fetchall())
