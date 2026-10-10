t=open('artifacts/p20_7a_dx.js',encoding='utf8',errors='ignore').read();
for pat in ['SendRequest: function','SendRequest:function','CallbackHelper']:
 poss=[];o=0
 while 1:
  i=t.find(pat,o)
  if i<0:break
  poss.append(i);o=i+1
 print(pat,poss[:10])
 for i in poss[:2]: print(t[i:i+1200])
