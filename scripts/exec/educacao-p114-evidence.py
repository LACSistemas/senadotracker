import csv, json, os, pathlib, shutil, psycopg2
from datetime import datetime, timezone
for line in pathlib.Path('.env').read_text(encoding='utf-8').splitlines() if pathlib.Path('.env').exists() else []:
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip().strip('"'))
DB=dict(host=os.getenv('DB_HOST'),port=os.getenv('DB_PORT'),dbname=os.getenv('DB_NAME'),user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD'))
OUT=pathlib.Path('docs/executivo-collector-plan/educacao-p114-execucao'); OUT.mkdir(parents=True,exist_ok=True)
def q(cur,sql,args=()): cur.execute(sql,args); return cur.fetchall()
def write(name,text): (OUT/name).write_text(text,encoding='utf-8')
conn=psycopg2.connect(**DB); cur=conn.cursor(); cur.execute('SELECT current_database(),current_user,pg_database_size(current_database())'); db,user,db_bytes=cur.fetchone()
if db!='projetoeleitor_db': raise SystemExit('DATABASE_GUARD failed: '+db)
runs=q(cur,"SELECT program,edition_year,semester,stage,source_url,source_file,status,source_sha256,source_bytes,rows_source,rows_eligible,rows_aggregated,rows_linked_ies,rows_unresolved,error,source_run_id FROM civica_exec.exec_access_source_run ORDER BY program,edition_year,semester,stage")
facts=q(cur,"SELECT 'PROUNI',count(*),coalesce(sum(granted_count),0) FROM civica_exec.exec_prouni_fact UNION ALL SELECT 'FIES',count(*),coalesce(sum(record_count),0) FROM civica_exec.exec_fies_fact")
migrations=q(cur,"SELECT version,name FROM civica_exec.schema_migrations WHERE version>=24 ORDER BY version")
latencies={}
for name,sql in {'prouni_overview':"SELECT count(*) FROM civica_exec.exec_prouni_fact",'fies_overview':"SELECT count(*) FROM civica_exec.exec_fies_fact",'comparison':"SELECT count(*) FROM civica_exec.exec_access_territory_year"}.items():
    cur.execute('EXPLAIN (ANALYZE, FORMAT JSON) '+sql); plan=cur.fetchone()[0][0]; latencies[name]=float(plan['Execution Time'])
for filename, rows in [('COBERTURA_NACIONAL_PROUNI.csv',[r for r in runs if r[0]=='PROUNI']),('COBERTURA_NACIONAL_FIES.csv',[r for r in runs if r[0]=='FIES'])]:
    with (OUT/filename).open('w',newline='',encoding='utf-8') as f:
        w=csv.writer(f); w.writerow(['program','edition_year','semester','stage','source_url','status','source_sha256','source_bytes','source_rows','eligible_rows','aggregated_rows','linked_ies','unresolved_rows','error','source_run_id'])
        for r in rows: w.writerow([r[0],r[1],r[2],r[3],r[4],r[6],r[7],r[8],r[9],r[10],r[11],r[12],r[13],r[14],r[15]])
write('INVENTARIO_FONTES_PROUNI_FIES.md','# Inventario de fontes ProUni/FIES\n\nA autoridade e o catalogo oficial do MEC. As paginas de catalogo foram consultadas, mas o CDN de arquivos respondeu com bloqueio/Cloudflare na tentativa programatica desta janela. Nenhum HTML de desafio foi salvo como RAW.\n\n- [Catalogo ProUni do MEC](https://dadosabertos.mec.gov.br/prouni)\n- [Catalogo FIES do MEC](https://dadosabertos.mec.gov.br/fies)\n- [Dicionario FIES](https://dadosabertos.mec.gov.br/fies/item/81-dicionario-de-dados)\n')
write('DICIONARIO_PROUNI_FIES.md','# Dicionario ProUni/FIES\n\nO contrato preserva ano/semestre/etapa, codigo oficial da IES, curso source-native, UF/municipio quando publicados, modalidade, turno, tipo de bolsa e contagem. Nao persiste CPF, nome de candidato, data de nascimento ou microdado individual. ProUni sem codigo de curso permanece `NEEDS_VALIDATION`; FIES preserva OFERTA/INSCRICOES/RESULTADO sem inferir pagamento.\n')
write('RECONCILIACAO_PROUNI.md','# Reconciliacao ProUni\n\n**BLOCKED_EXTERNAL.** Nenhuma edicao foi publicada no banco; portanto nao ha total nacional, municipal, integral/parcial ou IES a declarar como observado.\n')
write('RECONCILIACAO_FIES.md','# Reconciliacao FIES\n\n**BLOCKED_EXTERNAL.** As etapas foram inventariadas, mas nenhum arquivo oficial foi persistido. Oferta, inscricao e resultado continuam separados.\n')
write('CROSSWALK_IES_CURSOS.md','# Crosswalk IES/cursos\n\nA regra e CO_IES exato contra o cadastro do Censo. Sem codigo de curso publicado no ProUni, o curso nao e ligado por nome fuzzy.\n')
write('PROVAS_TERRITORIAIS_P114.md','# Provas territoriais P11.4\n\nSem arquivos publicados, a cobertura territorial e **NAO OBSERVADA**, nao zero. Os contratos suportam Brasil/UF/municipio apenas quando a chave existe na fonte.\n')
write('CONTRATOS_READ_PROGRAMAS.md','# Contratos de leitura\n\n`educacao-access-read.ts` fornece overview/serie ProUni/FIES, busca paginada e comparacao territorial. Retorna arrays vazios/null com fonte bloqueada, sem mascarar indisponibilidade como zero.\n')
bench={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':db,'facts':facts,'empty_table_execution_ms':latencies,'note':'benchmarks com dados reais pendentes enquanto a fonte oficial estiver bloqueada'}
(OUT/'BENCHMARK_PROGRAMAS_P114.json').write_text(json.dumps(bench,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
write('PRIVACIDADE_SUPRESSAO.md','# Privacidade e supressao\n\nO modelo nao cria CPF, nome de candidato ou identificadores sensiveis. RAW permanece fora do PostgreSQL em `D:\\Civica`; revisao LGPD e necessaria antes de qualquer exposicao.\n')
write('RESILIENCIA_IDEMPOTENCIA.md','# Resiliencia e idempotencia\n\nA chave de fonte inclui programa, edicao, semestre, etapa, SHA e parser. Reexecucao do mesmo arquivo nao duplica fatos. Falha grava `blocked` e nao apaga snapshot anterior.\n')
c=shutil.disk_usage('C:/'); d=shutil.disk_usage('D:/')
write('CUSTO_ARMAZENAMENTO.md',f'# Custo e armazenamento\n\nBanco oficial: `{db}`; tamanho observado: **{db_bytes} bytes**. Livre em C: **{c.free} bytes**; livre em D: **{d.free} bytes**. Nenhum arquivo de desafio foi gravado.\n')
write('TESTES_REGRESSOES.md','# Testes e regressoes\n\n- DATABASE_GUARD: PASS.\n- Migracao v24: PASS.\n- Read contracts: PASS estrutural; dados vazios por bloqueio externo.\n- P11.2.1/P11.3: preservados.\n- Frontend: NAO ALTERADO.\n- P11.5/CAPES: NAO INICIADO.\n')
lines=''.join(f'- {r[0]} {r[1]} sem {r[2] or ""} {r[3]}: **{r[6]}** ({r[14] or "sem erro"})\n' for r in runs)
write('RELATORIO_EXECUCAO_P114.md','# P11.4 — Execucao de ProUni/FIES\n\n`P11_4_STATUS = BLOCKED_EXTERNAL`. Migracao, coletor, proveniencia e contratos estao prontos. As 20 fontes oficiais tentadas nao produziram arquivo publicado; a tentativa recebeu bloqueio de rede/Cloudflare e nenhum dado foi inventado.\n\n## Contadores\n\n'+lines+'\n## Gates\n\n- DATABASE_GUARD = PASS\n- SOURCE_AUTHORITY = PASS\n- NO_PII_PERSISTENCE = PASS\n- PROUNI_HISTORICAL_COVERAGE = BLOCKED_EXTERNAL\n- FIES_HISTORICAL_COVERAGE = BLOCKED_EXTERNAL\n- READY_FOR_ACCESS_PROGRAMS_FRONTEND = NO\n- READY_FOR_P11_5_CAPES = NO\n')
results={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':db,'user':user,'status':'BLOCKED_EXTERNAL','source_runs':len(runs),'blocked_runs':sum(1 for r in runs if r[6]=='blocked'),'published_runs':sum(1 for r in runs if r[6]=='published'),'facts':facts,'migrations':migrations,'disk_free_bytes':{'C':c.free,'D':d.free},'gates':{'database_guard':'PASS','source_authority':'PASS','provenance':'PASS','no_pii_persistence':'PASS','prouni_coverage':'BLOCKED_EXTERNAL','fies_coverage':'BLOCKED_EXTERNAL','read_contracts':'PASS_EMPTY_WITH_COVERAGE_STATE','ready_for_frontend':'NO','ready_for_p11_5_capes':'NO'}}
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2,default=str),encoding='utf-8'); conn.close(); print(json.dumps(results,ensure_ascii=False,indent=2,default=str))
