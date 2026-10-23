"""SIAPE (Portal da Transparência, cadastro mensal de servidores civis): contagem AGREGADA de vínculos por órgão de exercício (PF e PRF).
Uso: python -I scripts/exec/siape_extract.py <AAAAMM_Servidores_SIAPE.zip> <saida.json>

Privacidade: o cadastro tem NOME, CPF e MATRÍCULA. Este script lê SOMENTE as colunas ORG_EXERCICIO (código e nome), TIPO_VINCULO e o identificador
pseudonimizado do portal (apenas em memória, para contar servidores distintos); nada individual é gravado, impresso ou colocado em log.
A saída traz apenas contagens por órgão. Vínculo SIAPE ≠ policial em efetivo operacional: situação do vínculo, cargo e UF vêm "Sigiloso" para PF/PRF.
"""
import csv, io, json, re, sys, zipfile

VERSION = 'siape-agg-v1'
ORGS = {'20115': 'Departamento de Polícia Federal', '30802': 'Departamento de Polícia Rodoviária Federal'}
NEED = ['Id_SERVIDOR_PORTAL', 'COD_ORG_EXERCICIO', 'ORG_EXERCICIO', 'TIPO_VINCULO', 'SITUACAO_VINCULO', 'UF_EXERCICIO', 'DESCRICAO_CARGO']

def main(zpath, out):
    m = re.search(r'(\d{6})_Servidores_SIAPE', zpath.replace('\\', '/'))
    if not m: raise SystemExit('nome de arquivo inesperado (AAAAMM_Servidores_SIAPE.zip)')
    comp = int(m.group(1)); z = zipfile.ZipFile(zpath)
    name = f'{comp}_Cadastro.csv'
    if name not in z.namelist(): raise SystemExit(f'{name} ausente; arquivos: {z.namelist()}')
    rd = csv.reader(io.TextIOWrapper(z.open(name), encoding='latin-1', newline=''), delimiter=';')
    h = next(rd); ix = {c: i for i, c in enumerate(h)}
    miss = [c for c in NEED if c not in ix]
    if miss: raise SystemExit(f'colunas ausentes: {miss}')
    rows = 0; res = {k: {'rows': 0, 'ids': set(), 'by_tipo': {}, 'situacao': {}, 'uf_sigiloso': 0, 'cargo_sigiloso': 0, 'names': set()} for k in ORGS}
    for r in rd:
        if len(r) < len(h): continue
        rows += 1; k = r[ix['COD_ORG_EXERCICIO']]
        if k not in res: continue
        o = res[k]; o['rows'] += 1; o['ids'].add(r[ix['Id_SERVIDOR_PORTAL']]); o['names'].add(r[ix['ORG_EXERCICIO']])
        t = r[ix['TIPO_VINCULO']]; o['by_tipo'][t] = o['by_tipo'].get(t, 0) + 1
        s = r[ix['SITUACAO_VINCULO']]; o['situacao'][s] = o['situacao'].get(s, 0) + 1
        o['uf_sigiloso'] += r[ix['UF_EXERCICIO']] == 'Sigiloso'; o['cargo_sigiloso'] += r[ix['DESCRICAO_CARGO']] == 'Sigiloso'
    orgs = {}
    for k, o in res.items():
        orgs[k] = {'name': sorted(o['names'])[0] if o['names'] else None, 'rows': o['rows'], 'distinct': len(o['ids']), 'by_tipo': o['by_tipo'], 'situacao': o['situacao'], 'uf_sigiloso': o['uf_sigiloso'], 'cargo_sigiloso': o['cargo_sigiloso']}
    json.dump({'version': VERSION, 'competence': comp, 'file_rows': rows, 'columns_read': NEED, 'orgs': orgs}, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    print(json.dumps({'competence': comp, 'file_rows': rows, 'orgs': {k: (v['rows'], v['distinct']) for k, v in orgs.items()}}))

if __name__ == '__main__':
    if len(sys.argv) != 3: raise SystemExit(__doc__)
    main(*sys.argv[1:])
