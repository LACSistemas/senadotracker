import requests,concurrent.futures,json,hashlib,time,sys
base='https://sapl.al.pb.leg.br/api/materia/materialegislativa/'
first=requests.get(base,params={'ano':2026,'limit':100,'page':1},timeout=30).json(); total=int(first['pagination']['total_pages']); print('TOTALPAGES',total)
def one(p):
 try:
  r=requests.get(base,params={'ano':2026,'limit':100,'page':p},timeout=30,headers={'User-Agent':'Civica-P20.5-safe/1.0'}); j=r.json(); return {'page':p,'status':r.status_code,'rows':len(j.get('results',[])),'json':j}
 except Exception as e:return {'page':p,'status':0,'error':str(e),'rows':0}
with concurrent.futures.ThreadPoolExecutor(16) as ex:
 out=[]
 for i,x in enumerate(ex.map(one,range(1,total+1)),1):
  out.append(x)
  if i%50==0: print('DONE',i,flush=True)
json.dump({'house':'PB','totalPages':total,'pages':[{'page':x['page'],'status':x['status'],'rows':x['rows'],'error':x.get('error')} for x in out]},open('artifacts/p20_5_PB_pages.json','w'),indent=2)
print('SUCCESS',sum(x['status']==200 for x in out),'ROWS',sum(x['rows'] for x in out))
