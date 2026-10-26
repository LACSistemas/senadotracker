"""P10.4 — extrai as planilhas oficiais do Ideb (INEP, divulgação 2025: todas as edições 2005–2025 em colunas) para um TSV LONGO compacto:
uma linha por (entidade × rede × etapa × edição) com pelo menos um valor publicado.
Uso: python -I -X utf8 ideb_extract.py <nivel> <saida.tsv> <zip> [<zip> ...]      nivel = escolas | municipios | ufs | brasil
 - Cada ZIP traz uma planilha xlsx. Brasil e Regiões/UFs têm uma aba por etapa (AI, AF, EM); escolas e municípios têm um arquivo por etapa (o nome do arquivo diz a etapa).
 - O cabeçalho técnico (VL_APROVACAO_2005_SI_4, VL_NOTA_MATEMATICA_2019, VL_OBSERVADO_2023, VL_PROJECAO_2021…) fica na linha em que a primeira célula é uma sigla (SG_UF, BRASIL…) ou vazia e as demais começam com VL_.
   Os rótulos da linha de cima (1º ao 5º ano, 1º, 2º…) fixam o significado das colunas de aprovação por série: o código vira a posição da série dentro da etapa.
 - "-" é ausente (não divulgado ou não se aplica), nunca zero. Nada é recalculado.
Saída: cabeçalho + linhas `row key1 key2 key3 rede stage year ap_tot ap_1 ap_2 ap_3 ap_4 ap_5 p nota_mt nota_lp nota_media ideb meta`; key depende do nível (escolas: uf, ibge7, inep; municípios: uf, ibge7, nome; ufs: nome da região/UF; brasil: Brasil).
Última linha de stdout: JSON {level, files, sheets, rows, cells, labels}."""
import hashlib, io, json, os, re, sys, zipfile
import openpyxl

MEAS = ['ap_tot', 'ap_1', 'ap_2', 'ap_3', 'ap_4', 'ap_5', 'p', 'nota_mt', 'nota_lp', 'nota_media', 'ideb', 'meta']
COLRX = re.compile(r'^VL_([A-Z_]+?)_(20\d\d)(?:_(.*))?$')
STAGE_OF = [('anos_iniciais', 1), ('(ai)', 1), ('anos iniciais', 1), ('anos_finais', 2), ('(af)', 2), ('anos finais', 2), ('ensino_medio', 3), ('(em)', 3), ('ensino médio', 3)]


def stage_of(*names):
    t = ' '.join(n.lower() for n in names)
    for k, v in STAGE_OF:
        if k in t: return v
    return None


def norm(v):
    if v is None: return ''
    if isinstance(v, float):
        return str(int(v)) if v == int(v) and abs(v) < 1e12 else repr(v)
    return str(v).strip()


def positions(codes, labels, stage):
    """Mapeia o sufixo de série do código de aprovação (SI_4, SI, 1…4) para a posição da série DENTRO da etapa, pelos rótulos da linha de cima:
    AI: "1º ao 5º ano", 1º…5º → tot, 1…5; AF: "6º a 9º ano", 6º…9º → tot, 1…4; EM: "Total", 1ª…4ª → tot, 1…4."""
    out = {}
    fy = first_year_of(codes)
    for j, c in codes.items():
        if c[0] != 'APROVACAO' or c[1] != fy or labels[j] is None: continue
        lab = str(labels[j]).strip(); suffix = c[2]
        if lab.lower() == 'total' or re.search(r'\s(ao|a)\s', lab): out[suffix] = 'tot'
        else:
            m = re.match(r'(\d+)', lab)
            if not m: out[suffix] = None; continue
            n = int(m.group(1)); out[suffix] = str(n - 5 if stage == 2 else n)
    return out


def first_year_of(codes):
    return min(c[1] for c in codes.values())


