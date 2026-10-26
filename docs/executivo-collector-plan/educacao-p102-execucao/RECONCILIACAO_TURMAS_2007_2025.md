# Reconciliação de turmas 2007–2025 (G6)

Estado: **PASS_WITH_CAVEATS (uma divergência explicada, 2025)**. Para cada edição: soma do que está **publicado no PostgreSQL** (`exec_edu_offer_year` ⨝ cadastro da P10.1) × Sinopse Estatística do **mesmo ano**, em **Brasil, 27 UFs e todos os municípios**.

Tabelas da Sinopse comparadas: 4.1 (por etapa) e 4.2 (por localização e dependência). Cada município é comparado em todas as colunas mapeadas (total, etapas, modalidades transversais; e, na tabela de localização × dependência, as 11 células urbana/rural × federal/estadual/municipal/privada).

| Ano | Turmas Brasil (Sinopse) | Brasil (banco) | Municípios | Células municipais comparadas | Divergentes (por etapa) | UFs divergentes | Divergentes (loc × dep) | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2007 | 2.098.756 | 2.098.756 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2008 | 2.138.582 | 2.138.582 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2009 | 2.145.029 | 2.145.029 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2010 | 2.150.472 | 2.150.472 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2011 | 2.155.952 | 2.155.952 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2012 | 2.173.607 | 2.173.607 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2013 | 2.186.922 | 2.186.922 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2014 | 2.186.920 | 2.186.920 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2015 | 2.164.640 | 2.164.640 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2016 | 2.171.013 | 2.171.013 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2017 | 2.169.220 | 2.169.220 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2018 | 2.163.997 | 2.163.997 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2019 | 2.160.089 | 2.160.089 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2020 | 2.142.065 | 2.142.065 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2021 | 2.128.776 | 2.128.776 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2022 | 2.190.502 | 2.190.502 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2023 | 2.212.677 | 2.212.677 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2024 | 2.224.054 | 2.224.054 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2025 | 2.233.976 | 2.233.976 | 5571 | 144.846 | 528 | 21 | 0 | divergência explicada (EJA fundamental) |

**Total: 2.750.826 comparações municipais, 528 divergentes.**

## O que foi comparado
- Brasil, 27 UFs e todos os municípios, em total, educação infantil (creche e pré-escola), ensino fundamental (anos iniciais e finais), ensino médio, educação profissional (total), EJA (total, fundamental, médio) e educação especial (total, classes comuns, classes exclusivas), mais as 11 células de localização × dependência.

## A única divergência (2025, tabela 4.1, coluna "EJA – ensino fundamental")
- 528 células municipais e 21 UFs; no Brasil, **Sinopse 80.528 × banco 75.832** (diferença 4.696). Todas as outras colunas da tabela 4.1 e toda a tabela 4.2 batem exatamente.
- **Causa comprovada:** na `Tabela_Turma_2025`, `QT_TUR_EJA` soma 113.184 e `QT_TUR_EJA_MED` soma 32.656; a Sinopse publica como "EJA – ensino fundamental" o resto, 113.184 − 32.656 = **80.528**. As 4.696 turmas de EJA (em 2.663 escolas) que o arquivo não classifica em fundamental nem médio são atribuídas ao fundamental pela Sinopse. O banco guarda o valor bruto do arquivo (`tur_eja_fund` = 75.832) **e** o total de EJA (`tur_eja` = 113.184), que bate com a Sinopse (coluna "EJA – total") em todos os níveis.
- Classificação: **recorte/regra diferente da fonte**, não erro do parser. Nenhum número foi ajustado: os read models usam o **total** de EJA como medida de partição e tratam fundamental e médio como informativos (catálogo: `tur_eja_fund`, `tur_eja_med` = TRANSVERSAL).

## Invariantes
- Σ escolas = município = UF = Brasil em todas as colunas e edições; `TUR_BAS − (INF + FUND + MED + EJA)` nunca é negativo (0 violações em 19 edições).

## Limites
- A Sinopse 4.1 não separa turmas por etapa de forma exclusiva (turma multietapa conta em cada etapa): por isso as etapas podem somar mais que o total de turmas.
