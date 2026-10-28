"""P11.4 — ProUni/FIES oficiais, agregados e sem microdados pessoais.

Arquivos locais são lidos de D:\Civica\raw\mec. O download é opcional
(`--download`) e nunca grava conteúdo de erro/HTML como RAW. Um 403/Cloudflare
é registrado como `blocked` e não produz fatos fictícios.
"""
import csv, datetime as dt, hashlib, json, os, re, sys, unicodedata
from collections import Counter, defaultdict
from pathlib import Path
from urllib.request import Request, urlopen
import psycopg2
from psycopg2.extras import execute_values

for line in Path('.env').read_text(encoding='utf-8').splitlines() if Path('.env').exists() else []:
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); os.environ.setdefault(k,v)
DB=dict(host=os.getenv('DB_HOST','localhost'),port=os.getenv('DB_PORT','5432'),dbname=os.getenv('DB_NAME','projetoeleitor_db'),user=os.getenv('DB_USER','projetoeleitor_user'),password=os.getenv('DB_PASSWORD',''))
ROOT=Path(os.getenv('CIVICA_EXEC_ROOT',r'D:\Civica'))/'raw'/'mec'
PARSER='p114-2026-10-27-v1'
PROUNI_URLS={y:f'https://dadosabertos.mec.gov.br/images/conteudo/prouni/{y}/prouni_pda_{y}.csv' for y in range(2017,2027)}
FIES_URLS={
  ('FIES',2022,1,'OFERTA'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2022/relatorio_dados_abertos_oferta_12022_15072022.csv',
  ('FIES',2021,1,'INSCRICOES'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2021/relatorio_inscricao_dados_abertos_fies_12021.csv',
  ('FIES',2021,2,'INSCRICOES'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2021/relatorio_inscricao_dados_abertos_fies_22021.csv',
  ('FIES',2021,1,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2021/relatorio_resultado_fies_12021.csv',
  ('FIES',2021,2,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2021/relatorio_resultado_fies_22021.csv',
  ('FIES',2020,2,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2020/relatorio_resultado_fies_22020.csv',
  ('FIES',2019,1,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2019/relatorio_resultado_fies_12019.csv',
  ('FIES',2019,2,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2019/relatorio_resultado_fies_22019.csv',
  ('FIES',2018,1,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2018/relatorio_resultado_fies_12018.csv',
  ('FIES',2018,2,'RESULTADO'):'https://dadosabertos.mec.gov.br/images/conteudo/fies/2018/relatorio_resultado_fies_22018.csv',
}

def norm(v):
    s=unicodedata.normalize('NFKD',str(v or '')).encode('ascii','ignore').decode('ascii').upper().strip()
    return re.sub(r'[^A-Z0-9]+','_',s).strip('_')
def pick(row,*names):
    for n in names:
        if n in row and row[n] not in ('',None): return str(row[n]).strip()
    return ''
def digits(v):
    s=re.sub(r'\D','',str(v or '')); return int(s) if s else None
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def fetch(url,path):
    req=Request(url,headers={'User-Agent':'Civica/1.0 (dados-abertos; contato=projeto)'} )
    try:
        with urlopen(req,timeout=60) as r:
            ctype=(r.headers.get('Content-Type') or '').lower()
            data=r.read()
        if b'<html' in data[:512].lower() or 'text/html' in ctype:
            return False,'html_challenge'
        path.parent.mkdir(parents=True,exist_ok=True)
        path.write_bytes(data); return True,None
    except Exception as e:
        return False,type(e).__name__+': '+str(e)[:180]
def read_csv(path):
    raw=path.read_bytes()[:200000]
    enc='utf-8-sig'
    try: raw.decode(enc)
    except UnicodeDecodeError: enc='latin-1'
    text=path.open('r',encoding=enc,errors='replace',newline='')
    sample=text.read(10000); text.seek(0)
    delim=';' if sample.count(';')>=sample.count(',') else ','
    reader=csv.DictReader(text,delimiter=delim)
    for row in reader: yield {norm(k):v for k,v in row.items()}
def upsert_run(cur,program,year,semester,stage,url,file,sha256,bytes_,status,error=None):
    cur.execute("""INSERT INTO civica_exec.exec_access_source_run(program,edition_year,semester,stage,source_url,source_file,source_sha256,source_bytes,parser_version,status,finished_at,error)
      VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,now(),%s)
      ON CONFLICT(program,edition_year,semester,stage,source_sha256,parser_version) DO UPDATE SET status=EXCLUDED.status,finished_at=now(),error=EXCLUDED.error
      RETURNING source_run_id""",(program,year,semester or 0,stage or '',url,file,sha256,bytes_,PARSER,status,error))
    return cur.fetchone()[0]
def collect_prouni(cur,year,path,url,ies_codes):
    rows=0; eligible=0; facts=defaultdict(int); cross=set(); ies_link=set(); unresolved=set()
    for row in read_csv(path):
        rows+=1; y=digits(pick(row,'ANO_CONCESSAO_BOLSA','ANO')) or year; ies=pick(row,'CODIGO_EMEC_IES_BOLSA','CODIGO_EMEC_IES','CO_IES'); course=pick(row,'NOME_CURSO_BOLSA','NOME_CURSO','CURSO'); typ=pick(row,'TIPO_BOLSA','TIPO_DE_BOLSA') or 'UNKNOWN'
        if not ies or not typ: continue
        eligible+=1; ies_code=digits(ies); ies_key=str(ies_code or ies); course_key=course
        offer_mun=pick(row,'MUNICIPIO','MUNICIPIO_OFERTA'); ben_mun=pick(row,'MUNICIPIO_BENEFICIARIO'); ben_uf=pick(row,'UF_BENEFICIARIO'); modality=pick(row,'MODALIDADE_ENSINO_BOLSA','MODALIDADE'); shift=pick(row,'NOME_TURNO_CURSO_BOLSA','TURNO')
        k=(y,ies_code,ies_key,course_key,offer_mun,'',ben_mun,ben_uf,modality,shift,typ); facts[k]+=1; cross.add((ies_key,course_key,ies_code));
        (ies_link if ies_code in ies_codes else unresolved).add(ies_key)
    run=upsert_run(cur,'PROUNI',year,0,'BOLSAS_CONCEDIDAS',url,path.name,sha(path),path.stat().st_size,'published')
    vals=[(run,y,ies,ies_key,course,mun,uf,bmun,buf,mod,shift,typ,n) for (y,ies,ies_key,course,mun,uf,bmun,buf,mod,shift,typ),n in facts.items()]
    execute_values(cur,"INSERT INTO civica_exec.exec_prouni_fact(source_run_id,grant_year,co_ies,source_ies_key,source_course_key,offer_municipality_name,offer_uf,beneficiary_municipality_name,beneficiary_uf,modality,shift,scholarship_type,granted_count) VALUES %s ON CONFLICT DO NOTHING",vals,page_size=1000)
    cw=[(run,'PROUNI',i,c,ies, None, 'OFFICIAL_LINK' if ies in ies_codes else 'UNRESOLVED', 'CO_EMEC_IES exact; course code not published in this source') for i,c,ies in cross]
    execute_values(cur,"INSERT INTO civica_exec.exec_access_crosswalk(source_run_id,program,source_ies_key,source_course_key,co_ies,co_curso,status,evidence) VALUES %s ON CONFLICT DO NOTHING",cw,page_size=1000)
    cur.execute("UPDATE civica_exec.exec_access_source_run SET rows_source=%s,rows_eligible=%s,rows_aggregated=%s,rows_linked_ies=%s,rows_unresolved=%s,data_through=%s WHERE source_run_id=%s",(rows,eligible,len(vals),len(ies_link),len(unresolved),f'{year}-12-31',run))
    cur.execute("INSERT INTO civica_exec.exec_access_coverage(source_run_id,program,edition_year,source_rows,eligible_rows,aggregated_rows,linked_ies,linked_courses,unresolved_rows,note) VALUES(%s,'PROUNI',%s,%s,%s,%s,%s,0,%s,%s) ON CONFLICT(source_run_id) DO UPDATE SET source_rows=EXCLUDED.source_rows,eligible_rows=EXCLUDED.eligible_rows,aggregated_rows=EXCLUDED.aggregated_rows,linked_ies=EXCLUDED.linked_ies,unresolved_rows=EXCLUDED.unresolved_rows,note=EXCLUDED.note",(run,year,rows,eligible,len(vals),len(ies_link),len(unresolved),'course code is not published; no name-based linkage'))
    return {'program':'PROUNI','year':year,'status':'published','source_rows':rows,'eligible_rows':eligible,'aggregated_rows':len(vals),'linked_ies':len(ies_link),'unresolved_ies':len(unresolved),'source_run_id':run}
def collect_fies(cur,year,semester,stage,path,url,ies_codes):
    rows=0; facts=defaultdict(int); linked=set(); unresolved=set()
    for row in read_csv(path):
        rows+=1; ies=pick(row,'CODIGO_E_MEC_DA_IES','CODIGO_EMEC_DA_IES','CODIGO_E_MEC_IES','CODIGO_EMEC_IES','CO_IES'); ies_code=digits(ies); ies_key=str(ies_code or ies); course=pick(row,'CODIGO_E_MEC_DO_CURSO','CODIGO_EMEC_DO_CURSO','CODIGO_E_MEC_CURSO','CO_CURSO'); mun=pick(row,'MUNICIPIO_DO_LOCAL_DE_OFERTA','MUNICIPIO_LOCAL_OFERTA','MUNICIPIO'); uf=pick(row,'UF_DO_LOCAL_DE_OFERTA','UF_LOCAL_OFERTA','UF'); modality=pick(row,'MODALIDADE','MODALIDADE_DE_ENSINO'); status=pick(row,'SITUACAO','STATUS','RESULTADO'); y=digits(pick(row,'ANO','ANO_DO_PROCESSO_SELETIVO')) or year; sem=digits(pick(row,'SEMESTRE','SEMESTRE_DO_PROCESSO_SELETIVO')) or semester
        facts[(y,sem,stage,ies_code,ies_key,course,mun,uf,modality,status)]+=1; (linked if ies_code in ies_codes else unresolved).add(ies_key)
    run=upsert_run(cur,'FIES',year,semester,stage,url,path.name,sha(path),path.stat().st_size,'published')
    vals=[(run,y,sem,st,ies,ik,course,mun,uf,mod,status,n) for (y,sem,st,ies,ik,course,mun,uf,mod,status),n in facts.items()]
    execute_values(cur,"INSERT INTO civica_exec.exec_fies_fact(source_run_id,process_year,semester,stage,co_ies,source_ies_key,source_course_key,municipality_name,uf,modality,status,record_count) VALUES %s ON CONFLICT DO NOTHING",vals,page_size=1000)
    cur.execute("UPDATE civica_exec.exec_access_source_run SET rows_source=%s,rows_eligible=%s,rows_aggregated=%s,rows_linked_ies=%s,rows_unresolved=%s,data_through=%s WHERE source_run_id=%s",(rows,rows,len(vals),len(linked),len(unresolved),f'{year}-12-31',run))
    cur.execute("INSERT INTO civica_exec.exec_access_coverage(source_run_id,program,edition_year,semester,stage,source_rows,eligible_rows,aggregated_rows,linked_ies,unresolved_rows,note) VALUES(%s,'FIES',%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(source_run_id) DO UPDATE SET source_rows=EXCLUDED.source_rows,aggregated_rows=EXCLUDED.aggregated_rows,linked_ies=EXCLUDED.linked_ies,unresolved_rows=EXCLUDED.unresolved_rows,note=EXCLUDED.note",(run,year,semester,stage,rows,rows,len(vals),len(linked),len(unresolved),'stage is source-native; no contract/desembolso inference'))
    return {'program':'FIES','year':year,'semester':semester,'stage':stage,'status':'published','source_rows':rows,'aggregated_rows':len(vals),'linked_ies':len(linked),'unresolved_ies':len(unresolved),'source_run_id':run}
def main():
    download='--download' in sys.argv; conn=psycopg2.connect(**DB); cur=conn.cursor(); cur.execute('SELECT current_database(),current_user'); db,user=cur.fetchone()
    if db!='projetoeleitor_db': raise RuntimeError('DATABASE_GUARD:'+db)
    cur.execute('SELECT co_ies FROM civica_exec.exec_edu_higher_ies'); ies_codes={int(x[0]) for x in cur.fetchall()}; results=[]
    # A tentativa deve continuar mesmo quando o volume RAW está montado somente
    # para leitura. Não criamos diretórios em uma execução bloqueada; o
    # download() cria o diretório somente quando o servidor entrega um arquivo.
    for y,url in PROUNI_URLS.items():
        p=ROOT/'prouni'/f'prouni_pda_{y}.csv'
        if download and not p.exists(): ok,err=fetch(url,p); 
        else: ok,err=p.exists(),None if p.exists() else 'missing_local_raw'
        if not ok:
            run=upsert_run(cur,'PROUNI',y,0,'BOLSAS_CONCEDIDAS',url,p.name,'BLOCKED',None,'blocked',err); results.append({'program':'PROUNI','year':y,'status':'blocked','error':err,'source_run_id':run}); continue
        results.append(collect_prouni(cur,y,p,url,ies_codes))
    for key,url in FIES_URLS.items():
        _,y,sem,stage=key; p=ROOT/'fies'/f'fies_{y}_{sem}_{stage.lower()}.csv'
        if download and not p.exists(): ok,err=fetch(url,p)
        else: ok,err=p.exists(),None if p.exists() else 'missing_local_raw'
        if not ok:
            run=upsert_run(cur,'FIES',y,sem,stage,url,p.name,'BLOCKED',None,'blocked',err); results.append({'program':'FIES','year':y,'semester':sem,'stage':stage,'status':'blocked','error':err,'source_run_id':run}); continue
        results.append(collect_fies(cur,y,sem,stage,p,url,ies_codes))
    conn.commit(); out={'database':db,'user':user,'parser':PARSER,'download_attempted':download,'results':results,'summary':{'published':sum(x['status']=='published' for x in results),'blocked':sum(x['status']=='blocked' for x in results)}}; print(json.dumps(out,ensure_ascii=False,indent=2)); conn.close()
if __name__=='__main__': main()
