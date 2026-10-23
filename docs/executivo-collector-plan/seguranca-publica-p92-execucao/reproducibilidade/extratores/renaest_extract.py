# -*- coding: utf-8 -*-
"""Extrator RENAEST (ZIP cumulativo com Acidentes, Vitimas, Localidade, TipoVeiculo) → JSON AGREGADO. Leitura em fluxo, sem DataFrame.
NÃO grava: número do acidente, endereço, CEP, bairro, coordenadas, km, hora, data exata, nem qualquer linha individual. Só somas por (UF, município IBGE, mês) e por (UF, mês, categoria).
Uso: python renaest_extract.py <renaest.zip> <saida.json>

Unidades (validadas em 21/10/2026 no pacote de 05-2026): 1 linha de Acidentes = 1 sinistro (num_acidente único; qtde_acidente = 1);
Vitimas e TipoVeiculo se ligam ao sinistro por num_acidente; chv_localidade = UF + código IBGE (7) + AAAA + MM."""
import sys, io, csv, json, zipfile, collections, time
from array import array

def open_csv(z, prefix):
    name = [n for n in z.namelist() if n.startswith(prefix)][0]
    rd = csv.reader(io.TextIOWrapper(z.open(name), encoding='latin-1', newline=''), delimiter=';')
    h = next(rd); return name, {c: i for i, c in enumerate(h)}, rd

def toi(v):
    return int(v) if v and v.lstrip('-').isdigit() else 0

def main(src, out):
    t0 = time.time(); z = zipfile.ZipFile(src); log = lambda m: print(f'[{time.time() - t0:6.0f}s] {m}', flush=True)
    name, ix, rd = open_csv(z, 'Acidentes')
    ids = array('q'); meta = array('i')       # meta = ufidx*1_000_000 + ym
    ufs = {}; muni = collections.defaultdict(lambda: [0, 0, 0, 0, 0])   # (uf, ibge, ym) → sinistros, fatais, obitos, envolvidos, feridosilesos
    tp = collections.defaultdict(int); cov = collections.defaultdict(lambda: [0, 0, set()]); bad = collections.Counter(); first_ym = None
    for r in rd:
        uf = r[ix['uf_acidente']]; ibge = r[ix['codigo_ibge']]; ym = toi(r[ix['ano_acidente']]) * 100 + toi(r[ix['mes_acidente']])
        if len(ibge) != 7 or not ibge.isdigit(): bad['ibge_invalido'] += 1
        if ym < 190001: bad['data_invalida'] += 1; continue
        n = toi(r[ix['qtde_acidente']]); f = toi(r[ix['qtde_acid_com_obitos']])
        a = muni[(uf, ibge, ym)]; a[0] += n; a[1] += f; a[2] += toi(r[ix['qtde_obitos']]); a[3] += toi(r[ix['qtde_envolvidos']]); a[4] += toi(r[ix['qtde_feridosilesos']])
        tp[(uf, ym, r[ix['tp_acidente']])] += n
        c = cov[(uf, ym)]; c[0] += n; c[1] += f; c[2].add(ibge)
        if n != 1: bad['qtde_acidente_diferente_de_1'] += 1
        ids.append(toi(r[ix['num_acidente']])); meta.append(ufs.setdefault(uf, len(ufs)) * 1_000_000 + ym)
    log(f'Acidentes: {len(ids)} linhas; {len(muni)} chaves município-mês')
    import numpy as np
    ida = np.frombuffer(ids, dtype=np.int64); mta = np.frombuffer(meta, dtype=np.int32); order = np.argsort(ida, kind='stable'); ida = ida[order]; mta = mta[order]
    uf_by_idx = {v: k for k, v in ufs.items()}
    if len(np.unique(ida)) != len(ida): bad['num_acidente_repetido'] += 1
    # Vítimas: ponderadas por qtde_envolvidos; município vem do chv_localidade
    name, ix, rd = open_csv(z, 'Vitimas'); grav = collections.defaultdict(int); env = collections.defaultdict(int); vobitos = collections.defaultdict(int); vrows = 0
    for r in rd:
        vrows += 1; uf = r[ix['uf_acidente']]; ym = toi(r[ix['ano_acidente']]) * 100 + toi(r[ix['mes_acidente']]); w = toi(r[ix['qtde_envolvidos']])
        grav[(uf, ym, r[ix['gravidade_lesao']])] += w; env[(uf, ym, r[ix['tp_envolvido']])] += w; vobitos[(uf, ym)] += toi(r[ix['qtde_obitos']])
    log(f'Vitimas: {vrows} linhas')
    # Veículos: ligação por num_acidente → (UF, mês)
    name, ix, rd = open_csv(z, 'TipoVeiculo'); veic = collections.defaultdict(int); vorph = 0; vtot = 0
    for r in rd:
        n = toi(r[ix['num_acidente']]); q = toi(r[ix['qtde_veiculos']]); vtot += q
        j = int(np.searchsorted(ida, n))
        if j >= len(ida) or ida[j] != n: vorph += 1; continue
        m = int(mta[j]); veic[(uf_by_idx[m // 1_000_000], m % 1_000_000, r[ix['tipo_veiculo']])] += q
    log(f'TipoVeiculo: veículos {vtot}; linhas órfãs {vorph}')
    # Localidade: universo de municípios × meses que a fonte considera (frota/habitantes são da própria fonte e NÃO são usados como denominador)
    name, ix, rd = open_csv(z, 'Localidade'); loc = collections.defaultdict(set); lrows = 0
    for r in rd:
        lrows += 1; loc[(r[ix['uf']], toi(r[ix['ano_referencia']]) * 100 + toi(r[ix['mes_referencia']]))].add(r[ix['codigo_ibge']])
    payload = dict(
        kind='renaest', source=src.replace('\\', '/').split('/')[-1], inner=[n for n in z.namelist()], bad=dict(bad), acidentes=len(ids), vitimas_linhas=vrows, veiculos_total=vtot, veiculos_orfaos=vorph, localidade_linhas=lrows,
        muni=[[k[0], k[1], k[2]] + v for k, v in muni.items()],
        tp_acidente=[[k[0], k[1], k[2], v] for k, v in tp.items()], gravidade=[[k[0], k[1], k[2], v] for k, v in grav.items()], envolvido=[[k[0], k[1], k[2], v] for k, v in env.items()],
        veiculo=[[k[0], k[1], k[2], v] for k, v in veic.items()], vitima_obitos=[[k[0], k[1], v] for k, v in vobitos.items()],
        cov=[[k[0], k[1], v[0], v[1], len(v[2])] for k, v in cov.items()], localidade=[[k[0], k[1], len(v)] for k, v in loc.items()])
    json.dump(payload, open(out, 'w', encoding='utf-8'), ensure_ascii=False)
    log('ok ' + json.dumps(dict(acidentes=len(ids), muni=len(muni))))

if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
