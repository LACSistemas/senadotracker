"""P10.7 / G1 — inventário somente leitura do RAW do PNCP (D:\Civica\raw\pncp\contratos): integridade, cobertura por ano, tipos de registro e campos.
Uso: python -I -X utf8 pncp_raw_inventory.py <saida.json>"""
import gzip, json, os, sys, collections
ROOT = 'D:/Civica/raw/pncp/contratos'
out = sys.argv[1]
res = {'arquivos': [], 'por_ano': {}, 'tipoContrato': collections.Counter(), 'categoriaProcesso': collections.Counter(), 'esfera': collections.Counter(), 'poder': collections.Counter(), 'campos_nao_nulos': collections.Counter()}
seen = set(); dup = 0; total = 0; err_pages = 0
FIELDS = ['numeroControlePncpCompra', 'numeroControlePncpAta', 'niFornecedor', 'objetoContrato', 'valorInicial', 'valorGlobal', 'valorAcumulado', 'valorParcela', 'dataAssinatura', 'dataVigenciaInicio', 'dataVigenciaFim', 'numeroRetificacao', 'numeroContratoEmpenho', 'processo', 'informacaoComplementar', 'identificadorCipi', 'tipoPessoaSubContratada', 'orgaoSubRogado', 'receita', 'emendaParlamentar']
for y in sorted(os.listdir(ROOT)):
    ay = collections.Counter()
    for f in sorted(os.listdir(f'{ROOT}/{y}')):
        p = f'{ROOT}/{y}/{f}'; pages = 0; n = 0; ep = 0
        with gzip.open(p, 'rt', encoding='utf8') as fh:
            for line in fh:
                if not line.strip(): continue
                pages += 1; x = json.loads(line)
                if x['s'] != 200: ep += 1; continue
                for c in json.loads(x['b']).get('data', []):
                    n += 1; k = c.get('numeroControlePNCP')
                    if k in seen: dup += 1
                    else: seen.add(k)
                    res['tipoContrato'][(c.get('tipoContrato') or {}).get('nome')] += 1
                    res['categoriaProcesso'][(c.get('categoriaProcesso') or {}).get('nome')] += 1
                    o = c.get('orgaoEntidade') or {}; res['esfera'][o.get('esferaId')] += 1; res['poder'][o.get('poderId')] += 1
                    for fl in FIELDS:
                        v = c.get(fl)
                        if v not in (None, '', False): res['campos_nao_nulos'][fl] += 1
        res['arquivos'].append({'ano': y, 'arquivo': f, 'bytes': os.path.getsize(p), 'paginas': pages, 'contratos': n, 'paginas_nao_200': ep}); ay['contratos'] += n; total += n; err_pages += ep
    res['por_ano'][y] = ay['contratos']
res['total_contratos'] = total; res['duplicados_numeroControlePNCP'] = dup; res['chaves_distintas'] = len(seen); res['paginas_nao_200'] = err_pages
for k in ('tipoContrato', 'categoriaProcesso', 'esfera', 'poder', 'campos_nao_nulos'): res[k] = dict(res[k].most_common())
json.dump(res, open(out, 'w', encoding='utf8'), ensure_ascii=False, indent=1)
print(json.dumps({'total': total, 'distintos': len(seen), 'dup': dup, 'err': err_pages, 'por_ano': res['por_ano']}))
