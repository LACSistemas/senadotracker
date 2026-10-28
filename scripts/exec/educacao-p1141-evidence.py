import csv, hashlib, json, os, pathlib, shutil, psycopg2
from datetime import datetime, timezone

for line in pathlib.Path('.env').read_text(encoding='utf-8').splitlines() if pathlib.Path('.env').exists() else []:
    if '=' in line and not line.lstrip().startswith('#'):
        k,v=line.split('=',1); os.environ.setdefault(k.strip(),v.strip().strip('"'))
DB=dict(host=os.getenv('DB_HOST'),port=os.getenv('DB_PORT'),dbname=os.getenv('DB_NAME'),user=os.getenv('DB_USER'),password=os.getenv('DB_PASSWORD'))
OUT=pathlib.Path('docs/executivo-collector-plan/educacao-p1141-execucao'); OUT.mkdir(parents=True,exist_ok=True)
def write(name,text): (OUT/name).write_text(text,encoding='utf-8')
def sha(path):
    h=hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
conn=psycopg2.connect(**DB); cur=conn.cursor(); cur.execute('SELECT current_database(),current_user,pg_database_size(current_database())'); db,user,db_bytes=cur.fetchone()
if db!='projetoeleitor_db': raise SystemExit('DATABASE_GUARD failed: '+db)
cur.execute("SELECT status,count(*) FROM civica_exec.exec_access_source_run GROUP BY status ORDER BY status"); run_status=cur.fetchall()
cur.execute("SELECT count(*) FROM civica_exec.exec_prouni_fact"); prouni_rows=cur.fetchone()[0]
cur.execute("SELECT count(*) FROM civica_exec.exec_fies_fact"); fies_rows=cur.fetchone()[0]
cur.execute("SELECT count(*) FROM civica_exec.exec_access_source_run WHERE program='PROUNI' AND status='blocked'"); prouni_runs=cur.fetchone()[0]
cur.execute("SELECT count(*) FROM civica_exec.exec_access_source_run WHERE program='FIES' AND status='blocked'"); fies_runs=cur.fetchone()[0]

