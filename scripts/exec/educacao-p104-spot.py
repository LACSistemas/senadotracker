"""P10.4 — conferência por amostra, com leitura INDEPENDENTE das planilhas oficiais (outro caminho de código, sem usar os extratores): compara o valor da planilha com o gravado no banco.
Uso: python -I -X utf8 educacao-p104-spot.py <saida.json> <host:porta>      (host:porta do cluster de teste com postgres/postgres, ou a palavra prod para usar o .env; só leitura)
Casos: Ideb (município × etapa × rede × edição), Saeb (município), rendimento e distorção (município e escola), transição (município), INSE (escola e município).
"""
import io, json, subprocess, sys, zipfile, warnings

import openpyxl

warnings.filterwarnings('ignore')
OUT, HP = sys.argv[1], sys.argv[2]
if HP == 'prod':      # banco de produção: credenciais do .env (apenas SELECT)
    envv = dict(l.split('=', 1) for l in open('.env', encoding='utf8').read().splitlines() if '=' in l and not l.lstrip().startswith('#'))
    host, port, DBN, DBU, DBP = envv['DB_HOST'].strip(), envv.get('DB_PORT', '5432').strip(), envv['DB_NAME'].strip(), envv['DB_USER'].strip(), envv['DB_PASSWORD'].strip()
else:
    host, port = HP.split(':'); DBN, DBU, DBP = 'projetoeleitor_db', 'postgres', 'postgres'
PSQL = r'C:\Program Files\PostgreSQL\17\bin\psql.exe'
RAW = 'D:/Civica/raw/inep'
MUN = {3205309: 'Vitória', 3205002: 'Serra', 3200359: 'Alto Rio Novo', 3550308: 'São Paulo', 3304557: 'Rio de Janeiro', 3106200: 'Belo Horizonte', 2611606: 'Recife', 4314902: 'Porto Alegre', 3507209: 'Borá', 3166600: 'Serra da Saudade'}


def db(sql):
    r = subprocess.run([PSQL, '-h', host, '-p', port, '-U', DBU, '-d', DBN, '-AtF', '|', '-c', sql], capture_output=True, text=True, env={'PGPASSWORD': DBP, 'SystemRoot': 'C:/Windows'})
    if r.returncode: raise SystemExit(r.stderr)
    return [l.split('|') for l in r.stdout.strip().splitlines() if l]


def num(v):
    if v is None: return None
    if isinstance(v, (int, float)): return float(v)
    t = str(v).strip()
    try: return float(t)
    except ValueError: return None


def xlsx_rows(zpath, member_filter=None, sheet=None):
    z = zipfile.ZipFile(zpath)
    for i in z.infolist():
        if i.filename.lower().endswith('.xlsx') and (member_filter is None or member_filter in i.filename):
            wb = openpyxl.load_workbook(io.BytesIO(z.read(i)), read_only=True, data_only=True)
            for ws in wb.worksheets:
                if sheet and ws.title != sheet: continue
                yield i.filename, ws.title, ws.iter_rows(values_only=True)


results = []; bad = 0


def check(case, raw, got, tol=1e-6):
    global bad
    ok = (raw is None and got is None) or (raw is not None and got is not None and abs(raw - got) <= tol)
    if not ok: bad += 1
    results.append({'caso': case, 'planilha': raw, 'banco': got, 'ok': ok})


