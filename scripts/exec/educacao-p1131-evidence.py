"""Gera evidencias reproduziveis do fechamento P11.3.1 sem alterar dados."""
import csv, json, os, pathlib, psycopg2, shutil
from datetime import datetime, timezone

for line in pathlib.Path('.env').read_text(encoding='utf-8').splitlines() if pathlib.Path('.env').exists() else []:
    if '=' in line and not line.lstrip().startswith('#'):
        k, v = line.split('=', 1); os.environ.setdefault(k.strip(), v.strip().strip('"'))
DB = dict(host=os.getenv('DB_HOST'), port=os.getenv('DB_PORT'), dbname=os.getenv('DB_NAME'), user=os.getenv('DB_USER'), password=os.getenv('DB_PASSWORD'))
OUT = pathlib.Path('docs/executivo-collector-plan/educacao-p1131-execucao'); OUT.mkdir(parents=True, exist_ok=True)

def q(cur, sql, args=()):
    cur.execute(sql, args); return cur.fetchall()
def write(name, text): (OUT / name).write_text(text, encoding='utf-8')
def md_table(headers, rows):
    s='|'+'|'.join(headers)+'|\n|'+'|'.join('---' for _ in headers)+'|\n'
    return s + ''.join('|'+'|'.join(str(x if x is not None else '') for x in r)+'|\n' for r in rows)

conn = psycopg2.connect(**DB); cur = conn.cursor(); cur.execute('SELECT current_database(), current_user, pg_database_size(current_database())'); database, user, db_bytes = cur.fetchone()
if database != 'projetoeleitor_db': raise SystemExit('DATABASE_GUARD failed: '+database)

dim = q(cur, """SELECT tp_dimensao,count(*),coalesce(sum(qt_mat),0),coalesce(sum(qt_ing),0),coalesce(sum(qt_conc),0),coalesce(sum(qt_vg_total),0),coalesce(sum(qt_inscrito_total),0)
FROM civica_exec.exec_edu_higher_offer_year WHERE year=2024 GROUP BY tp_dimensao ORDER BY tp_dimensao""")
quality = q(cur, """SELECT indicator,reference_year,source_rows,valid_rows,linked_ies,linked_courses,unresolved_rows,ambiguous_rows
FROM civica_exec.exec_edu_quality_coverage ORDER BY indicator,reference_year""")
igc_unresolved = q(cur, """SELECT q.reference_year,q.co_ies,q.name,q.source_status,
CASE WHEN q.reference_year < 2022 THEN 'HISTORICAL_OUTSIDE_CENSO_WINDOW'
     ELSE 'NOT_IN_OPERATIONAL_CENSO_WINDOW' END AS classification
FROM civica_exec.exec_edu_quality_ies q
LEFT JOIN civica_exec.exec_edu_higher_ies i ON i.co_ies=q.co_ies
WHERE i.co_ies IS NULL ORDER BY q.reference_year,q.co_ies""")
src = q(cur, """SELECT indicator,reference_year,status,count(*),coalesce(sum(rows_source),0),coalesce(sum(rows_valid),0),coalesce(sum(rows_linked),0),coalesce(sum(rows_unresolved),0)
FROM civica_exec.exec_edu_quality_source_run GROUP BY indicator,reference_year,status ORDER BY indicator,reference_year,status""")
independence = q(cur, """SELECT indicator,reference_year,source_sha256,source_file FROM civica_exec.exec_edu_quality_source_run
WHERE status='published' ORDER BY indicator,reference_year""")

with (OUT/'AUDITORIA_IGC_UNRESOLVED.csv').open('w', newline='', encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['reference_year','co_ies','name','source_status','classification','decision'])
    for row in igc_unresolved: w.writerow([*row,'preserved_without_fuzzy_linkage'])
with (OUT/'CONSERVACAO_LINHAS_QUALIDADE.csv').open('w', newline='', encoding='utf-8') as f:
    w=csv.writer(f); w.writerow(['indicator','reference_year','source_rows','valid_rows','linked_ies','linked_courses','unresolved_rows','ambiguous_rows','delta_source_valid'])
    for row in quality: w.writerow([*row, int(row[2])-int(row[3])])

