t=open('artifacts/p20_7a_dx.js',encoding='utf8',errors='ignore').read();
for pat in ['GVPagerOnClick','GOTOPAGE','PAGERONCLICK']:
 i=t.find(pat); print(pat,i,t[i-500:i+1200] if i>=0 else '')
