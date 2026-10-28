import os,json,time,datetime as dt,shutil,psycopg2
from pathlib import Path
for line in Path('.env').read_text(encoding='utf-8').splitlines():
    line=line.strip()
    if line and not line.startswith('#') and '=' in line:
        k,v=line.split('=',1); os.environ.setdefault(k,v)
DB=dict(host=os.environ['DB_HOST'],port=os.environ['DB_PORT'],dbname=os.environ['DB_NAME'],user=os.environ['DB_USER'],password=os.environ['DB_PASSWORD'])
OUT=Path('docs/executivo-collector-plan/educacao-p1121-p113-evidence.json'); OUT.parent.mkdir(parents=True,exist_ok=True)
def pct(a,p):
    a=sorted(a); return round(a[min(len(a)-1,max(0,int((len(a)-1)*p)))],3) if a else None
c=psycopg2.connect(**DB); q=c.cursor(); q.execute('SELECT current_database(),current_user,pg_database_size(current_database())'); db,user,db_bytes=q.fetchone()
out={'generatedAt':dt.datetime.now(dt.timezone.utc).isoformat(),'database':db,'user':user,'dbBytes':db_bytes,'drives':{'C_free':shutil.disk_usage('C:\\').free,'D_free':shutil.disk_usage('D:\\').free}}
q.execute("SELECT pg_walfile_name(pg_current_wal_lsn())"); out['walSegment']=q.fetchone()[0]
q.execute("SELECT version,name,applied_at FROM civica_exec.schema_migrations ORDER BY version"); out['migrations']=[dict(version=r[0],name=r[1],appliedAt=str(r[2])) for r in q.fetchall()]
q.execute("SELECT year,count(*) rows,count(DISTINCT co_ies) ies,count(DISTINCT co_curso) courses,sum(qt_mat) enrollments,sum(qt_vg_total) vacancies,count(*) FILTER (WHERE tp_dimensao IN (1,2)) territorial_rows,count(*) FILTER (WHERE tp_dimensao IN (3,4)) national_rows,sum(qt_mat) FILTER (WHERE tp_dimensao IN (1,2)) territorial_enrollments,sum(qt_mat) FILTER (WHERE tp_dimensao IN (3,4)) national_enrollments,count(*) FILTER (WHERE entity_id IS NULL AND co_municipio<>0) unresolved_geo FROM civica_exec.exec_edu_higher_offer_year GROUP BY year ORDER BY year")
out['p1121_dimensions']=[dict(year=r[0],rows=r[1],ies=r[2],courses=r[3],enrollments=r[4],vacancies=r[5],territorialRows=r[6],nationalRows=r[7],territorialEnrollments=r[8],nationalEnrollments=r[9],unresolvedGeo=r[10]) for r in q.fetchall()]
q.execute("SELECT year,count(*) base_groups,count(*) FILTER (WHERE n>1) overlapping_groups,sum(n-1) excess_rows FROM (SELECT year,co_ies,co_curso,co_municipio,tp_modalidade,count(*) n FROM civica_exec.exec_edu_higher_offer_year GROUP BY year,co_ies,co_curso,co_municipio,tp_modalidade) x GROUP BY year ORDER BY year")
out['p1121_overlap']=[dict(year=r[0],baseGroups=r[1],overlappingGroups=r[2],excessRows=r[3]) for r in q.fetchall()]
out['territorialTests']=[]
for name in ['Vitória','Serra','Vila Velha','Campos dos Goytacazes','Rio de Janeiro','João Pessoa','Campina Grande','São Paulo','Belo Horizonte','Recife']:
    q.execute("SELECT e.ibge7,e.name,e.uf,coalesce(t.offer_count,0),coalesce(t.ies_count,0),coalesce(t.course_count,0) FROM civica_exec.exec_entity e LEFT JOIN civica_exec.exec_edu_higher_territory_year t ON t.scope=4 AND t.scope_key=e.ibge7::text AND t.year=2024 WHERE e.kind=4 AND lower(e.name)=lower(%s) ORDER BY e.ibge7 LIMIT 5",(name,))
    out['territorialTests'].append({'name':name,'matches':[dict(ibge7=r[0],canonicalName=r[1],uf=r[2],offers=r[3],ies=r[4],courses=r[5]) for r in q.fetchall()]})
q.execute("SELECT indicator,reference_year,source_rows,valid_rows,linked_ies,linked_courses,unresolved_rows,ambiguous_rows,municipalities_count,ufs_count FROM civica_exec.exec_edu_quality_coverage ORDER BY indicator,reference_year")
out['qualityCoverage']=[dict(indicator=r[0],year=r[1],sourceRows=r[2],validRows=r[3],linkedIes=r[4],linkedCourses=r[5],unresolved=r[6],ambiguous=r[7],municipalities=r[8],ufs=r[9]) for r in q.fetchall()]
q.execute("SELECT indicator,min(reference_year),max(reference_year),count(*) FROM civica_exec.exec_edu_quality_source_run WHERE status='published' GROUP BY indicator ORDER BY indicator"); out['qualitySeries']=[dict(indicator=r[0],firstYear=r[1],lastYear=r[2],editions=r[3]) for r in q.fetchall()]
queries={'overview':"SELECT * FROM civica_exec.exec_edu_higher_territory_year WHERE scope=4 AND scope_key='3205309' AND year=2024",'series':"SELECT * FROM civica_exec.exec_edu_higher_territory_year WHERE scope=4 AND scope_key='3205309' ORDER BY year",'ies_search':"SELECT co_ies,name,uf FROM civica_exec.exec_edu_higher_ies_year WHERE year=2024 AND name ILIKE '%universidade%' ORDER BY name LIMIT 25",'course_search':"SELECT co_ies,co_curso,nome_curso FROM civica_exec.exec_edu_higher_offer_year WHERE year=2024 AND entity_id=3205309 ORDER BY nome_curso LIMIT 25",'quality_ies':"SELECT * FROM civica_exec.exec_edu_quality_ies WHERE co_ies=1 ORDER BY reference_year",'quality_course':"SELECT * FROM civica_exec.exec_edu_quality_course WHERE co_curso=1 ORDER BY reference_year",'quality_territory':"SELECT * FROM civica_exec.exec_edu_quality_territory_year WHERE scope=4 AND scope_key='3205309' ORDER BY reference_year"}
out['benchmark']={}
for label,sql in queries.items():
    vals=[]
    for _ in range(100):
        t=time.perf_counter(); q.execute(sql); q.fetchall(); vals.append((time.perf_counter()-t)*1000)
    out['benchmark'][label]={'reps':100,'p50':pct(vals,.50),'p90':pct(vals,.90),'p95':pct(vals,.95),'p99':pct(vals,.99),'max':round(max(vals),3)}
q.close(); c.close(); OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2,default=str)+'\n',encoding='utf-8'); print(json.dumps(out,ensure_ascii=False,indent=2,default=str))
