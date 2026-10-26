"""P10/G10 (v2 refinada) — varredura SOMENTE LEITURA do RAW do PNCP (D:/Civica/raw/pncp/contratos/AAAA/MM.jsonl.gz) para estimar a classificação de Educação.
Uso: python -I pncp_educacao_raw_scan.py <saida.json> <amostras.json> [ids_seguranca.txt]
Regras CONSERVADORAS (documentadas no relatório): institucional = nome do órgão/unidade; temático = objeto do contrato. Não escreve em banco.
Deduplica por numeroControlePNCP mantendo a versão mais recente (dataAtualizacao)."""
import glob, gzip, json, re, sys, random, collections, unicodedata

def norm(s):
    s = unicodedata.normalize('NFKD', s or '').encode('ascii', 'ignore').decode().upper()
    return re.sub(r'\s+', ' ', s)

# --- classificação institucional (órgão contratante / unidade) ---
INST = [
    ('secretaria_educacao', re.compile(r'\bSECRETARIA\b[^,;]{0,40}\bEDUCACAO\b|\bSEC\.? (MUN\w*|EST\w*)\.? (DE|DA) EDUCACAO\b|\bSEMED\b|\bSEDUC\b')),
    ('fundo_educacao', re.compile(r'\bFUNDO\b[^,;]{0,40}\bEDUCACAO\b|\bFME\b|\bFUNDEB\b')),
    ('fnde', re.compile(r'FUNDO NACIONAL DE DESENVOLVIMENTO DA EDUCACAO|MINISTERIO DA EDUCACAO')),
    ('universidade_if', re.compile(r'\bUNIVERSIDADE\b|\bINSTITUTO FEDERAL\b|\bCEFET\b|FUNDACAO UNIVERSIDADE|\bUNIVERSITARIO\b')),
    ('unidade_escolar', re.compile(r'\b(ESCOLA|COLEGIO|CMEI|EMEF|EMEI|CEMEI|CRECHE|CENTRO (MUNICIPAL )?DE EDUCACAO|CEIM|EEEFM|EEEM|EEEF)\b')),
    ('departamento_educacao', re.compile(r'\b(DEPARTAMENTO|DIRETORIA|COORDENADORIA)\b[^,;]{0,30}\bEDUCACAO\b')),
]
# --- classificação temática (objeto) ---
THEME = [
    ('alimentacao_escolar', re.compile(r'\bMERENDA\b|ALIMENTACAO ESCOLAR|\bPNAE\b|GENEROS ALIMENTICIOS[^.;]{0,80}\b(ESCOLA|ESCOLAR|ESCOLAS|ALUNOS|REDE (MUNICIPAL|ESTADUAL) DE ENSINO)\b')),
    ('transporte_escolar', re.compile(r'TRANSPORTE ESCOLAR|\bPNATE\b|TRANSPORTE DE (ALUNOS|ESTUDANTES)')),
    ('material_didatico', re.compile(r'MATERIAL DIDATICO|LIVROS? DIDATICOS?|\bPNLD\b|SISTEMA (DE|APOSTILADO)[^.;]{0,20}ENSINO|APOSTILAS?\b[^.;]{0,40}\b(ALUNOS|ESCOLA|ENSINO)\b')),
    ('mobiliario_equip_escolar', re.compile(r'MOBILIARIO ESCOLAR|CARTEIRAS? ESCOLARES?|CONJUNTO ALUNO|KIT ESCOLAR|UNIFORMES? ESCOLARES?|MATERIAL ESCOLAR')),
    ('tecnologia_educacional', re.compile(r'LOUSA DIGITAL|KIT(S)? DE ROBOTICA|TECNOLOGIA EDUCACIONAL|LABORATORIO DE (INFORMATICA|CIENCIAS) (ESCOLAR|PARA ESCOLAS)|NOTEBOOKS? (EDUCACIONA\w+|PARA (ALUNOS|PROFESSORES))')),
    ('obra_escolar', re.compile(r'\b(CONSTRUCAO|REFORMA|AMPLIACAO|REVITALIZACAO|REQUALIFICACAO|COBERTURA DE QUADRA|QUADRA POLIESPORTIVA)\b[^.;]{0,60}\b(ESCOLA|ESCOLAS|ESCOLAR|CRECHE|CMEI|EMEF|EMEI|UNIDADE EDUCACIONAL|UNIDADE ESCOLAR)\b')),
    ('manutencao_escolar', re.compile(r'\b(MANUTENCAO|LIMPEZA|VIGILANCIA|CLIMATIZACAO|AR CONDICIONADO)\b[^.;]{0,60}\b(ESCOLAS|UNIDADES ESCOLARES|UNIDADES DE ENSINO|REDE (MUNICIPAL|ESTADUAL) DE ENSINO)\b')),
    ('servico_educacional', re.compile(r'SERVICOS? EDUCACIONAIS?|CURSOS? (DE )?(FORMACAO|CAPACITACAO) (DE )?(PROFESSORES|DOCENTES)|FORMACAO CONTINUADA (DE )?(PROFESSORES|DOCENTES)|ENSINO (A DISTANCIA|SUPERIOR|FUNDAMENTAL|MEDIO)|EDUCACAO (INFANTIL|BASICA|ESPECIAL|INTEGRAL)')),
]

