"""P10/G3 — análise de identidade histórica das escolas (código INEP = CO_ENTIDADE) sobre os TSV compactos gerados por censo_escola_stream.py.
Uso: python -I -X utf8 censo_identidade_analise.py <saida.json> <ano> [<ano> ...]   (lê D:/Civica/staging/p10_probe/censo_escolas_<ano>.tsv)"""
import collections, csv, json, sys
D = 'D:/Civica/staging/p10_probe'
years = [int(a) for a in sys.argv[2:]]
data = {}; per_year = {}
for y in years:
    rows = {}; dup = 0; badlen = collections.Counter(); blank = 0; dep = collections.Counter(); sit = collections.Counter(); loc = collections.Counter(); munis = set()
    with open(f'{D}/censo_escolas_{y}.tsv', encoding='utf-8') as fh:
        for r in csv.DictReader(fh, delimiter='\t'):
            c = (r['CO_ENTIDADE'] or '').strip()
            if not c: blank += 1; continue
            if len(c) != 8 or not c.isdigit(): badlen[len(c)] += 1
            if c in rows: dup += 1
            rows[c] = (r['CO_MUNICIPIO'], r['TP_DEPENDENCIA'], r['TP_SITUACAO_FUNCIONAMENTO'], r['TP_LOCALIZACAO'])
            dep[r['TP_DEPENDENCIA']] += 1; sit[r['TP_SITUACAO_FUNCIONAMENTO']] += 1; loc[r['TP_LOCALIZACAO']] += 1; munis.add(r['CO_MUNICIPIO'])
    data[y] = rows
    per_year[y] = {'linhas_unicas': len(rows), 'duplicados_no_arquivo': dup, 'codigo_vazio': blank, 'codigo_fora_do_padrao_8_digitos': dict(badlen),
                   'por_dependencia': dict(sorted(dep.items())), 'por_situacao_funcionamento': dict(sorted(sit.items())), 'por_localizacao': dict(sorted(loc.items())), 'municipios_distintos': len(munis)}
trans = {}
for a, b in zip(years, years[1:]):
    A, B = data[a], data[b]; both = A.keys() & B.keys(); gone = A.keys() - B.keys(); new = B.keys() - A.keys()
    mun = sum(1 for c in both if A[c][0] != B[c][0]); dep = sum(1 for c in both if A[c][1] != B[c][1]); loc = sum(1 for c in both if A[c][3] != B[c][3])
    sit = collections.Counter(f'{A[c][2]}->{B[c][2]}' for c in both if A[c][2] != B[c][2])
    gone_sit = collections.Counter(A[c][2] for c in gone)
    trans[f'{a}->{b}'] = {'em_ambos': len(both), 'so_no_ano_anterior': len(gone), 'novos': len(new), 'mudou_municipio': mun, 'mudou_dependencia': dep, 'mudou_localizacao': loc,
                          'mudancas_de_situacao_top': dict(sit.most_common(8)), 'situacao_no_ano_anterior_das_ausentes': dict(sorted(gone_sit.items()))}
# ausência intermitente: presente em t-1 e t+1 mas ausente em t
gaps = {}
for i in range(1, len(years) - 1):
    p, t, n = years[i - 1], years[i], years[i + 1]
    g = [c for c in data[p].keys() & data[n].keys() if c not in data[t]]
    gaps[str(t)] = {'ausentes_so_neste_ano_e_presentes_antes_e_depois': len(g), 'amostra_codigos': g[:5]}
# presença em todos os anos
allk = set.intersection(*[set(d) for d in data.values()]) if data else set(); union = set.union(*[set(d) for d in data.values()]) if data else set()
res = {'anos': years, 'por_ano': per_year, 'transicoes': trans, 'ausencia_intermitente': gaps, 'presentes_em_todos_os_anos': len(allk), 'codigos_distintos_em_algum_ano': len(union)}
json.dump(res, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print(json.dumps({'por_ano': {y: (v['linhas_unicas'], v['duplicados_no_arquivo'], v['codigo_fora_do_padrao_8_digitos']) for y, v in per_year.items()}, 'em_todos': len(allk), 'uniao': len(union)}, ensure_ascii=False))
for k, v in trans.items(): print(k, {kk: vv for kk, vv in v.items() if kk in ('em_ambos', 'so_no_ano_anterior', 'novos', 'mudou_municipio', 'mudou_dependencia')})
print({k: v['ausentes_so_neste_ano_e_presentes_antes_e_depois'] for k, v in gaps.items()})
