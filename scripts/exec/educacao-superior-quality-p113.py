"""P11.3 — carga idempotente das planilhas agregadas oficiais de qualidade INEP.
Somente fontes agregadas; nenhum microdado individual é lido ou persistido.
"""
import os, sys, json, hashlib, datetime as dt, re
from pathlib import Path
import openpyxl
import psycopg2
from psycopg2.extras import execute_values, Json

ROOT = Path(os.getenv('CIVICA_EXEC_ROOT', r'D:\Civica')) / 'raw' / 'inep' / 'qualidade_superior'
# The repository contract is the same one used by the previous collectors.
_env_path = Path('.env')
if _env_path.exists():
    for _line in _env_path.read_text(encoding='utf-8').splitlines():
        _line = _line.strip()
        if _line and not _line.startswith('#') and '=' in _line:
            _k, _v = _line.split('=', 1)
            os.environ.setdefault(_k, _v)
DB = dict(host=os.getenv('DB_HOST','localhost'), port=os.getenv('DB_PORT','5432'), dbname=os.getenv('DB_NAME','projetoeleitor_db'), user=os.getenv('DB_USER','projetoeleitor_user'), password=os.getenv('DB_PASSWORD',''))
PARSER = 'p113-2026-10-27-v2'
URL_ROOT = 'https://download.inep.gov.br/'

FILES = {
    ('IGC', 2018): ('portal_IGC_edicao2018.xlsx','educacao_superior/igc_cpc/2018/portal_IGC_edicao2018.xlsx'),
    ('IGC', 2021): ('IGC_2021.xlsx','educacao_superior/indicadores/resultados/2021/IGC_2021.xlsx'),
    ('IGC', 2022): ('igc_2022.xlsx','educacao_superior/indicadores/resultados/2022/igc_2022.xlsx'),
    ('IGC', 2023): ('IGC_2023.xlsx','educacao_superior/indicadores/resultados/2023/IGC_2023.xlsx'),
    ('CPC', 2018): ('portal_CPC_edicao2018.xlsx','educacao_superior/igc_cpc/2018/portal_CPC_edicao2018.xlsx'),
    ('CPC', 2021): ('CPC_2021.xlsx','educacao_superior/indicadores/resultados/2021/CPC_2021.xlsx'),
    ('CPC', 2022): ('cpc_2022.xlsx','educacao_superior/indicadores/resultados/2022/cpc_2022.xlsx'),
    ('CPC', 2023): ('CPC_2023.xlsx','educacao_superior/indicadores/resultados/2023/CPC_2023.xlsx'),
    ('IDD', 2018): ('resultados_IDD_2018.xlsx','educacao_superior/indicadores/legislacao/2019/resultados_IDD_2018.xlsx'),
    ('IDD', 2021): ('IDD_2021.xlsx','educacao_superior/indicadores/resultados/2021/IDD_2021.xlsx'),
    ('IDD', 2022): ('idd_2022.xlsx','educacao_superior/indicadores/resultados/2022/idd_2022.xlsx'),
    ('IDD', 2023): ('IDD_2023.xlsx','educacao_superior/indicadores/resultados/2023/IDD_2023.xlsx'),
    ('ENADE', 2018): ('resultados_conceito_enade_2018.xlsx','educacao_superior/indicadores/legislacao/2019/resultados_conceito_enade_2018.xlsx'),
    ('ENADE', 2021): ('conceito_enade_2021.xlsx','educacao_superior/indicadores/resultados/2021/conceito_enade_2021.xlsx'),
    ('ENADE', 2022): ('conceito_enade_2022.xlsx','educacao_superior/indicadores/resultados/2022/conceito_enade_2022.xlsx'),
    ('ENADE', 2023): ('conceito_enade_2023.xlsx','educacao_superior/indicadores/resultados/2023/conceito_enade_2023.xlsx'),
}

def clean(v):
    if v is None: return None
    if isinstance(v, (dt.datetime, dt.date)): return v.isoformat()
    return v
def integer(v):
    try: return int(str(v).strip()) if v not in (None,'','-','nan') else None
    except Exception: return None
def number(v):
    try: return float(str(v).replace(',','.')) if v not in (None,'','-','nan') else None
    except Exception: return None
