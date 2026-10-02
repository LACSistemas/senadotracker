import json
D=json.load(open('artifacts/full-web-sqlite-postgres-parity.json',encoding='utf8'))
N=['homeHighlights','houseListing.camara','houseListing.senado','profile.camara','profile.senado','profile.activity','parties.all','partyLanding','partyDetail','stateRepresentation.MT','rankingsDashboard','rankings.camara']
for x in D['cases']:
 if x['name'] in N:
  with open('scripts/dump_'+x['name'].replace('.','_')+'.txt','w',encoding='utf8') as f:
   for z in x.get('fieldDiff',[]): f.write(f"{z.get('path')}\t{z.get('sqlite')!r}\t{z.get('postgres')!r}\n")
