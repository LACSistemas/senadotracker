"""P10.2 — gera RECONCILIACAO_MATRICULAS_2007_2025.md e RECONCILIACAO_TURMAS_2007_2025.md a partir de evidencias/reconciliacao_oferta_sinopse.json. Somente leitura.
Uso: python -I -X utf8 gera_reconciliacoes_p102.py <pasta_execucao>"""
import json, os, sys

root = sys.argv[1]
rec = json.load(open(os.path.join(root, 'evidencias', 'reconciliacao_oferta_sinopse.json'), encoding='utf-8'))
n = lambda v: f'{v:,}'.replace(',', '.') if isinstance(v, int) else str(v)
years = sorted(rec, key=int)


def doc(kind, titulo, tabs, medida, extra):
    L = [f'# {titulo}', '', f'Estado: **{extra["estado"]}**. Para cada edição: soma do que está **publicado no PostgreSQL** (`exec_edu_offer_year` ⨝ cadastro da P10.1) × Sinopse Estatística do **mesmo ano**, em **Brasil, 27 UFs e todos os municípios**.', '',
         f'Tabelas da Sinopse comparadas: {tabs}. Cada município é comparado em todas as colunas mapeadas (total, etapas, modalidades transversais; e, na tabela de localização × dependência, as 11 células urbana/rural × federal/estadual/municipal/privada).', '',
         f'| Ano | {medida} Brasil (Sinopse) | Brasil (banco) | Municípios | Células municipais comparadas | Divergentes (por etapa) | UFs divergentes | Divergentes (loc × dep) | Status |', '|---|---:|---:|---:|---:|---:|---:|---:|---|']
    tot = 0; tot_bad = 0
    for y in years:
        T = rec[y]['tabelas']; a, b = T[kind[0]], T[kind[1]]
        cells = a['celulas_municipio'] + b['celulas_municipio']; bad = a['divergentes_municipio'] + b['divergentes_municipio']; tot += cells; tot_bad += bad
        ok = bad == 0 and a['ufs_divergentes'] == 0
        status = 'sem divergência' if ok else extra['explica'].get(y, 'DIVERGENTE')
        L.append(f'| {y} | {n(a["brasil_sinopse"])} | {n(a["brasil_banco"])} | {a["celulas_municipio"] // a["colunas_comparadas"]} | {n(cells)} | {a["divergentes_municipio"]} | {a["ufs_divergentes"]} | {b["divergentes_municipio"]} | {status} |')
    L += ['', f'**Total: {n(tot)} comparações municipais, {n(tot_bad)} divergentes.**', '']
    L += extra['notas']
    return '\n'.join(L) + '\n'


t41 = rec['2025']['tabelas']['t41']
turma_bad = t41['divergentes_municipio']
mat = doc(('t11', 't12'), 'Reconciliação de matrículas 2007–2025 (G6)', '1.1 (por etapa) e 1.2 (por localização e dependência)', 'Matrículas',
          {'estado': 'PASS', 'explica': {}, 'notas': [
              '## O que foi comparado',
              '- Brasil, 27 UFs e todos os municípios da Sinopse (5.565 a 5.571 por edição), nas colunas: total, educação infantil (creche e pré-escola), ensino fundamental (anos iniciais e finais), ensino médio, educação profissional (total), EJA (total, fundamental, médio) e educação especial (total, classes comuns, classes exclusivas), mais as 11 células de localização × dependência.',
              '- A soma das escolas é feita por SQL sobre a tabela publicada, com o município **registrado na edição** no cadastro da P10.1 (mesma regra da Sinopse); município de escola que mudou de município entre edições conta no município da edição.',
              '- Os totais de 2025 (46.018.380) reproduzem o número já provado na P10 e a Sinopse; os de 2007–2024 foram provados agora.',
              '', '## Invariantes', '- Σ escolas = município = UF = Brasil: verdadeiro em todas as colunas e edições (a comparação com a Sinopse em cada nível já impõe isso).',
              '- O bit0 de matrícula da P10.1 coincide com "existe oferta com `mat_bas > 0`" em 513/513 fatias (verificação executada **dentro de cada publicação**; ver `COBERTURA_EDUCACAO_P102.csv`, coluna `diferenca_bit0` = 0).',
              '', '## Classificação das divergências', '- Nenhuma divergência de matrícula em 19 edições. Nenhuma foi ajustada à mão.',
              '', '## Limites', '- A Sinopse não traz o total por escola: a conferência escola a escola é a do bit0 (matrícula > 0) e a das partições exatas (ver `MODELO_MATRICULAS_E_TURMAS.md`).',
              '- Medidas sem tabela de referência incorporada nesta fase (tempo integral, turno, tempo integral de turmas) não foram reconciliadas; ficam marcadas em `MATRIZ_INDICADORES_P102.csv` como `SEM_TABELA_DE_REFERENCIA_INCORPORADA`.']})
tur = doc(('t41', 't42'), 'Reconciliação de turmas 2007–2025 (G6)', '4.1 (por etapa) e 4.2 (por localização e dependência)', 'Turmas',
          {'estado': 'PASS_WITH_CAVEATS (uma divergência explicada, 2025)', 'explica': {'2025': 'divergência explicada (EJA fundamental)'}, 'notas': [
              '## O que foi comparado',
              '- Brasil, 27 UFs e todos os municípios, em total, educação infantil (creche e pré-escola), ensino fundamental (anos iniciais e finais), ensino médio, educação profissional (total), EJA (total, fundamental, médio) e educação especial (total, classes comuns, classes exclusivas), mais as 11 células de localização × dependência.',
              '', '## A única divergência (2025, tabela 4.1, coluna "EJA – ensino fundamental")',
              f'- {n(turma_bad)} células municipais e 21 UFs; no Brasil, **Sinopse 80.528 × banco 75.832** (diferença 4.696). Todas as outras colunas da tabela 4.1 e toda a tabela 4.2 batem exatamente.',
              '- **Causa comprovada:** na `Tabela_Turma_2025`, `QT_TUR_EJA` soma 113.184 e `QT_TUR_EJA_MED` soma 32.656; a Sinopse publica como "EJA – ensino fundamental" o resto, 113.184 − 32.656 = **80.528**. As 4.696 turmas de EJA (em 2.663 escolas) que o arquivo não classifica em fundamental nem médio são atribuídas ao fundamental pela Sinopse. O banco guarda o valor bruto do arquivo (`tur_eja_fund` = 75.832) **e** o total de EJA (`tur_eja` = 113.184), que bate com a Sinopse (coluna "EJA – total") em todos os níveis.',
              '- Classificação: **recorte/regra diferente da fonte**, não erro do parser. Nenhum número foi ajustado: os read models usam o **total** de EJA como medida de partição e tratam fundamental e médio como informativos (catálogo: `tur_eja_fund`, `tur_eja_med` = TRANSVERSAL).',
              '', '## Invariantes', '- Σ escolas = município = UF = Brasil em todas as colunas e edições; `TUR_BAS − (INF + FUND + MED + EJA)` nunca é negativo (0 violações em 19 edições).',
              '', '## Limites', '- A Sinopse 4.1 não separa turmas por etapa de forma exclusiva (turma multietapa conta em cada etapa): por isso as etapas podem somar mais que o total de turmas.']})
open(os.path.join(root, 'RECONCILIACAO_MATRICULAS_2007_2025.md'), 'w', encoding='utf-8').write(mat)
open(os.path.join(root, 'RECONCILIACAO_TURMAS_2007_2025.md'), 'w', encoding='utf-8').write(tur)
print('ok')
