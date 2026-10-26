"""P10/G2,G3,G4 — LEITURA EM FLUXO (streaming) das tabelas de escola do Censo Escolar por HTTP Range, sem salvar o ZIP.
Extrai só colunas não pessoais por escola (código INEP, município, dependência, situação, localização, matrículas/turmas/docentes totais da educação básica) e grava um
arquivo compacto TSV em D:/Civica/staging/p10_probe/censo_escolas_<ano>.tsv (fora do repositório). Uso: python -I -X utf8 censo_escola_stream.py <ano> [<ano> ...]
Justificativa de custo: 2021–2024 = ZIPs de ~26–34 MB; 2025 = apenas as entradas Tabela_Escola (141 MB) e Tabela_Matricula (123 MB) do ZIP de 537 MB (entradas STORED → Range exato)."""
import csv, io, json, os, sys, time, zipfile
sys.path.insert(0, os.path.dirname(__file__))
from zip_remote_listing import RangeFile
B = 'https://download.inep.gov.br/dados_abertos'
OUT = 'D:/Civica/staging/p10_probe'
SRC = {
    2021: (f'{B}/microdados_censo_escolar_2021.zip', 'microdados_ed_basica_2021.csv'),
    2022: (f'{B}/microdados_censo_escolar_2022.zip', 'microdados_ed_basica_2022.csv'),
    2023: (f'{B}/microdados_censo_escolar_2023.zip', 'microdados_ed_basica_2023.csv'),
    2024: (f'{B}/microdados_censo_escolar_2024.zip', 'microdados_ed_basica_2024.csv'),
    2025: (f'{B}/microdados_censo_escolar_2025_.zip', 'Tabela_Escola_2025_V2.csv'),
}
KEEP = ['CO_ENTIDADE', 'CO_MUNICIPIO', 'SG_UF', 'TP_DEPENDENCIA', 'TP_SITUACAO_FUNCIONAMENTO', 'TP_LOCALIZACAO', 'IN_INTERNET', 'IN_BIBLIOTECA', 'IN_LABORATORIO_INFORMATICA', 'IN_QUADRA_ESPORTES', 'IN_ENERGIA_REDE_PUBLICA', 'IN_AGUA_REDE_PUBLICA', 'IN_ESGOTO_REDE_PUBLICA', 'QT_MAT_BAS', 'QT_TUR_BAS', 'QT_DOC_BAS', 'QT_MAT_INF', 'QT_MAT_FUND', 'QT_MAT_MED', 'IN_INF', 'IN_FUND', 'IN_MED', 'IN_PROF', 'IN_EJA', 'IN_ESP']

def stream(year, entry_name, only_cols=None, tag=''):
    url, name = SRC[year] if only_cols is None else (SRC[year][0], entry_name)
    rf = RangeFile(url); br = io.BufferedReader(rf, buffer_size=4 << 20)
    with zipfile.ZipFile(br) as z:
        info = next(i for i in z.infolist() if i.filename.endswith(name))
        with z.open(info) as fh:
            rd = csv.reader(io.TextIOWrapper(fh, encoding='latin-1', newline=''), delimiter=';')
            hdr = next(rd); ix = {h: i for i, h in enumerate(hdr)}
            cols = [c for c in (only_cols or KEEP) if c in ix]
            out_path = f'{OUT}/censo_escolas_{year}{tag}.tsv'; n = 0
            with open(out_path, 'w', encoding='utf-8', newline='') as o:
                o.write('\t'.join(cols) + '\n')
                for r in rd:
                    o.write('\t'.join(r[ix[c]] for c in cols) + '\n'); n += 1
    return {'ano': year, 'entrada': name, 'linhas': n, 'colunas_extraidas': cols, 'colunas_do_arquivo': len(hdr), 'bytes_rede': rf.bytes, 'chamadas': rf.calls, 'saida': out_path}

if __name__ == '__main__':
    log = []
    for y in map(int, sys.argv[1:]):
        t0 = time.time()
        r = stream(y, None); r['segundos'] = round(time.time() - t0, 1); log.append(r); print(json.dumps({k: v for k, v in r.items() if k != 'colunas_extraidas'}, ensure_ascii=False), flush=True)
        if y == 2025:   # matrículas 2025 vivem em outra tabela
            t0 = time.time(); r = stream(2025, 'Tabela_Matricula_2025_V2.csv', ['CO_ENTIDADE', 'QT_MAT_BAS', 'QT_MAT_INF', 'QT_MAT_INF_CRE', 'QT_MAT_INF_PRE', 'QT_MAT_FUND', 'QT_MAT_MED', 'QT_MAT_EJA', 'QT_MAT_ESP'], '_matricula'); r['segundos'] = round(time.time() - t0, 1); log.append(r); print(json.dumps({k: v for k, v in r.items() if k != 'colunas_extraidas'}, ensure_ascii=False), flush=True)
    json.dump(log, open(f'{OUT}/censo_escola_stream_log.json', 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
