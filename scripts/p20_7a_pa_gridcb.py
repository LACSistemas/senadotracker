t=open('artifacts/p20_7a_dx.js',encoding='utf8',errors='ignore').read();
for pat in ['gridCallBack: function','gridCallBack:function','gridCallBack = function']:
 i=t.find(pat); print(pat,i);print(t[i:i+2000] if i>=0 else '')