def main():
    level, out, zips = sys.argv[1], sys.argv[2], sys.argv[3:]
    summary = {'level': level, 'files': [os.path.basename(z) for z in zips], 'sheets': [], 'rows': 0, 'cells': {'numeric': 0, 'dash': 0}, 'labels': {}}
    n = 0
    with open(out + '.part', 'w', encoding='utf-8', newline='') as o:
        o.write('row\tk1\tk2\tk3\trede\tstage\tyear\t' + '\t'.join(MEAS) + '\n')
        for zp in zips:
            z = zipfile.ZipFile(zp)
            xs = [i for i in z.infolist() if i.filename.lower().endswith('.xlsx') and not os.path.basename(i.filename).startswith('~$')]
            if not xs: raise SystemExit(f'sem xlsx em {zp}')
            wb = openpyxl.load_workbook(io.BytesIO(z.read(xs[0])), read_only=True, data_only=True)
            for ws in wb.worksheets:
                st = stage_of(ws.title, os.path.basename(zp))
                if st is None: summary['sheets'].append({'sheet': ws.title, 'skipped': 'etapa desconhecida'}); continue
                allrows = [list(r) for r in ws.iter_rows(values_only=True)]
                hdr = next((i for i, r in enumerate(allrows) if any(isinstance(c, str) and c.startswith('VL_') for c in r)), None)
                if hdr is None: summary['sheets'].append({'sheet': ws.title, 'skipped': 'sem cabeçalho técnico'}); continue
                head = allrows[hdr]; lrow = allrows[hdr - 1]
                # colunas de medida: (medida, ano, sufixo)
                codes = {}
                for j, c in enumerate(head):
                    m = COLRX.match(str(c)) if c else None
                    if m: codes[j] = (m.group(1), int(m.group(2)), m.group(3))
                # buraco no cabeçalho técnico (a aba de Anos Finais do Brasil perde o código de VL_OBSERVADO_2023): infere pelo rótulo do grupo ("IDEB 2023 (N x P)") na linha de cima
                inferred = []
                for j, c in enumerate(head):
                    if c is not None: continue
                    for rr in range(max(0, hdr - 4), hdr):
                        g = allrows[rr][j] if j < len(allrows[rr]) else None
                        mm = re.match(r'^IDEB\s*(20\d\d)', re.sub(r'\s+', ' ', str(g)).strip().replace('IDEB ', 'IDEB'), re.I) if g else None
                        if mm: codes[j] = ('OBSERVADO', int(mm.group(1)), None); inferred.append({'col': j, 'code': f'VL_OBSERVADO_{mm.group(1)}'}); break
                if inferred: summary.setdefault('inferred_codes', {})[ws.title] = inferred
                key_cols = list(range(min(codes)))   # as colunas de identificação vêm antes da primeira medida (no Brasil e nas UFs o cabeçalho técnico delas é vazio)
                labels = lrow + [None] * (len(head) - len(lrow))
                pos = positions(codes, labels, st)
                summary['labels'][f'{ws.title}'] = {k: v for k, v in pos.items()}
                cnt = 0
                data = allrows[hdr + 1:]
                for r in data:
                    if not r or all(c is None for c in r[:4]): continue
                    kv = [norm(r[j]) if j < len(r) else '' for j in key_cols]
                    if level == 'brasil': k = ['Brasil', '', '']; rede = kv[1] if len(kv) > 1 else ''
                    elif level == 'ufs': k = [kv[0], '', '']; rede = kv[1] if len(kv) > 1 else ''
                    elif level == 'municipios': k = [kv[0], kv[1], kv[2]]; rede = kv[3] if len(kv) > 3 else ''
                    else: k = [kv[0], kv[1], kv[3]]; rede = kv[5] if len(kv) > 5 else ''
                    byyear = {}
                    for j, (meas, yr, suf) in codes.items():
                        v = r[j] if j < len(r) else None
                        s = norm(v)
                        if s == '' : continue
                        if s in ('-', '--', '*', '...'): summary['cells']['dash'] += 1; continue
                        if meas == 'APROVACAO':
                            p = pos.get(suf)
                            col = 'ap_tot' if p == 'tot' else (f'ap_{p}' if p in ('1', '2', '3', '4', '5') else None)
                        else:
                            col = {'INDICADOR_REND': 'p', 'NOTA_MATEMATICA': 'nota_mt', 'NOTA_PORTUGUES': 'nota_lp', 'NOTA_MEDIA': 'nota_media', 'OBSERVADO': 'ideb', 'PROJECAO': 'meta'}.get(meas)
                        if col is None: continue
                        if not re.fullmatch(r'-?\d+(\.\d+)?(e-?\d+)?', s, re.I): summary['cells']['dash'] += 1; continue
                        byyear.setdefault(yr, {})[col] = s; summary['cells']['numeric'] += 1
                    for yr, vals in sorted(byyear.items()):
                        n += 1; cnt += 1
                        o.write('\t'.join([str(n)] + k + [rede, str(st), str(yr)] + [vals.get(m, '') for m in MEAS]) + '\n')
                summary['sheets'].append({'sheet': ws.title, 'stage': st, 'tech_row': hdr + 1, 'cols': len(codes), 'rows_out': cnt})
    os.replace(out + '.part', out)
    summary['rows'] = n
    print(json.dumps(summary, ensure_ascii=True))


main()
