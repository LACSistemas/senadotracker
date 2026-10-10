t=open('artifacts/p20_7a_dx.js',encoding='utf8',errors='ignore').read();
for pat in ['doPagerOnClick =','doPagerOnClick:function','doPagerOnClick']:
 poss=[];off=0
 while True:
  i=t.find(pat,off)
  if i<0:break
  poss.append(i);off=i+1
 print(pat,poss[:10])
 for i in poss[:3]: print(t[i-500:i+1000])