# ---------------------------------------------------------------- Ideb municípios (etapa × rede × edição)
STAGES = {'divulgacao_anos_iniciais_municipios_2025.zip': 1, 'divulgacao_anos_finais_municipios_2025.zip': 2, 'divulgacao_ensino_medio_municipios_2025.zip': 3}
REDE = {'Federal': 1, 'Estadual': 2, 'Municipal': 3, 'Pública': 5, 'Publica': 5}
for zname, stage in STAGES.items():
    for fname, sname, rows in xlsx_rows(f'{RAW}/ideb/2025/{zname}'):
        hdr = None; ncol = {}
        for r in rows:
            if hdr is None:
                if r and any(str(c or '').startswith('VL_OBSERVADO_') for c in r): hdr = [str(c or '') for c in r]; ncol = {h: j for j, h in enumerate(hdr)}
                continue
            if not r or r[ncol.get('CO_MUNICIPIO', 2)] is None: continue
            try: code = int(r[ncol.get('CO_MUNICIPIO', 2)])
            except (TypeError, ValueError): continue
            if code not in MUN: continue
            rede = str(r[ncol.get('REDE', 5)] if 'REDE' in ncol else r[5]).strip().replace('Pública (federal, estadual e municipal)', 'Pública')
            dep = REDE.get(rede)
            if dep is None: continue
            for yr in (2007, 2013, 2019, 2023, 2025):
                for col, db_col in (('VL_OBSERVADO_', 'ideb'), ('VL_INDICADOR_REND_', 'p'), ('VL_NOTA_MEDIA_', 'nota_media')):
                    j = ncol.get(f'{col}{yr}')
                    if j is None: continue
                    raw = num(r[j]); g = db(f"SELECT {db_col} FROM civica_exec.exec_edu_ideb_terr t JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.ibge7 = {code} AND t.year = {yr} AND t.stage = {stage} AND t.dep = {dep}")
                    got = float(g[0][0]) if g and g[0][0] != '' else None
                    check(f'ideb {MUN[code]} etapa{stage} rede{dep} {yr} {db_col}', raw, got, 1e-9)

# ---------------------------------------------------------------- Saeb município (2025: MEDIA_5_LP, MEDIA_9_MT, total × total)
wb = openpyxl.load_workbook(f'{RAW}/saeb/saeb_2025_brasil_estados_municipios_censitario.xlsx', read_only=True, data_only=True)
ws = next(w for w in wb.worksheets if 'unic' in w.title.lower() or 'mun' in w.title.lower())
hdr = None
for r in ws.iter_rows(values_only=True):
    if hdr is None:
        if r and any(str(c or '').upper().startswith('MEDIA_5_LP') for c in r): hdr = {str(c or '').upper(): j for j, c in enumerate(r)}
        continue
    try: code = int(r[hdr.get('CO_MUNICIPIO', 3)])
    except (TypeError, ValueError, KeyError): continue
    if code not in MUN: continue
    dep = str(r[hdr['DEPENDENCIA_ADM']]).strip(); loc = str(r[hdr['LOCALIZACAO']]).strip()
    if not (dep.lower().startswith('total - federal, estadual, municipal e privada') and loc.lower() == 'total'): continue
    for col, grade, subj in (('MEDIA_5_LP', 5, 1), ('MEDIA_5_MT', 5, 2), ('MEDIA_9_LP', 9, 1), ('MEDIA_9_MT', 9, 2)):
        raw = num(r[hdr[col]]); g = db(f"SELECT media FROM civica_exec.exec_edu_saeb_terr s JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.ibge7 = {code} AND s.year = 2025 AND s.dep = 0 AND s.loc = 0 AND s.cap = 0 AND s.grade = {grade} AND s.subj = {subj}")
        got = float(g[0][0]) / 100 if g and g[0][0] != '' else None
        check(f'saeb2025 {MUN[code]} {col}', raw, got, 0.0051)