EXCL_UNIT = re.compile(r'HOSPITAL|HU[A-Z]{0,3}|EBSERH|ESCOLA (DE|DO|DA|NACIONAL DE|SUPERIOR DE|NAVAL|DE GUERRA)|FUNDACAO ESCOLA|COMANDO|MARINHA|EXERCITO|AERONAUTICA|POLICIA|TRIBUNAL|DEFENSORIA|ASSEMBLEIA|CAMARA|MINISTERIO PUBLICO|SECRETARIA (DA|DE) FAZENDA')
HOSP_OBJ = re.compile(r'MEDICAMENTO|MATERIAL MEDICO|HOSPITALAR|INSUMOS? (HOSPITALAR|MEDIC|LABORATORI)|REAGENTE|FARMAC|ODONTOLOG|CIRURGIC')
LOOSE_THEME = {'servico_educacional'}
CORE_INST = {'secretaria_educacao', 'fundo_educacao', 'departamento_educacao', 'fnde'}
BIG = 10_000_000_000.0   # contratos acima de R$ 10 bi são outlier (mesma regra da P9.5)

def classify(orgao, unidade, objeto):
    o = norm(orgao) + ' | ' + norm(unidade); t = norm(objeto)
    inst = [k for k, rx in INST if rx.search(o)]
    if 'unidade_escolar' in inst and EXCL_UNIT.search(o): inst.remove('unidade_escolar')
    theme = [k for k, rx in THEME if rx.search(t)]
    if 'universidade_if' in inst and HOSP_OBJ.search(t): inst = [k if k != 'universidade_if' else 'universidade_if_hospitalar' for k in inst]
    return inst, theme

