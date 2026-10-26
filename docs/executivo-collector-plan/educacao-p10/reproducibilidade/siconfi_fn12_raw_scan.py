"""P10/G7 — varredura SOMENTE LEITURA do RAW do Siconfi (DCA I-E) para a função 12 (Educação).
Uso: python -I siconfi_fn12_raw_scan.py <saida.json>   (RAW em D:/Civica/raw/siconfi/dca/DCA_Anexo_I_E/<ano>/uf*.jsonl.gz)
Conta, por exercício: entes com resposta, entes com a função 12, linhas por subfunção e soma por estágio (Despesas Empenhadas/Liquidadas/Pagas)
para a função 12 (total) e para os entes municipais. Nada é gravado em banco."""
import glob, gzip, json, sys, collections
base = 'D:/Civica/raw/siconfi/dca/DCA_Anexo_I_E'
STAGE = {'Despesas Empenhadas': 'EMP', 'Despesas Liquidadas': 'LIQ', 'Despesas Pagas': 'PAG'}
out = {}
for year in range(2014, 2026):
    ents = set(); empty = 0; ents12 = set(); sub_rows = collections.Counter(); sub_ents = collections.defaultdict(set); tot = collections.Counter(); rows = 0
    cols = collections.Counter()
    for f in sorted(glob.glob(f'{base}/{year}/uf*.jsonl.gz')):
        with gzip.open(f, 'rt', encoding='utf-8') as fh:
            for line in fh:
                r = json.loads(line); b = json.loads(r['b']); items = b.get('items', [])
                ents.add(r['e'])
                if not items: empty += 1
                for it in items:
                    rows += 1
                    conta = str(it.get('conta', '')); code = conta.split(' - ')[0].strip()
                    if not (code == '12' or code.startswith('12.')): continue
                    col = str(it.get('coluna', '')); cols[col[:40]] += 1
                    sub_rows[code] += 1; sub_ents[code].add(r['e'])
                    if code == '12':
                        ents12.add(r['e'])
                        st = STAGE.get(col)
                        if st and it.get('valor') is not None: tot[st] += round(float(it['valor']) * 100)
    out[year] = {'entes_resposta': len(ents), 'entes_resposta_vazia': empty, 'linhas_total_anexo': rows,
                 'entes_com_funcao_12': len(ents12), 'linhas_por_conta': dict(sorted(sub_rows.items())),
                 'entes_por_conta': {k: len(v) for k, v in sorted(sub_ents.items())},
                 'soma_centavos_funcao_12': dict(tot), 'colunas_funcao_12': dict(cols)}
    print(year, out[year]['entes_com_funcao_12'], 'entes com fn12;', 'subfunções:', len(sub_rows), flush=True)
json.dump(out, open(sys.argv[1], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
