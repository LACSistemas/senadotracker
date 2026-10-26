"""P10.2/G6 — reconcilia matrículas e turmas PUBLICADAS no PostgreSQL com a Sinopse Estatística (tabelas 1.1, 1.2, 4.1, 4.2) do mesmo ano: Brasil, 27 UFs e todos os municípios.
Entradas: CSV exportado do banco (agregado por edição × município × dependência × localização) e os JSON das tabelas da Sinopse (sinopse_tabela.py).
Uso: python -I -X utf8 reconcilia_oferta.py <recon_db.csv> <pasta_sinopse_json> <saida.json> [ano ...]"""
import collections, csv, json, os, sys

UF_NAME = {11: 'Rondônia', 12: 'Acre', 13: 'Amazonas', 14: 'Roraima', 15: 'Pará', 16: 'Amapá', 17: 'Tocantins', 21: 'Maranhão', 22: 'Piauí', 23: 'Ceará', 24: 'Rio Grande do Norte', 25: 'Paraíba', 26: 'Pernambuco', 27: 'Alagoas', 28: 'Sergipe', 29: 'Bahia',
           31: 'Minas Gerais', 32: 'Espírito Santo', 33: 'Rio de Janeiro', 35: 'São Paulo', 41: 'Paraná', 42: 'Santa Catarina', 43: 'Rio Grande do Sul', 50: 'Mato Grosso do Sul', 51: 'Mato Grosso', 52: 'Goiás', 53: 'Distrito Federal'}
# letra da coluna da Sinopse → medida do banco (soma de colunas). Layout A = 2007–2024; layout B = 2025 (tabelas ampliadas pelos itinerários técnicos).
MAT_A = {'E': ['mat_bas'], 'F': ['mat_inf_cre', 'mat_inf_pre'], 'G': ['mat_inf_cre'], 'H': ['mat_inf_pre'], 'I': ['mat_fund_ai', 'mat_fund_af'], 'J': ['mat_fund_ai'], 'K': ['mat_fund_af'], 'L': ['mat_med'], 'P': ['mat_prof'],
         'X': ['mat_eja_fund', 'mat_eja_med'], 'Y': ['mat_eja_fund'], 'Z': ['mat_eja_med'], 'AA': ['mat_esp_cc', 'mat_esp_ce'], 'AB': ['mat_esp_cc'], 'AC': ['mat_esp_ce']}
MAT_B = {**{k: v for k, v in MAT_A.items() if k in 'EFGHIJKL'}, 'U': ['mat_prof'], 'AH': ['mat_eja_fund', 'mat_eja_med'], 'AI': ['mat_eja_fund'], 'AJ': ['mat_eja_med'], 'AK': ['mat_esp_cc', 'mat_esp_ce'], 'AL': ['mat_esp_cc'], 'AM': ['mat_esp_ce']}
TUR_A = {'E': ['tur_bas'], 'F': ['tur_inf_cre', 'tur_inf_pre'], 'G': ['tur_inf_cre'], 'H': ['tur_inf_pre'], 'I': ['tur_fund_ai', 'tur_fund_af'], 'J': ['tur_fund_ai'], 'K': ['tur_fund_af'], 'L': ['tur_med'], 'P': ['tur_prof'],
         'Y': ['tur_eja'], 'Z': ['tur_eja_fund'], 'AA': ['tur_eja_med'], 'AB': ['tur_esp_cc', 'tur_esp_ce'], 'AC': ['tur_esp_cc'], 'AD': ['tur_esp_ce']}
TUR_B = {**{k: v for k, v in TUR_A.items() if k in 'EFGHIJKL'}, 'R': ['tur_prof'], 'AF': ['tur_eja'], 'AG': ['tur_eja_fund'], 'AH': ['tur_eja_med'], 'AI': ['tur_esp_cc', 'tur_esp_ce'], 'AJ': ['tur_esp_cc'], 'AK': ['tur_esp_ce']}
LD = {'E': (0, 0), 'F': (1, 0), 'G': (1, 1), 'H': (1, 2), 'I': (1, 3), 'J': (1, 4), 'K': (2, 0), 'L': (2, 1), 'M': (2, 2), 'N': (2, 3), 'O': (2, 4)}   # (localização, dependência); 0 = total
LD_B = {'E': (0, 0), 'O': (1, 0), 'Q': (1, 1), 'R': (1, 2), 'S': (1, 3), 'T': (1, 4), 'Y': (2, 0), 'AA': (2, 1), 'AB': (2, 2), 'AC': (2, 3), 'AD': (2, 4)}   # 2025: tabelas ampliadas com a categoria da escola privada
MEAS = ['mat_bas', 'mat_inf_cre', 'mat_inf_pre', 'mat_fund_ai', 'mat_fund_af', 'mat_med', 'mat_eja_fund', 'mat_eja_med', 'mat_prof', 'mat_esp_cc', 'mat_esp_ce', 'tur_bas', 'tur_inf_cre', 'tur_inf_pre', 'tur_fund_ai', 'tur_fund_af', 'tur_med', 'tur_eja', 'tur_eja_fund', 'tur_eja_med', 'tur_prof', 'tur_esp_cc', 'tur_esp_ce']


