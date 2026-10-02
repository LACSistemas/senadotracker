import sqlite3
c=sqlite3.connect('data/senadotracker.sqlite')
for t in ['expanded_costs','expanded_cost_batches','active_expanded_cost_publications','chamber_financial_pages','normative_values','people','profiles','exercise_periods','mandates','history_events','legislative_appointments','active_publications']:
 print('\n###',t,c.execute(f'pragma table_info({t})').fetchall())
 print(c.execute(f'select * from {t} limit 2').fetchall())
