import json, collections
Y=list(range(2015,2027)); J={}
for y in Y: J[y]=json.load(open(f'vde{y}.json',encoding='utf-8'))
cols0=J[2025]['columns']
for y in Y:
    if J[y]['columns']!=cols0: print('COLS DIFF',y,J[y]['columns'])
allev=collections.defaultdict(dict)
for y in Y:
    for e,n in J[y]['events'].items(): allev[e][y]=n
for e,d in sorted(allev.items()): print(e[:55].ljust(57), ''.join(('X' if y in d else '.') for y in Y))
print({y:J[y]['competences'][0:1]+J[y]['competences'][-1:] for y in Y})
print({y:J[y]['abrangencias'] for y in (2015,2020,2026)})
# homicide totals
for y in Y:
    s=sum(r[5] or 0 for r in J[y]['rows'] if r[2]=='Homicídio doloso'); print(y,'homicidio',s)
