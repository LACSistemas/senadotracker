import json, collections, unicodedata, re
Y=list(range(2015,2027)); combos=collections.defaultdict(lambda: dict(vit=0,tot=0,peso=0,mun=set(),years=set(),nzcols=set()))
for y in Y:
    j=json.load(open(f'vde{y}.json',encoding='utf-8'))
    for uf,mun,ev,ym,ab,vit,tot,peso,dup in j['rows']:
        c=combos[(ev,ab)]; c['years'].add(y)
        if vit: c['nzcols'].add('vit')
        if tot: c['nzcols'].add('tot')
        if peso: c['nzcols'].add('peso')
        c['mun'].add(mun if mun=='NÃO INFORMADO' else 'M')
    for c in j['cov']:
        combos[(c['evento'],c['abr'])]['years'].add(y)
        combos[(c['evento'],c['abr'])].setdefault('mm',0); combos[(c['evento'],c['abr'])]['mm']=max(combos[(c['evento'],c['abr'])]['mm'],c['mun'])
for k,c in sorted(combos.items()): print(k[0][:50].ljust(52),k[1][:12].ljust(13),sorted(c['nzcols']),'mm',c['mm'],'M' if 'M' in c['mun'] else '-', len(c['years']))
