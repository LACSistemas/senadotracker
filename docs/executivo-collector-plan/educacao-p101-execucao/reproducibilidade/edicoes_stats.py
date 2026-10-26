"""P10.1/G5 — estatísticas por edição a partir dos TSV de staging gerados por scripts/exec/censo_escola_extract.py (somente leitura).
Uso: python -I -X utf8 edicoes_stats.py <pasta_staging> <saida.json> [ano ...]
Por edição: linhas, códigos distintos/duplicados, comprimento do código, distribuição de dependência, localização, situação, matrícula vazia/zero/positiva, nomes vazios,
combinações situação × matrícula, UF/município distintos."""
import collections, csv, json, os, sys

root, out = sys.argv[1], sys.argv[2]
years = [int(a) for a in sys.argv[3:]] or list(range(2007, 2026))
res = {}
for y in years:
    p = os.path.join(root, f'censo_{y}.tsv')
    if not os.path.exists(p): continue
    ids = collections.Counter(); dep = collections.Counter(); loc = collections.Counter(); sit = collections.Counter(); matk = collections.Counter(); lens = collections.Counter()
    combo = collections.Counter(); ufs = set(); muns = set(); empty_name = 0; n = 0; ufbad = 0
    with open(p, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            n += 1; ids[r['inep']] += 1; dep[r['dep']] += 1; loc[r['loc']] += 1; sit[r['sit']] += 1; lens[len(r['inep'])] += 1
            m = r['mat']; k = 'vazio' if m == '' else ('zero' if m == '0' else ('pos' if m.isdigit() else 'outro')); matk[k] += 1; combo[(r['sit'], k)] += 1
            ufs.add(r['uf']); muns.add(r['ibge7']); empty_name += (r['name'] == '')
            ufbad += (not r['ibge7'].startswith(r['uf']))
    dups = sum(1 for v in ids.values() if v > 1)
    res[y] = {'linhas': n, 'codigos_distintos': len(ids), 'codigos_duplicados': dups, 'comprimento_codigo': dict(lens), 'dependencia': dict(dep), 'localizacao': dict(loc), 'situacao': dict(sit), 'matricula': dict(matk),
              'situacao_x_matricula': {f'{a}|{b}': v for (a, b), v in sorted(combo.items())}, 'ufs': len(ufs), 'municipios': len(muns), 'nomes_vazios': empty_name, 'uf_incompativel_com_municipio': ufbad,
              'recorte_ativa_com_matricula': combo[('1', 'pos')]}
    print(y, n, len(ids), dups, dict(sit), res[y]['recorte_ativa_com_matricula'], flush=True)
json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