def sha(path):
    h=hashlib.sha256()
    with open(path,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def row_json(row): return {f'c{i+1}': clean(v) for i,v in enumerate(row) if v not in (None,'')}

def load_rows(indicator, year, path):
    wb=openpyxl.load_workbook(path, read_only=True, data_only=True)
    if indicator=='ENADE' and year==2021: sheet='PLANILHA_ENADE'
    elif indicator=='IGC': sheet='IGC' if 'IGC' in wb.sheetnames else wb.sheetnames[0]
    elif indicator=='CPC': sheet='CPC2021' if year==2021 else ('CPC 2022' if year==2022 else ('CPC_2023' if year==2023 else 'CPC'))
    elif indicator=='IDD': sheet='IDD_2018' if year==2018 else ('PLANILHA_IDD' if year==2021 else ('IDD 2022' if year==2022 else 'IDD_2023'))
    else: sheet=wb.sheetnames[0]
    ws=wb[sheet]
    it=ws.iter_rows(values_only=True); header=next(it)
    return [tuple(row) for row in it if any(v not in (None,'') for v in row)], sheet, [str(x) for x in header]

def parse_course(indicator, year, row):
    # INEP changed column order in 2021; positions below follow the published headers.
    if year==2021:
        co_ies, co_course, area_code, area_name, degree, modality, municipality, uf = row[4],row[9],row[1],row[2],row[3],row[10],row[11],row[13]
        if indicator=='CPC': cont, band = row[37], row[38]
        elif indicator=='IDD': cont, band = row[19], row[20]
        else: cont, band = row[20], row[21]
    else:
        if indicator=='ENADE':
            if year==2018:
                co_ies, co_course, area_code, area_name = row[3], row[8], row[1], row[2]
                degree, modality, municipality, uf = None, row[9], row[10], row[12]
                cont, band = row[19], row[20]
            else:
                co_ies, co_course, area_code, area_name = row[4], row[9], row[1], row[2]
                degree, modality, municipality, uf = row[3], row[10], row[11], row[13]
                cont, band = row[20], row[21]
        else:
            co_ies, co_course, area_code, area_name = row[1] if indicator=='CPC' else row[3], row[6] if indicator=='CPC' else row[8], row[7] if indicator=='CPC' else row[1], row[8] if indicator=='CPC' else row[2]
            degree = None
            modality = row[9]
            municipality = row[10]
            uf = row[12]
            if indicator=='CPC': cont, band = row[36], row[37]
            else: cont, band = row[18], row[19]
    return {'co_ies':integer(co_ies),'co_curso':integer(co_course),'area_code':str(area_code).strip() if area_code not in (None,'') else None,'area_name':str(area_name).strip() if area_name not in (None,'') else None,'degree':str(degree).strip() if degree not in (None,'') else None,'modality':str(modality).strip() if modality not in (None,'') else None,'co_municipio':integer(municipality),'uf':str(uf).strip()[:2] if uf not in (None,'') else None,'continuous_value':number(cont),'band':integer(band),'course_name':str(area_name).strip() if area_name not in (None,'') else None}

def parse_igc(year,row):
    return {'co_ies':integer(row[1]),'name':str(row[2]).strip() if row[2] not in (None,'') else None,'uf':str(row[6]).strip()[:2] if row[6] not in (None,'') else None,'academic_organization':str(row[4]).strip() if row[4] not in (None,'') else None,'administrative_category':str(row[5]).strip() if row[5] not in (None,'') else None,'courses_with_cpc':integer(row[7]),'igc_continuous':number(row[14]),'igc_band':integer(row[15]),'source_status':str(row[16]).strip() if len(row)>16 and row[16] not in (None,'') else None}

def main():
    conn=psycopg2.connect(**DB); conn.autocommit=False; cur=conn.cursor()
    cur.execute('SELECT current_database(), current_user'); db,user=cur.fetchone()
    if db!='projetoeleitor_db': raise RuntimeError(f'DATABASE_GUARD:{db}')
    cur.execute('SELECT co_ies FROM civica_exec.exec_edu_higher_ies'); ies_codes={int(r[0]) for r in cur.fetchall()}
    cur.execute('SELECT co_curso FROM civica_exec.exec_edu_higher_course'); course_codes={int(r[0]) for r in cur.fetchall()}
    results=[]
    for (indicator,year),(filename,relative_url) in FILES.items():
        path=ROOT/filename
        if not path.exists(): results.append({'indicator':indicator,'year':year,'status':'missing','file':str(path)}); continue
        digest=sha(path); size=path.stat().st_size; url=URL_ROOT+relative_url
        cur.execute('SELECT source_run_id,status,rows_source,rows_linked,rows_unresolved FROM civica_exec.exec_edu_quality_source_run WHERE indicator=%s AND reference_year=%s AND source_sha256=%s AND parser_version=%s',(indicator,year,digest,PARSER))
        prior=cur.fetchone()
        if prior:
            results.append({'indicator':indicator,'year':year,'status':'no_change','source_run_id':prior[0],'rows_source':prior[2],'rows_linked':prior[3],'rows_unresolved':prior[4]}); continue
        rows,sheet,headers=load_rows(indicator,year,path)
        cur.execute("INSERT INTO civica_exec.exec_edu_quality_source_run(indicator,reference_year,source_url,source_file,source_sha256,source_bytes,parser_version,methodology_version,status,started_at) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,'published',now()) RETURNING source_run_id",(indicator,year,url,filename,digest,size,PARSER,'INEP-planilha-divulgacao'))
        run_id=cur.fetchone()[0]; valid=0; linked=0; unresolved=0; ambiguous=0; bands={}; municipalities=set(); ufs=set(); source_rows=len(rows)
        if indicator=='IGC':
            vals=[]
            for row in rows:
                d=parse_igc(year,row)
                if not d['co_ies']: continue
                valid+=1; linked += int(d['co_ies'] in ies_codes); unresolved += int(d['co_ies'] not in ies_codes)
                if d['igc_band'] is not None: bands[str(d['igc_band'])]=bands.get(str(d['igc_band']),0)+1
                vals.append((run_id,year,d['co_ies'],d['uf'],d['name'],d['academic_organization'],d['administrative_category'],d['igc_continuous'],d['igc_band'],d['courses_with_cpc'],d['source_status'],Json(row_json(row))))
            execute_values(cur,"INSERT INTO civica_exec.exec_edu_quality_ies(source_run_id,reference_year,co_ies,uf,name,academic_organization,administrative_category,igc_continuous,igc_band,courses_with_cpc,source_status,raw_values) VALUES %s ON CONFLICT DO NOTHING",vals,page_size=1000)
        else:
            vals=[]; cw=[]
            for row in rows:
                d=parse_course(indicator,year,row)
                if not d['co_ies'] or not d['co_curso']: continue
                valid+=1; municipalities.add(d['co_municipio']) if d['co_municipio'] else None; ufs.add(d['uf']) if d['uf'] else None
                status='OFFICIAL_LINK' if d['co_ies'] in ies_codes and d['co_curso'] in course_codes else ('NEEDS_VALIDATION' if d['co_ies'] in ies_codes else 'UNRESOLVED')
                linked += int(status=='OFFICIAL_LINK'); unresolved += int(status=='UNRESOLVED'); ambiguous += int(status=='AMBIGUOUS')
                if d['band'] is not None: bands[str(d['band'])]=bands.get(str(d['band']),0)+1
                source_key='|'.join(str(x if x is not None else '') for x in [d['co_ies'],d['co_curso'],d['co_municipio'],d['area_code']])
                vals.append((run_id,indicator,year,source_key,d['co_ies'],d['co_curso'],d['co_municipio'],d['uf'],d['area_code'],d['area_name'],d['degree'],d['modality'],d['course_name'],d['continuous_value'],d['band'],None,status,Json(row_json(row))))
                cw.append((run_id,indicator,year,source_key,d['co_ies'],d['co_curso'],status,'source-native CO_IES + CO_CURSO; crosswalk against Censo Superior'))
            execute_values(cur,"INSERT INTO civica_exec.exec_edu_quality_course(source_run_id,indicator,reference_year,source_key,co_ies,co_curso,co_municipio,uf,area_code,area_name,degree,modality,course_name,continuous_value,band,source_status,crosswalk_status,raw_values) VALUES %s ON CONFLICT DO NOTHING",vals,page_size=1000)
            execute_values(cur,"INSERT INTO civica_exec.exec_edu_quality_crosswalk(source_run_id,indicator,reference_year,source_key,co_ies,co_curso,status,evidence) VALUES %s ON CONFLICT DO NOTHING",cw,page_size=1000)
        cur.execute("INSERT INTO civica_exec.exec_edu_quality_coverage(source_run_id,indicator,reference_year,source_rows,valid_rows,linked_ies,linked_courses,unresolved_rows,ambiguous_rows,municipalities_count,ufs_count,bands) VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",(run_id,indicator,year,source_rows,valid,linked,linked,unresolved,ambiguous,len(municipalities),len(ufs),Json(bands)))
        cur.execute("UPDATE civica_exec.exec_edu_quality_source_run SET finished_at=now(),data_through=%s,rows_source=%s,rows_valid=%s,rows_linked=%s,rows_unresolved=%s WHERE source_run_id=%s",(f'{year}-12-31',source_rows,valid,linked,unresolved,run_id))
        # compact serving: Brazil, UF and municipality, always from source-native quality rows.
        if indicator=='IGC':
            cur.execute("INSERT INTO civica_exec.exec_edu_quality_territory_year(indicator,reference_year,scope,scope_key,evaluated_ies,published_rows,band_distribution,source_run_id) SELECT %s,%s,1,'BR',count(DISTINCT co_ies),count(*),%s,%s FROM civica_exec.exec_edu_quality_ies WHERE source_run_id=%s ON CONFLICT(indicator,reference_year,scope,scope_key) DO UPDATE SET evaluated_ies=EXCLUDED.evaluated_ies,published_rows=EXCLUDED.published_rows,band_distribution=EXCLUDED.band_distribution,source_run_id=EXCLUDED.source_run_id,refreshed_at=now()",(indicator,year,Json(bands),run_id,run_id))
        else:
            cur.execute("INSERT INTO civica_exec.exec_edu_quality_territory_year(indicator,reference_year,scope,scope_key,evaluated_ies,evaluated_courses,published_rows,band_distribution,source_run_id) SELECT %s,%s,1,'BR',count(DISTINCT co_ies),count(DISTINCT co_curso),count(*),%s,%s FROM civica_exec.exec_edu_quality_course WHERE source_run_id=%s ON CONFLICT(indicator,reference_year,scope,scope_key) DO UPDATE SET evaluated_ies=EXCLUDED.evaluated_ies,evaluated_courses=EXCLUDED.evaluated_courses,published_rows=EXCLUDED.published_rows,band_distribution=EXCLUDED.band_distribution,source_run_id=EXCLUDED.source_run_id,refreshed_at=now()",(indicator,year,Json(bands),run_id,run_id))
            cur.execute("INSERT INTO civica_exec.exec_edu_quality_territory_year(indicator,reference_year,scope,scope_key,evaluated_ies,evaluated_courses,published_rows,band_distribution,source_run_id) SELECT %s,reference_year,3,COALESCE(uf,'??'),count(DISTINCT co_ies),count(DISTINCT co_curso),count(*),jsonb_object_agg(COALESCE(band::text,'NA'),n),%s FROM (SELECT reference_year,uf,co_ies,co_curso,band,count(*) n FROM civica_exec.exec_edu_quality_course WHERE source_run_id=%s GROUP BY reference_year,uf,co_ies,co_curso,band) x GROUP BY reference_year,uf ON CONFLICT(indicator,reference_year,scope,scope_key) DO UPDATE SET evaluated_ies=EXCLUDED.evaluated_ies,evaluated_courses=EXCLUDED.evaluated_courses,published_rows=EXCLUDED.published_rows,band_distribution=EXCLUDED.band_distribution,source_run_id=EXCLUDED.source_run_id,refreshed_at=now()",(indicator,run_id,run_id))
            cur.execute("INSERT INTO civica_exec.exec_edu_quality_territory_year(indicator,reference_year,scope,scope_key,evaluated_ies,evaluated_courses,published_rows,band_distribution,source_run_id) SELECT %s,reference_year,4,co_municipio::text,count(DISTINCT co_ies),count(DISTINCT co_curso),count(*),jsonb_object_agg(COALESCE(band::text,'NA'),n),%s FROM (SELECT reference_year,co_municipio,co_ies,co_curso,band,count(*) n FROM civica_exec.exec_edu_quality_course WHERE source_run_id=%s AND co_municipio IS NOT NULL GROUP BY reference_year,co_municipio,co_ies,co_curso,band) x GROUP BY reference_year,co_municipio ON CONFLICT(indicator,reference_year,scope,scope_key) DO UPDATE SET evaluated_ies=EXCLUDED.evaluated_ies,evaluated_courses=EXCLUDED.evaluated_courses,published_rows=EXCLUDED.published_rows,band_distribution=EXCLUDED.band_distribution,source_run_id=EXCLUDED.source_run_id,refreshed_at=now()",(indicator,run_id,run_id))
        conn.commit(); results.append({'indicator':indicator,'year':year,'status':'published','source_run_id':run_id,'sheet':sheet,'rows_source':source_rows,'rows_valid':valid,'rows_linked':linked,'rows_unresolved':unresolved,'municipalities':len(municipalities),'ufs':len(ufs),'sha256':digest,'bytes':size})
    conn.close(); print(json.dumps({'database':db,'user':user,'parser':PARSER,'results':results},ensure_ascii=False,indent=2))

if __name__=='__main__': main()
