t=open('artifacts/p20_7a_dx.js',encoding='utf8',errors='ignore').read();
for pat in ['SerializeCallbackArgs: function','SerializeCallbackArgs:function']:
 i=t.find(pat);print(i);print(t[i:i+2500] if i>=0 else '')
