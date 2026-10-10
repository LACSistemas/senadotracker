p='scripts/p20_7a_se_collect.py'; s=open(p,encoding='utf8').read(); s=s.replace('r"__doPostBack\\\\(\'([^\']+)\'"','r"__doPostBack\\(\'([^\']+)\'"'); open(p,'w',encoding='utf8').write(s)
