p='scripts/p20_7a_se_persist.mjs';s=open(p,encoding='utf8').read();s=s.replace("split(/\\\\r?\\\\n/)","split(/\\r?\\n/)");open(p,'w',encoding='utf8').write(s)
