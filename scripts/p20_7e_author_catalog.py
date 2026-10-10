import re,json
from bs4 import BeautifulSoup
from pathlib import Path
for h,fn,out in [('BA','artifacts/P20_7D_BA_consulta-autor.aspx','artifacts/P20_7D_BA_author_partitions.json'),('ES','artifacts/P20_7D_ES_consulta-autor.aspx','artifacts/P20_7D_ES_author_partitions.json')]:
 s=BeautifulSoup(Path(fn).read_text(encoding='utf-8',errors='ignore'),'html.parser');ids=sorted({m.group(1) for a in s.find_all('a',href=True) if (m:=re.search(r'consulta-producao\.aspx\?autor=([^&]+)&ano=2026',a['href']))});json.dump({'partitions':[{'author_id':i,'status':200} for i in ids]},open(out,'w'),ensure_ascii=False,indent=2);print(h,len(ids))