out_path, sample_path = sys.argv[1], sys.argv[2]
sec_ids = set(open(sys.argv[3], encoding='utf-8').read().split()) if len(sys.argv) > 3 else set()
latest = {}      # hash(numeroControlePNCP) -> (dataAtualizacao, classificação compacta)
total_raw = collections.Counter(); pages_bad = 0; months = {}
samples = collections.defaultdict(list); seen_n = collections.Counter(); rnd = random.Random(10)
stat = collections.defaultdict(lambda: collections.Counter())
for f in sorted(glob.glob('D:/Civica/raw/pncp/contratos/*/*.jsonl.gz')):
    f = f.replace(chr(92), '/'); y = int(f.split('/')[-2]); m = int(f.split('/')[-1][:2]); rows = 0
    with gzip.open(f, 'rt', encoding='utf-8') as fh:
        for line in fh:
            pl = json.loads(line)
            if pl['s'] != 200: pages_bad += 1; continue
            for c in json.loads(pl['b']).get('data', []):
                rows += 1
                key = c.get('numeroControlePNCP') or ''
                inst, theme = classify((c.get('orgaoEntidade') or {}).get('razaoSocial'), (c.get('unidadeOrgao') or {}).get('nomeUnidade'), c.get('objetoContrato'))
                v = c.get('valorGlobal'); v = float(v) if isinstance(v, (int, float)) else None
                if inst or theme:
                    rec = (c.get('dataAtualizacao') or '', int(c.get('anoContrato') or y), inst, theme, v, key, (c.get('orgaoEntidade') or {}).get('razaoSocial'), (c.get('unidadeOrgao') or {}).get('nomeUnidade'), (c.get('objetoContrato') or '')[:300], (c.get('orgaoEntidade') or {}).get('esferaId'), (c.get('unidadeOrgao') or {}).get('codigoIbge'))
                else:   # não classificado: guarda só o mínimo (memória)
                    rec = (c.get('dataAtualizacao') or '', int(c.get('anoContrato') or y), (), (), v, key, None, None, None, None, None)
                h = hash(key)
                if h not in latest or rec[0] >= latest[h][0]: latest[h] = rec
    months[f'{y}-{m:02d}'] = rows; total_raw[y] += rows
    print(f'{y}-{m:02d}', rows, flush=True)
# consolida (versão mais recente de cada contrato)
for rec in latest.values():
    dt, ano, inst, theme, v, key, org, uni, obj, esf, ibge = rec
    s_ = stat[ano]; s_['contratos_unicos'] += 1
    ok = v is not None and v <= BIG
    core_i = any(k in CORE_INST or k == 'unidade_escolar' for k in inst); sup = any(k == 'universidade_if' for k in inst); sup_h = any(k == 'universidade_if_hospitalar' for k in inst)
    core_t = any(k not in LOOSE_THEME for k in theme); loose_t = bool(theme) and not core_t
    grp = []
    if core_i: grp.append('inst_nucleo')
    if sup: grp.append('inst_superior')
    if sup_h: grp.append('inst_superior_hospitalar')
    if core_t: grp.append('tema_nucleo')
    if loose_t: grp.append('tema_amplo')
    if (core_i or sup) and (core_t or loose_t): grp.append('inst_e_tema')
    nucleo = core_i or core_t
    if nucleo: grp.append('NUCLEO_EDUCACAO')
    if v is not None and v > BIG: s_['outlier_acima_10bi'] += 1
    for g in grp:
        s_[f'n_{g}'] += 1
        if ok: s_[f'valor_{g}_centavos'] += round(v * 100)
    if nucleo and key in sec_ids: s_['nucleo_sobreposto_a_seguranca'] += 1
    for k in inst: s_[f'inst_{k}'] += 1
    for k in theme: s_[f'tema_{k}'] += 1
    if grp:
        bucket = ('NUCLEO' if nucleo else 'outros') + ':' + (grp[0])
        seen_n[bucket] += 1
        item = {'id': key, 'ano': ano, 'orgao': org, 'unidade': uni, 'objeto': obj, 'valor': v, 'inst': inst, 'tema': theme, 'esfera': esf, 'ibge': ibge}
        if len(samples[bucket]) < 12: samples[bucket].append(item)
        else:
            j = rnd.randint(0, seen_n[bucket] - 1)
            if j < 12: samples[bucket][j] = item
result = {'paginas_nao_200': pages_bad, 'linhas_brutas_por_ano': dict(total_raw), 'linhas_brutas_por_mes': months,
          'contratos_unicos_total': len(latest), 'por_ano': {str(k): dict(v) for k, v in sorted(stat.items())}}
json.dump(result, open(out_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
json.dump({'buckets': {k: {'n': seen_n[k], 'amostra': v} for k, v in sorted(samples.items())}}, open(sample_path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
print('FIM', len(latest))
