# Reconciliação de matrículas 2007–2025 (G6)

Estado: **PASS**. Para cada edição: soma do que está **publicado no PostgreSQL** (`exec_edu_offer_year` ⨝ cadastro da P10.1) × Sinopse Estatística do **mesmo ano**, em **Brasil, 27 UFs e todos os municípios**.

Tabelas da Sinopse comparadas: 1.1 (por etapa) e 1.2 (por localização e dependência). Cada município é comparado em todas as colunas mapeadas (total, etapas, modalidades transversais; e, na tabela de localização × dependência, as 11 células urbana/rural × federal/estadual/municipal/privada).

| Ano | Matrículas Brasil (Sinopse) | Brasil (banco) | Municípios | Células municipais comparadas | Divergentes (por etapa) | UFs divergentes | Divergentes (loc × dep) | Status |
|---|---:|---:|---:|---:|---:|---:|---:|---|
| 2007 | 53.028.928 | 53.028.928 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2008 | 53.232.868 | 53.232.868 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2009 | 52.580.452 | 52.580.452 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2010 | 51.549.889 | 51.549.889 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2011 | 50.972.619 | 50.972.619 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2012 | 50.545.050 | 50.545.050 | 5565 | 144.690 | 0 | 0 | 0 | sem divergência |
| 2013 | 50.042.448 | 50.042.448 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2014 | 49.771.371 | 49.771.371 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2015 | 48.796.512 | 48.796.512 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2016 | 48.817.479 | 48.817.479 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2017 | 48.608.093 | 48.608.093 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2018 | 48.455.867 | 48.455.867 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2019 | 47.874.246 | 47.874.246 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2020 | 47.295.294 | 47.295.294 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2021 | 46.668.401 | 46.668.401 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2022 | 47.382.074 | 47.382.074 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2023 | 47.304.632 | 47.304.632 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2024 | 47.088.922 | 47.088.922 | 5570 | 144.820 | 0 | 0 | 0 | sem divergência |
| 2025 | 46.018.380 | 46.018.380 | 5571 | 144.846 | 0 | 0 | 0 | sem divergência |

**Total: 2.750.826 comparações municipais, 0 divergentes.**

## O que foi comparado
- Brasil, 27 UFs e todos os municípios da Sinopse (5.565 a 5.571 por edição), nas colunas: total, educação infantil (creche e pré-escola), ensino fundamental (anos iniciais e finais), ensino médio, educação profissional (total), EJA (total, fundamental, médio) e educação especial (total, classes comuns, classes exclusivas), mais as 11 células de localização × dependência.
- A soma das escolas é feita por SQL sobre a tabela publicada, com o município **registrado na edição** no cadastro da P10.1 (mesma regra da Sinopse); município de escola que mudou de município entre edições conta no município da edição.
- Os totais de 2025 (46.018.380) reproduzem o número já provado na P10 e a Sinopse; os de 2007–2024 foram provados agora.

## Invariantes
- Σ escolas = município = UF = Brasil: verdadeiro em todas as colunas e edições (a comparação com a Sinopse em cada nível já impõe isso).
- O bit0 de matrícula da P10.1 coincide com "existe oferta com `mat_bas > 0`" em 513/513 fatias (verificação executada **dentro de cada publicação**; ver `COBERTURA_EDUCACAO_P102.csv`, coluna `diferenca_bit0` = 0).

## Classificação das divergências
- Nenhuma divergência de matrícula em 19 edições. Nenhuma foi ajustada à mão.

## Limites
- A Sinopse não traz o total por escola: a conferência escola a escola é a do bit0 (matrícula > 0) e a das partições exatas (ver `MODELO_MATRICULAS_E_TURMAS.md`).
- Medidas sem tabela de referência incorporada nesta fase (tempo integral, turno, tempo integral de turmas) não foram reconciliadas; ficam marcadas em `MATRIZ_INDICADORES_P102.csv` como `SEM_TABELA_DE_REFERENCIA_INCORPORADA`.