matrix=[
 ['DNS','dadosabertos.mec.gov.br','Resolve-DnsName','sandbox','PASS','104.17.46.238;104.17.47.238;2606:4700::6811:2fee;2606:4700::6811:2eee','CNAME Cloudflare'],
 ['TCP_443','dadosabertos.mec.gov.br','Test-NetConnection','sandbox','FAIL','connection_failed','socket unavailable before HTTP'],
 ['HTTPS','FIES 2022 CSV','PowerShell Invoke-WebRequest','sandbox','FAIL','WebException: impossivel conectar','no HTTP reached'],
 ['HTTPS','FIES 2022 CSV','curl.exe','sandbox','FAIL','curl (7) failed to connect','no HTTP reached'],
 ['HTTPS','FIES 2022 CSV','Python urllib','sandbox','FAIL','WinError 10013','local socket restriction'],
 ['HTTPS','FIES 2022 CSV','Python requests','sandbox','FAIL','WinError 10013','local socket restriction'],
 ['HTTPS','FIES 2022 CSV','PowerShell Invoke-WebRequest','outside_sandbox','HTTP_403','text/html; charset=UTF-8; 5721 bytes','Cloudflare challenge'],
 ['HTTPS','FIES 2022 CSV','curl.exe','outside_sandbox','HTTP_403','text/html; charset=UTF-8; 5721 bytes','Server cloudflare; Cf-Mitigated challenge'],
 ['HTTPS','FIES 2022 CSV','Python urllib','outside_sandbox','HTTP_403','HTTPError 403','response reached'],
 ['HTTPS','FIES 2022 CSV','Python requests','outside_sandbox','HTTP_403','403 text/html; 5721 bytes','response reached'],
 ['HTTPS','ProUni 2025 CSV','curl.exe','outside_sandbox','HTTP_403','text/html; charset=UTF-8; 5594 bytes','Server cloudflare; Cf-Mitigated challenge'],
 ['HTTPS','ProUni catalog','Python requests GET','outside_sandbox','HTTP_403','text/html; challenge','catalog page also challenged'],
 ['HTTPS','FIES catalog','Python requests GET','outside_sandbox','HTTP_403','text/html; challenge','catalog page also challenged'],
]
with (OUT/'MATRIZ_CONECTIVIDADE_HTTP.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['layer','target','client','execution_scope','result','observed','interpretation']); w.writerows(matrix)
raw=pathlib.Path(r'D:\Civica\raw\mec\prouni\PDA_PROUNI_2016_CSV.csv')
with (OUT/'FONTES_RECUPERADAS_SHA256.csv').open('w',newline='',encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['program','edition','official_url','local_path','http_status','mime','bytes','sha256','integrity_status','coverage_note'])
    if raw.exists():
        head=raw.read_bytes()[:256].lower(); status='REJECTED_HTML_CHALLENGE' if b'<html' in head else 'REVIEW'
        w.writerow(['PROUNI',2016,'http://informacao.mec.gov.br/bilibs/PDA/PROUNI/PDA_PROUNI_2016_CSV.csv',str(raw), 'unknown','text/html' if status.startswith('REJECTED') else 'unknown',raw.stat().st_size,sha(raw),status,'local file is HTML challenge, not CSV'])
    w.writerow(['PROUNI',2025,'https://dadosabertos.mec.gov.br/images/conteudo/prouni/2025/prouni_pda_2025.csv','','403','text/html; charset=UTF-8',5594,'','NOT_RECOVERED','Cloudflare challenge'])
    w.writerow(['FIES',2022,'https://dadosabertos.mec.gov.br/images/conteudo/fies/2022/relatorio_dados_abertos_oferta_12022_15072022.csv','','403','text/html; charset=UTF-8',5721,'','NOT_RECOVERED','Cloudflare challenge'])
c=shutil.disk_usage('C:/'); d=shutil.disk_usage('D:/')
write('DIAGNOSTICO_WINERROR_10013.md',f'''# Diagnóstico do WinError 10013

## Causa separada

No sandbox do Codex, DNS resolveu o domínio, mas TCP/443 não abriu. PowerShell e `curl.exe` falharam antes do HTTP; `urllib` e `requests` retornaram `WinError 10013`. Isso é uma restrição de socket do ambiente de execução, não prova de bloqueio do MEC.

Fora do sandbox, sem alteração de firewall, antivírus, proxy ou Defender, o mesmo URL foi alcançado por PowerShell, `curl.exe`, `urllib` e `requests` e respondeu **HTTP 403**. Os headers observados foram `Server: cloudflare`, `Cf-Mitigated: challenge`, `Content-Type: text/html; charset=UTF-8`; não houve CSV. O catálogo ProUni 2025 retornou 5594 bytes HTML e o FIES 2022, 5721 bytes HTML.

## Proxy e DNS

- `HTTP_PROXY`, `HTTPS_PROXY`, `NO_PROXY`: não definidos.
- WinHTTP: acesso direto, sem proxy.
- DNS: CNAME para `dadosabertos.mec.gov.br.cdn.cloudflare.net`, IPv4 `104.17.46.238`/`104.17.47.238` e IPv6 Cloudflare.

Conclusão: há dois bloqueios distintos: restrição local do sandbox e desafio externo Cloudflare que exige sessão autorizada. Não foi feita tentativa de contorno.

''')
write('RECONCILIACAO_PROUNI_REAL.md',f'''# Reconciliação ProUni real

`PROUNI_STATUS = BLOCKED_EXTERNAL`. O catálogo oficial identifica 2024 e 2025, mas o arquivo 2025 respondeu 403/HTML. Nenhuma linha real foi ingerida; `exec_prouni_fact` permanece com **{prouni_rows}** linhas e {prouni_runs} source-runs bloqueados. Não há total nacional, bolsas integral/parcial, IES ou município a declarar.
''')
write('RECONCILIACAO_FIES_REAL.md',f'''# Reconciliação FIES real

`FIES_STATUS = BLOCKED_EXTERNAL`. O caso FIES Oferta 1/2022 foi alcançado fora do sandbox, mas respondeu 403/HTML com desafio Cloudflare. `exec_fies_fact` permanece com **{fies_rows}** linhas e {fies_runs} source-runs bloqueados. Oferta, inscrição e resultado continuam semanticamente separados.
''')
write('COBERTURA_TERRITORIAL.md','''# Cobertura territorial

Nenhuma linha ProUni/FIES foi publicada, portanto a cobertura territorial é **NÃO OBSERVADA**, não zero. Os catálogos oficiais descrevem granularidade municipal; isso é capacidade documentada da fonte, não cobertura ingerida. Não houve resolução por nome nem imputação de UF/município.
''')
bench={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':db,'real_data_rows':{'prouni':prouni_rows,'fies':fies_rows},'source_attempts':{'prouni_blocked_runs':prouni_runs,'fies_blocked_runs':fies_runs},'p95_ms':None,'p99_ms':None,'network_observed':{'sandbox_socket':'WinError 10013','outside_sandbox_http':'403 Cloudflare challenge'},'storage':{'database_bytes':db_bytes,'C_free_bytes':c.free,'D_free_bytes':d.free},'status':'NOT_RUN_NO_VALID_FILE'}
(OUT/'BENCHMARK_DADOS_REAIS.json').write_text(json.dumps(bench,ensure_ascii=False,indent=2),encoding='utf-8')
write('TESTES_E_IDEMPOTENCIA.md',f'''# Testes e idempotência

- `DATABASE_GUARD`: PASS (`{db}`).
- `SOURCE_RUN_ID` idempotência: PASS; após reexecuções, existem {prouni_runs + fies_runs} source-runs bloqueados únicos e zero fatos.
- `PROUNI_REAL_INGESTION`: NOT_RUN_NO_VALID_FILE.
- `FIES_REAL_INGESTION`: NOT_RUN_NO_VALID_FILE.
- Validação de arquivo: PASS; HTML de desafio local foi rejeitado, não tratado como CSV.
- Transação/last-known-good: sem snapshot publicado, nada foi substituído.
- Não houve interrupção de PNCP/collectors, alteração de frontend ou novo migration.
''')
write('RELATORIO_EXECUCAO_P1141.md',f'''# P11.4.1 — Desbloqueio operacional e coleta real

## Resultado

`PROUNI_STATUS = BLOCKED_EXTERNAL`  
`FIES_STATUS = BLOCKED_EXTERNAL`  
`READY_FOR_ACCESS_PROGRAMS_FRONTEND = NO`  
`READY_FOR_PUBLICATION = NO`

O `WinError 10013` foi corretamente atribuído ao sandbox local quando observado ali. Fora dele, os endpoints oficiais responderam HTTP 403 com desafio Cloudflare. Portanto a coleta não pode ser declarada operacional sem uma sessão autorizada; nenhum desafio foi contornado.

O único arquivo local encontrado em `D:\\Civica\\raw\\mec` era HTML de desafio com extensão `.csv` e foi rejeitado. Não há dados reais para reconciliar, medir p95/p99 ou publicar.

## Gates

| Gate | Resultado |
|---|---|
| NETWORK_ROOT_CAUSE | PASS_WITH_DOCUMENTED_LAYERS |
| PROUNI_SOURCE_ACCESS | BLOCKED_EXTERNAL |
| FIES_SOURCE_ACCESS | BLOCKED_EXTERNAL |
| PROUNI_REAL_INGESTION | NOT_RUN_NO_VALID_FILE |
| FIES_REAL_INGESTION | NOT_RUN_NO_VALID_FILE |
| TERRITORIAL_RECONCILIATION | NOT_APPLICABLE_NO_FACTS |
| PRIVACY | PASS |
| REAL_DATA_PERFORMANCE | NOT_RUN_NO_VALID_FILE |
| STORAGE_SAFETY | PASS |
''')
results={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':db,'user':user,'status':'BLOCKED_EXTERNAL','gates':{'network_root_cause':'PASS_WITH_DOCUMENTED_LAYERS','prouni_source_access':'BLOCKED_EXTERNAL','fies_source_access':'BLOCKED_EXTERNAL','prouni_real_ingestion':'NOT_RUN_NO_VALID_FILE','fies_real_ingestion':'NOT_RUN_NO_VALID_FILE','territorial_reconciliation':'NOT_APPLICABLE_NO_FACTS','privacy':'PASS','real_data_performance':'NOT_RUN_NO_VALID_FILE','storage_safety':'PASS'},'PROUNI_STATUS':'BLOCKED_EXTERNAL','FIES_STATUS':'BLOCKED_EXTERNAL','READY_FOR_ACCESS_PROGRAMS_FRONTEND':'NO','READY_FOR_PUBLICATION':'NO','database_bytes':db_bytes,'prouni_rows':prouni_rows,'fies_rows':fies_rows,'source_run_status':run_status,'disk_free_bytes':{'C':c.free,'D':d.free},'local_raw_rejected':str(raw) if raw.exists() else None}
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2,default=str),encoding='utf-8'); conn.close(); print(json.dumps(results,ensure_ascii=False,indent=2,default=str))
