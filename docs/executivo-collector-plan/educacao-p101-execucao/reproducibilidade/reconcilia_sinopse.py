"""P10.1/G3,G10 — reconcilia, por edição, o recorte operacional do cadastro (situação = em atividade E matrícula básica > 0) com a tabela de estabelecimentos da Sinopse Estatística
(Brasil, UF e município × localização × dependência). Somente leitura. Entradas: TSV de staging (censo_escola_extract.py) e estab_<ano>.json (sinopse_estab.py).
Uso: python -I -X utf8 reconcilia_sinopse.py <staging_educacao> <pasta_sinopse_json> <saida.json> [ano ...]"""
import collections, csv, json, os, sys

UF_NAME = {11: 'Rondônia', 12: 'Acre', 13: 'Amazonas', 14: 'Roraima', 15: 'Pará', 16: 'Amapá', 17: 'Tocantins', 21: 'Maranhão', 22: 'Piauí', 23: 'Ceará', 24: 'Rio Grande do Norte', 25: 'Paraíba', 26: 'Pernambuco', 27: 'Alagoas', 28: 'Sergipe', 29: 'Bahia',
           31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 41: 'Paraná', 42: 'Santa Catarina', 43: 'Rio Grande do Sul', 50: 'Mato Grosso do Sul', 51: 'Mato Grosso', 52: 'Goiás', 53: 'Distrito Federal'}
# colunas (letra da planilha) → (localização, dependência); dependência 0 = total
LAYOUT_A = {'E': (0, 0), 'F': (1, 0), 'G': (1, 1), 'H': (1, 2), 'I': (1, 3), 'J': (1, 4), 'K': (2, 0), 'L': (2, 1), 'M': (2, 2), 'N': (2, 3), 'O': (2, 4)}
LAYOUT_B = {'E': (0, 0), 'O': (1, 0), 'Q': (1, 1), 'R': (1, 2), 'S': (1, 3), 'T': (1, 4), 'Y': (2, 0), 'AA': (2, 1), 'AB': (2, 2), 'AC': (2, 3), 'AD': (2, 4)}


def mine(path):
    muni = collections.defaultdict(lambda: collections.Counter())
    with open(path, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f, delimiter='\t'):
            if r['sit'] != '1' or not r['mat'].isdigit() or int(r['mat']) <= 0: continue
            loc = int(r['loc']) if r['loc'] in ('1', '2') else 9; dep = int(r['dep']) if r['dep'].isdigit() else 9
            c = muni[r['ibge7']]; c[(0, 0)] += 1; c[(loc, 0)] += 1; c[(0, dep)] += 1; c[(loc, dep)] += 1
    return muni


def main():
    stg, sin, out = sys.argv[1], sys.argv[2], sys.argv[3]; years = [int(a) for a in sys.argv[4:]]
    res = {}
    for y in years:
        pj = os.path.join(sin, f'estab_{y}.json'); pt = os.path.join(stg, f'censo_{y}.tsv')
        if not (os.path.exists(pj) and os.path.exists(pt)): continue
        s = json.load(open(pj, encoding='utf-8')); lay = LAYOUT_B if 'AH' in s['columns'] else LAYOUT_A
        m = mine(pt); div = []; tot_mine = tot_sin = 0; cells = 0; bad_cells = 0
        ufs_m = collections.defaultdict(collections.Counter); ufs_s = collections.defaultdict(collections.Counter)
        for code, vals in s['municipios'].items():
            cm = m.get(code, collections.Counter())
            for col, key in lay.items():
                sv = vals.get(col) or 0; mv = cm.get(key, 0); cells += 1
                # a coluna "dependência 0" de uma localização só existe quando o layout a traz; as demais comparam direto
                if sv != mv: bad_cells += 1; div.append({'municipio': code, 'celula': f'loc{key[0]}_dep{key[1]}', 'sinopse': sv, 'cadastro': mv})
            for key in ((0, 0), (0, 1), (0, 2), (0, 3), (0, 4)): ufs_s[code[:2]][key] += (vals.get(next(c for c, k in lay.items() if k == key), 0) or 0) if key in lay.values() else 0
        # dependência total (0,dep) não existe como coluna: soma urbana+rural
        dep_tot_mine = collections.Counter(); dep_tot_sin = collections.Counter()
        for code, cm in m.items():
            for d in (1, 2, 3, 4): dep_tot_mine[d] += cm.get((0, d), 0)
        for code, vals in s['municipios'].items():
            for d in (1, 2, 3, 4):
                dep_tot_sin[d] += (vals.get(next(c for c, k in lay.items() if k == (1, d))) or 0) + (vals.get(next(c for c, k in lay.items() if k == (2, d))) or 0)
        mun_only_mine = sorted(set(m) - set(s['municipios'])); mun_only_sin = sorted(c for c, v in s['municipios'].items() if (v.get('E') or 0) and c not in m)
        total_mine = sum(c.get((0, 0), 0) for c in m.values()); total_sin_mun = sum((v.get('E') or 0) for v in s['municipios'].values())
        # UF: soma dos municípios do cadastro × linha da UF da Sinopse
        uf_div = []
        for code, name in UF_NAME.items():
            sv = (s['ufs'].get(name) or {}).get('E'); mv = sum(c.get((0, 0), 0) for k, c in m.items() if k.startswith(str(code)))
            if sv is None: uf_div.append({'uf': name, 'sinopse': None, 'cadastro': mv}); continue
            if sv != mv: uf_div.append({'uf': name, 'sinopse': sv, 'cadastro': mv})
        res[y] = {'brasil_sinopse': s['brasil']['E'], 'brasil_cadastro_recorte': total_mine, 'soma_municipios_sinopse': total_sin_mun, 'diferenca_brasil': total_mine - s['brasil']['E'],
                  'dependencia': {str(d): {'sinopse': dep_tot_sin[d], 'cadastro': dep_tot_mine[d]} for d in (1, 2, 3, 4)}, 'ufs_comparadas': len(UF_NAME), 'ufs_divergentes': uf_div,
                  'municipios_sinopse': len(s['municipios']), 'municipios_so_no_cadastro': mun_only_mine, 'municipios_so_na_sinopse_com_escola': mun_only_sin, 'celulas_comparadas': cells, 'celulas_divergentes': bad_cells,
                  'exemplos_divergencia': div[:25], 'notas_sinopse': s['notes'][:3], 'aba': s['sheet']}
        print(y, 'Brasil sinopse', s['brasil']['E'], 'cadastro', total_mine, '| UFs divergentes', len(uf_div), '| células divergentes', bad_cells, 'de', cells, flush=True)
    json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


main()
