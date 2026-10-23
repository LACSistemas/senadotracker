# Reconciliação SIM × Atlas da Violência (P9.1)

Referência: Ipeadata `AVIOL12_HOMIC` (arquivo preservado em `referencias/ipea/atlas-AVIOL12_HOMIC_2026-10-21.json`, SHA-256 `b9091a08cf4a1e8a6da452dbe46fbfdda17ea5a96c6e951c22ca5164832f24da`). O Atlas é derivado do SIM: serve como **conferência**, não como fonte independente. Comparação: **IND-SEG-SIM-ATL-RES** (X85–Y09 + Y35, município de residência; Y36 fica em indicador próprio) × valor do Atlas.

## Estados

- Pares UF × ano comparáveis (Atlas disponível): **324**; idênticos: **324** (100.0 %).
- Nenhuma diferença.

## Municípios (residência)

- Pares município × ano com Atlas: **55340**; idênticos: **53339** (96.38 %); divergentes: 2001 (soma absoluta das diferenças: 19925 óbitos). Por ano: 2020: 2000; 2022: 1.
- **Consistência interna do Atlas** (Σ municípios ≤ UF): inconsistente em 1 ano(s): 2020: Σ municípios do Atlas = 51755 > Σ UFs do Atlas = 49868 (10 UFs com municípios somando mais que a UF). Nessas séries municipais a divergência não indica erro do SIM do Cívica, cujo total por UF coincide com o Atlas em todos os pares.
- Diferenças municipais fora dos anos inconsistentes do Atlas: 3102308/2022 (SIM 0 × Atlas 1; o município tem 1 óbito(s) Y36 — operações de guerra —, que o recorte do Cívica mantém fora da soma e o Atlas municipal parece incluir).
- O Atlas redistribui por ano de referência do arquivo e pode usar versão diferente do SIM; as diferenças são listadas em `reconciliacao_sim_atlas_detalhe.csv` (limitado a 400 linhas municipais) sem ajustar nossos valores.

## Controle documentado na P9 (Espírito Santo)

| Ano | SIM (X85–Y09 + Y35) | Atlas | Igual |
|---|---:|---:|---|
| 2023 | 1161 | 1161 | sim |
| 2024 | 1064 | 1064 | sim |

## Resíduo de causa indeterminada (Y10–Y34), residência, último ano publicado por UF

| UF | Ano | Agressões (X85–Y09) | Indeterminadas | Proporção de indeterminadas |
|---|---:|---:|---:|---:|
| AC | 2025 | 183 | 16 | 8.0 % |
| AL | 2025 | 1107 | 225 | 16.8 % |
| AM | 2025 | 842 | 207 | 19.6 % |
| AP | 2025 | 232 | 25 | 6.8 % |
| BA | 2025 | 4549 | 1347 | 20.1 % |
| CE | 2025 | 2588 | 2264 | 46.4 % |
| DF | 2025 | 260 | 264 | 49.3 % |
| ES | 2025 | 919 | 160 | 14.4 % |
| GO | 2025 | 1102 | 235 | 15.9 % |
| MA | 2025 | 2135 | 155 | 6.7 % |
| MG | 2025 | 2175 | 4292 | 65.9 % |
| MS | 2025 | 437 | 107 | 17.8 % |
| MT | 2025 | 795 | 94 | 10.1 % |
| PA | 2025 | 2168 | 96 | 3.9 % |
| PB | 2025 | 1006 | 66 | 6.1 % |
| PE | 2025 | 3146 | 783 | 19.9 % |
| PI | 2025 | 542 | 55 | 9.1 % |
| PR | 2025 | 1473 | 354 | 16.0 % |
| RJ | 2025 | 2798 | 3866 | 56.4 % |
| RN | 2025 | 877 | 234 | 20.7 % |
| RO | 2025 | 505 | 77 | 12.9 % |
| RR | 2025 | 217 | 68 | 23.7 % |
| RS | 2025 | 1246 | 245 | 16.4 % |
| SC | 2025 | 538 | 225 | 27.0 % |
| SE | 2025 | 495 | 89 | 15.2 % |
| SP | 2025 | 2598 | 5376 | 65.6 % |
| TO | 2025 | 298 | 54 | 14.8 % |

Nenhuma indeterminada foi reclassificada como homicídio. 2025 é preliminar.