def main():
    db_csv, sin, out = sys.argv[1], sys.argv[2], sys.argv[3]; years = [int(a) for a in sys.argv[4:]]
    muni = collections.defaultdict(lambda: collections.defaultdict(lambda: collections.defaultdict(collections.Counter)))   # year → ibge7 → (loc,dep) → medida
    with open(db_csv, encoding='utf-8', newline='') as f:
        for r in csv.DictReader(f):
            y = int(r['year']); key = (int(r['loc']), int(r['dep']))
            c = muni[y][r['ibge7']][key]
            for m in MEAS: c[m] += int(r[m] or 0)
            c['schools'] += int(r['schools'])
    res = {}
    for y in years:
        if y not in muni: continue
        R = {'tabelas': {}}
        def tab(t):
            p = os.path.join(sin, f'{t}_{y}.json')
            return json.load(open(p, encoding='utf-8')) if os.path.exists(p) else None
        def mine_total(code, ms):   # soma do município inteiro
            return sum(sum(c[m] for m in ms) for c in muni[y].get(code, {}).values())
        for t, mapA, mapB in (('t11', MAT_A, MAT_B), ('t41', TUR_A, TUR_B)):
            s = tab(t)
            if not s: R['tabelas'][t] = 'ausente'; continue
            mp = MAT_B if (len(s['columns']) > 30) else mapA
            if t == 't41': mp = TUR_B if len(s['columns']) > 30 else TUR_A
            bad = []; cells = 0; uf_bad = []; ufm = collections.defaultdict(lambda: collections.Counter())
            for code, vals in s['municipios'].items():
                for col, ms in mp.items():
                    sv = vals.get(col) or 0; mv = mine_total(code, ms); cells += 1
                    if sv != mv: bad.append({'municipio': code, 'col': col, 'medida': '+'.join(ms), 'sinopse': sv, 'banco': mv})
            for code in muni[y]:
                for col, ms in mp.items(): ufm[code[:2]][col] += mine_total(code, ms)
            for uf, name in UF_NAME.items():
                row = s['ufs'].get(name)
                for col in mp:
                    sv = (row or {}).get(col) or 0
                    if sv != ufm[str(uf)][col]: uf_bad.append({'uf': name, 'col': col, 'sinopse': sv, 'banco': ufm[str(uf)][col]})
            br = {col: sum(ufm[u][col] for u in ufm) for col in mp}; br_bad = {col: {'sinopse': s['brasil'].get(col) or 0, 'banco': v} for col, v in br.items() if (s['brasil'].get(col) or 0) != v}
            only_sin = sorted(c for c, v in s['municipios'].items() if (v.get('E') or 0) and c not in muni[y]); only_db = sorted(c for c in muni[y] if c not in s['municipios'])
            R['tabelas'][t] = {'layout': 'B' if len(s['columns']) > 30 else 'A', 'colunas_comparadas': len(mp), 'celulas_municipio': cells, 'divergentes_municipio': len(bad), 'ufs_divergentes': len(uf_bad), 'brasil_divergente': br_bad,
                               'brasil_sinopse': s['brasil'].get('E'), 'brasil_banco': br.get('E'), 'municipios_so_sinopse_com_dado': only_sin, 'municipios_so_banco': only_db, 'exemplos': bad[:15], 'notas': s['notas'][:3] if 'notas' in s else s['notes'][:3]}
        for t, mpt in (('t12', 'mat_bas'), ('t42', 'tur_bas')):
            s = tab(t)
            if not s: R['tabelas'][t] = 'ausente'; continue
            cols = set(s['columns']); lay = LD if len(cols) <= 12 else LD_B if len(cols) == 30 else None
            if lay is None: R['tabelas'][t] = {'layout': 'não mapeado', 'colunas': len(cols)}; continue
            bad = []; cells = 0
            for code, vals in s['municipios'].items():
                g = muni[y].get(code, {})
                for col, (loc, dep) in lay.items():
                    mv = sum(c[mpt] for (l, d), c in g.items() if (loc == 0 or l == loc) and (dep == 0 or d == dep)); sv = vals.get(col) or 0; cells += 1
                    if sv != mv: bad.append({'municipio': code, 'col': col, 'loc': loc, 'dep': dep, 'sinopse': sv, 'banco': mv})
            R['tabelas'][t] = {'layout': 'A' if lay is LD else 'B', 'celulas_municipio': cells, 'divergentes_municipio': len(bad), 'brasil_sinopse': s['brasil'].get('E'), 'exemplos': bad[:15]}
        res[y] = R
        print(y, {t: (v if isinstance(v, str) else (v.get('divergentes_municipio'), v.get('ufs_divergentes'), v.get('brasil_sinopse'))) for t, v in R['tabelas'].items()}, flush=True)
    json.dump(res, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


main()
