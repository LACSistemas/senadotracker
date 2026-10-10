p='scripts/p20_7a_pa_reparse.py';s=open(p,encoding='utf8').read();s=s.replace('\\\\d','\\d').replace('\\\\s','\\s');open(p,'w',encoding='utf8').write(s)
