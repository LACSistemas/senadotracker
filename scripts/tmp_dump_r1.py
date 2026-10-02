import json
p='artifacts/full-web-sqlite-postgres-parity.json'
d=json.load(open(p,encoding='utf8'))
names=['homeHighlights','houseListing.camara','houseListing.senado','profile.camara','profile.senado','profile.activity','parties.all','partyLanding','partyDetail','stateRepresentation.MT','rankingsDashboard','rankings.camara']
for x in d['cases']:
    if x['name'] in names:
        print('\n###',x['name'])
        for z in x.get('fieldDiff',[]):
            print(z.get('path'),'| sqlite=',repr(z.get('sqlite')),'| pg=',repr(z.get('postgres')))