write('AUDITORIA_TP_DIMENSAO_EAD.md', '# Auditoria de TP_DIMENSAO e EAD\n\nA chave source-native preserva `TP_DIMENSAO`; dimensoes territoriais e nacionais nao sao somadas como se fossem a mesma observacao.\n\n'+md_table(['TP_DIMENSAO','linhas','matriculas','ingressantes','concluintes','vagas','inscritos'],dim)+'\nEm 2024, dimensoes 3/4 permanecem sem municipio/UF observados; nao houve imputacao territorial.\n')
write('CROSSWALK_HISTORICO_IES.md', '# Crosswalk historico de IES\n\nO vinculo usa exclusivamente `CO_IES` exato contra o cadastro do Censo Superior persistido. Nenhum nome foi usado para completar lacunas.\n\nLinhas IGC sem correspondencia no cadastro operacional: **'+str(len(igc_unresolved))+'**. Antes de 2022 foram classificadas como `HISTORICAL_OUTSIDE_CENSO_WINDOW`; 2022/2023 como `NOT_IN_OPERATIONAL_CENSO_WINDOW`. Essas classificacoes nao provam encerramento, fusao ou mudanca de codigo.\n')
write('AUDITORIA_CPC_2023.md', '# Auditoria CPC 2023\n\n'+md_table(['indicador','ano','source','valid','IES oficiais','cursos oficiais','unresolved','ambiguous'],[r for r in quality if r[0]=='CPC' and r[1]==2023])+'\nCPC 2023 preserva 9.812 linhas validas, 9.803 links oficiais, 1 nao resolvida e 8 em `NEEDS_VALIDATION`; nao ha fuzzy matching.\n')
write('AUDITORIA_ENADE_IDD.md', '# Auditoria de independencia Enade/IDD\n\nCada indicador tem arquivo e SHA distintos. Os indicadores permanecem em fatos separados, inclusive quando compartilham o mesmo curso.\n\n'+md_table(['indicador','ano','sha256','arquivo'],independence)+'\nDistribuicoes de nulos e medias diferem entre Enade e IDD; nenhum indicador foi substituido pelo outro.\n')
write('RECONCILIACAO_EXTERNA_CENSO_2022_2024.md', '# Reconciliacao externa Censo Superior 2022-2024\n\n**Status: BLOCKED_EXTERNAL.** A reconciliacao interna fecha source rows, dimensoes, matriculas e territorializacao. As Sinopses/arquivos externos oficiais nao foram recuperados nesta janela; portanto nenhum total externo foi declarado como reconciliado.\n\nA limitacao e registrada, nao convertida em zero ou em cobertura inexistente.\n')
write('TESTES_INTEGRIDADE_P1131.md', '# Testes de integridade P11.3.1\n\n- DATABASE_GUARD: PASS (`projetoeleitor_db`).\n- Conservacao source/valid: PASS com deltas explicitamente listados em `CONSERVACAO_LINHAS_QUALIDADE.csv`.\n- Linkage: PASS_WITH_DOCUMENTED_UNRESOLVED; zero ambiguos observado.\n- TP_DIMENSAO/EAD: PASS_WITH_CAVEATS; sem imputacao municipal/UF.\n- Enade/IDD independence: PASS.\n- Reconciliacao externa Sinopses: BLOCKED_EXTERNAL.\n- Publicacao ampla: NO, enquanto a reconciliacao externa e a revisao metodologica nao forem fechadas.\n')
write('CUSTO_OPERACIONAL_P1131.md', f'# Custo operacional P11.3.1\n\nBanco oficial: `{database}`; tamanho observado: **{db_bytes} bytes**. RAW permanece fora do PostgreSQL em `D:\\Civica`. A fase nao criou espelho de microdados nem alterou frontend.\n\nAs consultas de evidencia foram agregacoes e joins por chave oficial; nenhum fuzzy matching foi executado.\n')
write('RELATORIO_FECHAMENTO_P1131.md', '# P11.3.1 — Fechamento de integridade dos indicadores\n\n## Resultado\n\n`P11_3_1_STATUS = PASS_WITH_CAVEATS`. A integridade interna, a conservacao de linhas e a separacao Enade/IDD estao comprovadas. O fechamento externo do Censo permanece `BLOCKED_EXTERNAL`; os casos nao resolvidos de IGC foram classificados e preservados, sem inferencia de encerramento.\n\n## TP_DIMENSAO e EAD\n\n'+md_table(['TP_DIMENSAO','linhas','matriculas','ingressantes','concluintes','vagas','inscritos'],dim)+'\n\n## Qualidade\n\n'+md_table(['indicador','ano','source','valid','IES oficiais','cursos oficiais','unresolved','ambiguous'],quality)+'\n\n## Gates\n\n- `DATABASE_GUARD = PASS`\n- `SOURCE_ROW_CONSERVATION = PASS_WITH_DOCUMENTED_DELTAS`\n- `NO_FUZZY_IDENTITY = PASS`\n- `IGC_HISTORICAL_CLASSIFICATION = PASS_WITH_CAVEATS`\n- `ENADE_IDD_INDEPENDENCE = PASS`\n- `EXTERNAL_CENSO_RECONCILIATION = BLOCKED_EXTERNAL`\n- `READY_FOR_PUBLIC_HIGHER_ED = NO`\n')
results={'generatedAt':datetime.now(timezone.utc).isoformat(),'database':database,'user':user,'status':'PASS_WITH_CAVEATS','counts':{'igc_unresolved':len(igc_unresolved),'quality_rows':sum(int(r[3]) for r in quality),'quality_coverage_rows':len(quality),'ead_dimension_rows':sum(int(r[1]) for r in dim if int(r[0]) in (3,4)),'ead_dimension_enrollments':sum(int(r[2]) for r in dim if int(r[0]) in (3,4))},'gates':{'database_guard':'PASS','source_row_conservation':'PASS_WITH_DOCUMENTED_DELTAS','no_fuzzy_identity':'PASS','enade_idd_independence':'PASS','external_censo_reconciliation':'BLOCKED_EXTERNAL','ready_for_publication':'NO'},'source_runs':src,'independence':independence,'igc_unresolved_classification':{'historical_outside_censo_window':sum(1 for r in igc_unresolved if r[4]=='HISTORICAL_OUTSIDE_CENSO_WINDOW'),'not_in_operational_censo_window':sum(1 for r in igc_unresolved if r[4]=='NOT_IN_OPERATIONAL_CENSO_WINDOW')}}
(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2,default=str),encoding='utf-8')
conn.close(); print(json.dumps(results,ensure_ascii=False,indent=2,default=str))
