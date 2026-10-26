"""P10/G2 — lê o cabeçalho e as primeiras linhas de cada tabela do Censo Escolar por HTTP Range (sem baixar o ZIP).
Uso: python -I -X utf8 censo_headers_probe.py <saida.json>"""
import json, sys, os
sys.path.insert(0, os.path.dirname(__file__))
from zip_remote_listing import read_entry
B = 'https://download.inep.gov.br/dados_abertos'
jobs = [
    (f'{B}/microdados_censo_escolar_2025_.zip', 'microdados_censo_escolar_2025_v2/dados/' + t)
    for t in ('Tabela_Escola_2025_V2.csv', 'Tabela_Turma_2025_V2.csv', 'Tabela_Matricula_2025_V2.csv', 'Tabela_Docente_2025_V2.csv', 'Tabela_Gestor_Escolar_2025_v2.csv', 'Tabela_Curso_Tecnico_2025_V2.csv')
] + [
    (f'{B}/microdados_censo_escolar_2024.zip', 'microdados_censo_escolar_2024_defeso/dados/microdados_ed_basica_2024.csv'),
    (f'{B}/microdados_censo_escolar_2023.zip', 'microdados_censo_escolar_2023/dados/microdados_ed_basica_2023.csv'),
    (f'{B}/microdados_censo_escolar_2022.zip', 'Microdados do Censo Escolar da Educação Básica 2022/dados/microdados_ed_basica_2022.csv'),
]
out = []
for url, name in jobs:
    try:
        # o cabeçalho de 2024 tem ~400 colunas: 12 KB bastam
        r = read_entry(url, name, 14000)
        head, _, rest = r['texto'].partition('\n')
        sep = ';' if head.count(';') >= head.count(',') else ','
        cols = head.strip().split(sep)
        out.append({'zip': url.split('/')[-1], 'entrada': name.split('/')[-1], 'separador': sep, 'colunas_no_trecho': len(cols),
                    'cabecalho': cols, 'primeira_linha': rest.split('\n')[0][:600], 'bytes_da_rede': r['bytes_lidos_da_rede']})
        print(name.split('/')[-1], len(cols), 'colunas;', r['bytes_lidos_da_rede'], 'bytes de rede', flush=True)
    except Exception as e:
        out.append({'zip': url.split('/')[-1], 'entrada': name, 'erro': repr(e)[:300]}); print('ERRO', name, repr(e)[:200])
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
