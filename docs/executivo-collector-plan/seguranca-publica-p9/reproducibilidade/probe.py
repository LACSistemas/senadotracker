import subprocess, json, re, sys, hashlib, html, concurrent.futures as cf, os, time
UA="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36"
def probe(item):
    tag,url=item; fn='probe/'+hashlib.md5(url.encode()).hexdigest()[:10]+'.bin'
    t0=time.time()
    r=subprocess.run(['curl','-sL','-m','35','--max-filesize','6000000','-k','-A',UA,'-o',fn,'-w','%{http_code}|%{content_type}|%{size_download}|%{url_effective}|%{time_total}',url],capture_output=True,text=True)
    parts=(r.stdout or '').split('|'); st=parts[0] if parts else '000'
    out={'tag':tag,'url':url,'status':st,'content_type':parts[1] if len(parts)>1 else '','bytes':int(parts[2]) if len(parts)>2 and parts[2].isdigit() else 0,'final_url':parts[3] if len(parts)>3 else '','secs':round(time.time()-t0,1)}
    if os.path.exists(fn) and out['bytes']>0 and ('html' in out['content_type'] or 'xml' in out['content_type'] or 'json' in out['content_type']):
        s=open(fn,'rb').read().decode('utf-8','ignore')
        m=re.search(r'<title[^>]*>(.*?)</title>',s,re.S|re.I); out['title']=html.unescape(re.sub(r'\s+',' ',m.group(1))).strip()[:120] if m else ''
        links=re.findall(r'href=["\']([^"\']+\.(?:xlsx|xls|csv|zip|ods|json|xml)(?:\?[^"\']*)?)["\']',s,re.I)
        out['data_links']=list(dict.fromkeys(links))[:8]; out['n_data_links']=len(set(links)); out['pdf_links']=len(set(re.findall(r'href=["\']([^"\']+\.pdf)',s,re.I)))
        low=s.lower(); out['kw']=[k for k in ('dados abertos','estatística','estatisticas','ocorrência','indicadores','município','painel','power bi','powerbi','tableau','captcha','cloudflare') if k in low]
    return out
items=[tuple(l.strip().split('\t',1)) for l in open(sys.argv[1],encoding='utf-8') if l.strip() and not l.startswith('#')]
res=[]
with cf.ThreadPoolExecutor(5) as ex:
    for o in ex.map(probe,items):
        res.append(o); print(o['tag'],o['status'],o['bytes'],o.get('title','')[:50],o.get('n_data_links',''),flush=True)
json.dump(res,open(sys.argv[2],'w',encoding='utf-8'),ensure_ascii=False,indent=1)