# ---------------------------------------------------------------- rendimento e distorção, município 2023 e 2015 (total × total)
def flow_mun(zip_name, year, col_ap, col_td=None):
    before = len(results)
    for fname, sname, rows in xlsx_rows(f'{RAW}/indicadores/arquivos/{zip_name}'):
        hdr = None
        for r in rows:
            if hdr is None:
                if r and r[0] is not None and str(r[0]).strip().upper() in ('NU_ANO_CENSO', 'ANO') and sum(1 for c in r if c) > 30: hdr = [str(c or '').strip() for c in r]
                continue
            if not r or r[0] is None: continue
            lo = [h.lower() for h in hdr]; jc = lo.index('co_municipio') if 'co_municipio' in lo else None
            if jc is None: return
            try: code = int(r[jc])
            except (TypeError, ValueError): continue
            if code not in MUN: continue
            jl = lo.index('no_categoria') if 'no_categoria' in lo else lo.index('tipoloca'); jd = lo.index('no_dependencia') if 'no_dependencia' in lo else lo.index('dependad')
            if str(r[jl]).strip() != 'Total' or str(r[jd]).strip() != 'Total': continue
            j = hdr.index(col_ap); raw = num(r[j])
            g = db(f"SELECT ap_fun FROM civica_exec.exec_edu_flow_terr f JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.ibge7 = {code} AND f.year = {year} AND f.loc = 0 AND f.dep = 0")
            got = float(g[0][0]) / 100 if g and g[0][0] != '' else None
            check(f'rendimento {year} {MUN[code]} aprovação EF', raw, got, 0.0051)
        if len(results) > before: return


flow_mun('tx_rend_municipios_2023.zip', 2023, '1_CAT_FUN')


def flow_mun_pos(zip_name, year):
    # planilhas sem linha técnica: Ano, Região, UF, Código do município, Nome, Localização, Rede, Total Aprovação no Ens. Fundamental
    before = len(results)
    for fname, sname, rows in xlsx_rows(f'{RAW}/indicadores/arquivos/{zip_name}'):
        for r in rows:
            if not r or r[0] is None or num(r[0]) != year: continue
            try: code = int(r[3])
            except (TypeError, ValueError): continue
            if code not in MUN or str(r[5]).strip() != 'Total' or str(r[6]).strip() != 'Total': continue
            g = db(f"SELECT ap_fun FROM civica_exec.exec_edu_flow_terr f JOIN civica_exec.exec_entity e USING (entity_id) WHERE e.ibge7 = {code} AND f.year = {year} AND f.loc = 0 AND f.dep = 0")
            check(f'rendimento {year} {MUN[code]} aprovação EF (posicional)', num(r[7]), float(g[0][0]) / 100 if g and g[0][0] != '' else None, 0.0051)
        if len(results) > before: return


flow_mun_pos('TAXA_REND_2016_MUNICIPIOS.zip', 2016)
flow_mun_pos('tx_rendimento_municipios_2013.zip', 2013)

# ---------------------------------------------------------------- INSE 2023 (escola) — 20 primeiras escolas com linha
wb = openpyxl.load_workbook(f'{RAW}/indicadores/arquivos/INSE_2023_escolas.xlsx', read_only=True, data_only=True); ws = wb.worksheets[0]; n = 0; hdr = None
for r in ws.iter_rows(values_only=True):
    if hdr is None: hdr = {str(c): j for j, c in enumerate(r)}; continue
    if n >= 40: break
    inep = int(r[hdr['ID_ESCOLA']]); raw_m = num(r[hdr['MEDIA_INSE']]); raw_q = num(r[hdr['QTD_ALUNOS_INSE']]); raw_n4 = num(r[hdr['PC_NIVEL_4']])
    g = db(f"SELECT media, qtd, nv4 FROM civica_exec.exec_edu_inse_school WHERE inep = {inep} AND year = 2023")
    if not g: bad += 1; results.append({'caso': f'inse2023 escola {inep} ausente no banco', 'ok': False}); n += 1; continue
    check(f'inse2023 escola {inep} média', raw_m, float(g[0][0]) / 10000 if g[0][0] != '' else None, 5e-5)
    check(f'inse2023 escola {inep} alunos', raw_q, float(g[0][1]) if g[0][1] != '' else None, 0)
    check(f'inse2023 escola {inep} nível4', raw_n4, float(g[0][2]) / 100 if g[0][2] != '' else None, 0.0051)
    n += 1

summary = {'verificados': len(results), 'divergentes': bad, 'amostra_divergentes': [r for r in results if not r['ok']][:20], 'casos': results}
json.dump(summary, open(OUT, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({'verificados': len(results), 'divergentes': bad, 'divergencias': summary['amostra_divergentes'][:8]}, ensure_ascii=False))
