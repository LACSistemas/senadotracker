# Reconciliação institucional (P9.3)

Gerado em 2026-10-22T00:06:24.902Z a partir do banco de produção, do RAW preservado em D:\Civica e dos arquivos oficiais. Nenhum total foi ajustado para fechar: onde as fontes divergem, os dois valores estão preservados.

## 1. FBSP Raio-X 2026 (dados de 2025)

Arquivo: `seguranca/efetivos/fbsp-raiox-2026/raio-x-forcas-seguranca-2026.pdf` — SHA-256 `ae211717ae03dea5807d59f19125aff48fa6ad8e27f077f912b5fdd1c4871023` (1850315 bytes). Extração por posição das palavras na página (`fbsp_extract.py`, fbsp-raiox-v2); SP e RS conferidos visualmente na Tabela 2 (página 14) e nas Tabelas 3 a 5 (páginas 22, 24 e 28).

- **SP**: a célula do Corpo de Bombeiros está **vazia no PDF** (nota 7: bombeiros somados à PM). Na extração por texto corrido a linha vinha com 8 números e deslocava todas as colunas; por posição, SP PM = 82.250 (inclui bombeiros), CBM = vazio, PC = 19.420, Perícia = 4.785, Polícia Penal = 24.898, GCM = 30.184, total 161.537 (soma conferida).
- **RS**: PM 18.360, CBM 2.995, PC 5.771, Perícia 825, Polícia Penal 6.036, GCM 2.436, total 36.423 (soma conferida); as linhas de RS das Tabelas 3, 4 e 5 também fecham com a coluna "relação" impressa.

| Verificação | Esperado | Obtido | OK |
|---|---:|---:|:--:|
| T2 PM: Σ UFs = Brasil | 413.319 | 413.319 | sim |
| T2 CBM: Σ UFs = Brasil | 63.002 | 63.002 | sim |
| T2 PC: Σ UFs = Brasil | 96.902 | 96.902 | sim |
| T2 PERICIA: Σ UFs = Brasil | 19.340 | 19.340 | sim |
| T2 POLICIA_PENAL: Σ UFs = Brasil | 91.850 | 91.850 | sim |
| T2 GCM: Σ UFs = Brasil | 107.457 | 107.457 | sim |
| T2 linha BR: Σ corporações = Total | 818.521 | 818.521 | sim |
| T2 linha AC: Σ corporações = Total | 5.282 | 5.282 | sim |
| T2 linha AL: Σ corporações = Total | 14.597 | 14.597 | sim |
| T2 linha AP: Σ corporações = Total | 8.746 | 8.746 | sim |
| T2 linha AM: Σ corporações = Total | 14.650 | 14.650 | sim |
| T2 linha BA: Σ corporações = Total | 51.811 | 51.811 | sim |
| T2 linha CE: Σ corporações = Total | 40.729 | 40.729 | sim |
| T2 linha DF: Σ corporações = Total | 23.175 | 23.175 | sim |
| T2 linha ES: Σ corporações = Total | 16.759 | 16.759 | sim |
| T2 linha GO: Σ corporações = Total | 24.271 | 24.271 | sim |
| T2 linha MA: Σ corporações = Total | 18.420 | 18.420 | sim |
| T2 linha MT: Σ corporações = Total | 15.499 | 15.499 | sim |
| T2 linha MS: Σ corporações = Total | 14.022 | 14.022 | sim |
| T2 linha MG: Σ corporações = Total | 75.373 | 75.373 | sim |
| T2 linha PA: Σ corporações = Total | 29.147 | 29.147 | sim |
| T2 linha PB: Σ corporações = Total | 17.778 | 17.778 | sim |
| T2 linha PR: Σ corporações = Total | 31.106 | 31.106 | sim |
| T2 linha PE: Σ corporações = Total | 31.369 | 31.369 | sim |
| T2 linha PI: Σ corporações = Total | 10.612 | 10.612 | sim |
| T2 linha RJ: Σ corporações = Total | 83.299 | 83.299 | sim |
| T2 linha RN: Σ corporações = Total | 14.886 | 14.886 | sim |
| T2 linha RS: Σ corporações = Total | 36.423 | 36.423 | sim |
| T2 linha RO: Σ corporações = Total | 9.658 | 9.658 | sim |
| T2 linha RR: Σ corporações = Total | 5.033 | 5.033 | sim |
| T2 linha SC: Σ corporações = Total | 20.804 | 20.804 | sim |
| T2 linha SP: Σ corporações = Total | 161.537 | 161.537 | sim |
| T2 linha SE: Σ corporações = Total | 10.332 | 10.332 | sim |
| T2 linha TO: Σ corporações = Total | 6.552 | 6.552 | sim |
| T3 previsto: Σ UFs = Brasil | 628.732 | 628.732 | sim |
| T4 previsto: Σ UFs = Brasil | 175.477 | 175.477 | sim |
| T5 previsto: Σ UFs = Brasil | 134.164 | 134.164 | sim |
| T15 MUN_FINAL: Σ UFs = Brasil | 1.384 | 1.384 | sim |
| T15 EF_FINAL: Σ UFs = Brasil | 107.457 | 107.457 | sim |
| T15 EF_RAIS2024: Σ UFs = Brasil | 102.503 | 102.503 | sim |
| T15 MUN_RAIS2024: Σ UFs = Brasil | 1.357 | 1.357 | sim |

41 verificações; 0 falhas. A carga aborta se qualquer uma falhar.

### Taxa por 1.000 habitantes — conferência independente com a Tabela 6 do FBSP

O Cívica calcula a taxa dividindo o efetivo pela população estimada 2025 (IBGE, SIDRA 6579) já carregada; o FBSP usa as estimativas enviadas ao TCU em 2025. A diferença de denominador explica desvios de até ±0,1 por mil (arredondamento).

| UF | PM Cívica | PM FBSP | CBM Cívica | CBM FBSP | PC Cívica | PC FBSP |
|---|---:|---:|---:|---:|---:|---:|
| RO | 2,74 | 2,7 | 0,40 | 0,4 | 0,86 | 0,9 |
| AC | 2,69 | 2,7 | 0,77 | 0,8 | 1,12 | 1,1 |
| AM | 2,00 | 2,0 | 0,31 | 0,3 | 0,44 | 0,4 |
| RR | 3,37 | 3,4 | 0,68 | 0,7 | 0,82 | 0,8 |
| PA | 1,88 | 1,9 | 0,29 | 0,3 | 0,39 | 0,4 |
| AP | 4,45 | 4,4 | 1,68 | 1,7 | 1,51 | 1,5 |
| TO | 1,98 | 2,0 | 0,41 | 0,4 | 0,65 | 0,7 |
| MA | 1,61 | 1,6 | 0,22 | 0,2 | 0,25 | 0,2 |
| PI | 2,05 | 2,1 | 0,15 | 0,2 | 0,48 | 0,5 |
| CE | 2,57 | 2,6 | 0,21 | 0,2 | 0,47 | 0,5 |
| RN | 2,62 | 2,6 | 0,26 | 0,3 | 0,52 | 0,5 |
| PB | 2,48 | 2,5 | 0,35 | 0,4 | 0,52 | 0,5 |
| PE | 1,65 | 1,6 | 0,24 | 0,2 | 0,45 | 0,5 |
| AL | 2,38 | 2,4 | 0,37 | 0,4 | 0,64 | 0,6 |
| SE | 2,45 | 2,5 | 0,40 | 0,4 | 0,62 | 0,6 |
| BA | 2,05 | 2,1 | 0,25 | 0,3 | 0,38 | 0,4 |
| MG | 1,74 | 1,7 | 0,28 | 0,3 | 0,42 | 0,4 |
| ES | 2,24 | 2,2 | 0,33 | 0,3 | 0,43 | 0,4 |
| RJ | 2,47 | 2,5 | 0,75 | 0,7 | 0,35 | 0,3 |
| SP | 1,78 | 1,8 | — | — | 0,42 | 0,4 |
| PR | 1,35 | 1,4 | 0,27 | 0,3 | 0,32 | 0,3 |
| SC | 1,16 | 1,2 | 0,31 | 0,3 | 0,37 | 0,4 |
| RS | 1,63 | 1,6 | 0,27 | 0,3 | 0,51 | 0,5 |
| MS | 2,03 | 2,0 | 0,57 | 0,6 | 0,67 | 0,7 |
| MT | 1,82 | 1,8 | 0,38 | 0,4 | 0,82 | 0,8 |
| GO | 1,60 | 1,6 | 0,39 | 0,4 | 0,46 | 0,5 |
| DF | 3,64 | 3,6 | 1,91 | 1,9 | 1,24 | 1,2 |

80 de 80 células ficam a no máximo 0,1 por mil da taxa impressa pelo FBSP.

## 2. ESTADIC (edições 2019 e 2023)

| Data-base | Indicador | Σ das UFs | UFs com valor | UFs com linha | Recusa | Não informou |
|---|---|---:|---:|---:|---:|---:|
| 2018-12-31 | Efetivo existente da Polícia Militar (ESTADIC) | 416.923 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Efetivo existente da Polícia Militar — homens (ESTADIC) | 371.068 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Efetivo existente da Polícia Militar — mulheres (ESTADIC) | 45.855 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Efetivo existente da Polícia Civil (ESTADIC) | 117.228 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Efetivo existente da Polícia Civil — homens (ESTADIC) | 84.862 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Efetivo existente da Polícia Civil — mulheres (ESTADIC) | 32.366 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Unidades operacionais da Polícia Militar (ESTADIC) | 2.308 | 27 | 27 | 0 | 0 |
| 2018-12-31 | Delegacias distritais da Polícia Civil (ESTADIC) | 5.356 | 26 | 27 | 0 | 1 |
| 2018-12-31 | Delegacias especializadas da Polícia Civil (ESTADIC) | 1.533 | 26 | 27 | 0 | 1 |
| 2018-12-31 | Perícia Oficial vinculada à Polícia Civil (ESTADIC) | 12 | 27 | 27 | 0 | 0 |
| 2022-12-31 | Efetivo existente da Polícia Militar (ESTADIC) | 398.455 | 26 | 27 | 1 | 0 |
| 2022-12-31 | Efetivo existente da Polícia Militar — homens (ESTADIC) | 332.319 | 24 | 27 | 1 | 2 |
| 2022-12-31 | Efetivo existente da Polícia Militar — mulheres (ESTADIC) | 46.114 | 24 | 27 | 1 | 2 |
| 2022-12-31 | Efetivo existente da Polícia Civil (ESTADIC) | 107.968 | 26 | 27 | 1 | 0 |
| 2022-12-31 | Efetivo existente da Polícia Civil — homens (ESTADIC) | 73.813 | 24 | 27 | 1 | 2 |
| 2022-12-31 | Efetivo existente da Polícia Civil — mulheres (ESTADIC) | 28.368 | 24 | 27 | 1 | 2 |
| 2022-12-31 | Unidades operacionais da Polícia Militar (ESTADIC) | 1.734 | 26 | 27 | 1 | 0 |
| 2022-12-31 | Delegacias distritais da Polícia Civil (ESTADIC) | 6.058 | 26 | 27 | 1 | 0 |
| 2022-12-31 | Delegacias especializadas da Polícia Civil (ESTADIC) | 1.807 | 26 | 27 | 1 | 0 |
| 2022-12-31 | Perícia Oficial vinculada à Polícia Civil (ESTADIC) | 14 | 26 | 27 | 1 | 0 |

**Controles da investigação P9 (ESTADIC 2023):** PM = 398.455 e PC = 107.968 (26 UFs respondentes; Rondônia recusou). Reconciliados: ver as linhas `2022-12-31` de ESEG273 e ESEG493 acima.

**ESTADIC 2019 (edição adicional, mesmas variáveis e mesmos rótulos):** data-base 31/12/2018; 27 UFs responderam PM e PC (PM = 416.923; PC = 117.228); o Pará não soube informar as delegacias. **Em 2023** Pará e Tocantins informaram só o total do efetivo (sem o recorte por sexo) e Rondônia recusou responder.

Rondônia 2023: IND-EFE-ESTADIC-ESEG273 → valor NULL (refused); IND-EFE-ESTADIC-ESEG493 → valor NULL (refused). Nunca zero.

## 3. MUNIC (edições 2019 e 2023)

| Edição da pesquisa (efetivo: data-base 31/12/2022 em 2023) | Com guarda | Sem guarda | Não informou | Recusa | Σ (reconcilia com) | Efetivo total declarado | Guarda com efetivo 0 declarado | Delegacia PC sim | Delegacia PC não | Delegacia PC sem resposta | "Nenhuma das citadas" |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| 2019 | 1188 | 4380 | 0 | 2 | 5570 de 5570 | 99.510 | 18 | 4096 | 1472 | 2 | 0 |
| 2023 | 1322 | 4242 | 6 | 0 | 5570 de 5570 | 101.854 | 25 | 4231 | 2 | 6 | 1331 |

**Controles da investigação P9 (MUNIC 2023):** 1.322 com guarda + 4.242 sem + 6 sem resposta = 5.570 linhas; efetivo 101.854 (obtido: 101.854); delegacia de Polícia Civil em 4.231 (a P9 contou "Sim" em MSEG161). Em 2023, **1.331** municípios têm "-" em MSEG161 porque marcaram "Nenhuma das citadas" (MSEG1611 = Sim): somados aos 2 "Não", são 1.333 municípios sem delegacia declarada; 6 não informaram; 4.231 + 1.333 + 6 = 5.570. Edição 2019: 1.188 com guarda, efetivo 99.510.

A fundação territorial do Cívica tem 5.571 municípios; as duas pesquisas têm 5.570. O município sem linha na MUNIC não recebe valor (ver `cobertura_munic_guardas.csv`, coluna `na_pesquisa_*`).

### Casos de regressão (município)

| Município | Guarda 2023 | Efetivo 2023 (31/12/2022) | Delegacia PC 2023 | Guarda 2019 | Efetivo 2019 |
|---|---|---:|---|---|---:|
| Vitória/ES | sim | 427 ✓ | sim | sim | 470 |
| Vila Velha/ES | sim | 286 ✓ | sim | sim | 296 |
| Serra/ES | sim | 142 ✓ | sim | sim | 108 |
| Cariacica/ES | sim | 43 ✓ | sim | nao | — |
| Alto Rio Novo/ES | nao | — | sim | nao | — |
| São Paulo/SP | sim | 5800 ✓ | sim | sim | 6211 |
| Rio de Janeiro/RJ | sim | 7238 ✓ | sim | sim | 7766 |
| Porto Alegre/RS | sim | 426 | sim | sim | 416 |
| Porto Velho/RO | nao | — | sim | nao | — |
| Brasília/DF | nao | — | sim | nao | — |

### Guardas municipais por UF: FBSP × MUNIC (leituras diferentes; não forçadas a igualar)

FBSP final = RAIS 2024 + MUNIC 2023 + Senasp 2024 validados pelo FBSP (Tabela 15). MUNIC Cívica = soma direta das respostas das prefeituras na planilha oficial. O próprio FBSP leu a MUNIC 2023 como 1.306 municípios e 101.653 guardas; a planilha oficial tem 1.322 e 101.854: o Cívica publica o arquivo como está.

| UF | FBSP final (efetivo) | RAIS 2024 (FBSP) | MUNIC 2023 (soma Cívica) | MUNIC 2019 (soma Cívica) | Municípios sem resposta 2023 |
|---|---:|---:|---:|---:|---:|
| AC | 0 | 0 | 0 | 0 | 0 |
| AL | 2.576 | 2.285 | 2.718 | 2.562 | 0 |
| AM | 2.580 | 2.253 | 2.091 | 2.154 | 0 |
| AP | 1.234 | 1.229 | 750 | 737 | 0 |
| BA | 10.031 | 9.765 | 9.524 | 9.115 | 0 |
| CE | 6.420 | 6.378 | 5.589 | 5.091 | 0 |
| DF | 0 | 0 | 0 | 0 | 0 |
| ES | 1.905 | 1.948 | 1.680 | 1.682 | 0 |
| GO | 3.315 | 2.953 | 3.132 | 3.445 | 0 |
| MA | 3.020 | 2.574 | 3.023 | 2.797 | 0 |
| MG | 5.676 | 5.527 | 5.176 | 4.755 | 0 |
| MS | 1.797 | 1.799 | 1.795 | 1.678 | 0 |
| MT | 287 | 486 | 274 | 235 | 1 |
| PA | 2.794 | 2.668 | 2.918 | 2.923 | 3 |
| PB | 1.551 | 1.491 | 1.804 | 1.955 | 0 |
| PE | 6.111 | 6.031 | 6.293 | 6.177 | 0 |
| PI | 480 | 483 | 543 | 337 | 0 |
| PR | 4.498 | 3.888 | 4.383 | 4.065 | 0 |
| RJ | 15.809 | 14.775 | 16.076 | 16.010 | 0 |
| RN | 1.113 | 999 | 1.426 | 1.376 | 0 |
| RO | 67 | 25 | 87 | 44 | 1 |
| RR | 615 | 610 | 459 | 413 | 0 |
| RS | 2.436 | 2.121 | 2.855 | 2.635 | 1 |
| SC | 1.311 | 1.144 | 1.020 | 820 | 0 |
| SE | 1.339 | 1.345 | 1.322 | 1.386 | 0 |
| SP | 30.184 | 29.393 | 26.608 | 26.813 | 0 |
| TO | 308 | 333 | 308 | 305 | 0 |

## 4. FBSP 2025 × ESTADIC 2022 — PM e PC por UF (valores lado a lado)

Fontes, datas-base e definições diferentes (portais da transparência, março/2025 × declaração do órgão gestor, 31/12/2022): **não é variação**, e não existe valor para 2023–2024.

| UF | PM FBSP 2025 | PM ESTADIC 2022 | PC FBSP 2025 | PC ESTADIC 2022 |
|---|---:|---:|---:|---:|
| AC | 2.375 | 2.556 | 994 | 1.069 |
| AL | 7.673 | 6.810 | 2.069 | 1.859 |
| AM | 8.646 | 7.980 | 1.891 | 1.848 |
| AP | 3.588 | 3.112 | 1.220 | 998 |
| BA | 30.491 | 29.678 | 5.700 | 5.397 |
| CE | 23.793 | 22.930 | 4.392 | 4.129 |
| DF | 10.909 | 10.589 | 3.730 | 3.863 |
| ES | 9.231 | 7.938 | 1.764 | 2.279 |
| GO | 11.856 | 11.068 | 3.448 | 3.133 |
| MA | 11.274 | 11.176 | 1.720 | 1.813 |
| MG | 37.261 | 37.196 | 8.935 | 11.498 |
| MS | 5.948 | 5.435 | 1.945 | 1.987 |
| MT | 7.094 | 6.734 | 3.209 | 2.904 |
| PA | 16.352 | 16.307 | 3.379 | 3.835 |
| PB | 10.309 | 8.838 | 2.169 | 1.640 |
| PE | 15.738 | 16.471 | 4.326 | 5.245 |
| PI | 6.951 | 6.742 | 1.636 | 1.818 |
| PR | 16.068 | 16.658 | 3.791 | 4.019 |
| RJ | 42.543 | 43.761 | 6.024 | 7.979 |
| RN | 9.068 | 8.208 | 1.788 | 1.596 |
| RO | 4.801 | — | 1.501 | — |
| RR | 2.490 | 2.398 | 606 | 759 |
| RS | 18.360 | 17.281 | 5.771 | 5.328 |
| SC | 9.465 | 9.315 | 3.023 | 3.485 |
| SE | 5.640 | 5.616 | 1.417 | 1.320 |
| SP | 82.250 | 79.943 | 19.420 | 26.215 |
| TO | 3.145 | 3.715 | 1.034 | 1.952 |

## 5. SIAPE — registros de vínculo (PF e PRF) × FBSP

Registros do cadastro SIAPE por órgão de exercício (agregado em memória; original descartado). Não são policiais em efetivo operacional: cargo, situação, UF e identificador vêm "Sigiloso" em PF/PRF; uma pessoa pode ter registro de cargo e de função. Comparar com o FBSP serve apenas para mostrar que **são medidas diferentes**.

| Mês | PF registros | PF tipo Cargo | PRF registros | PRF tipo Cargo |
|---|---:|---:|---:|---:|
| 2020-01 | 14.846 | 13.402 | 12.019 | 11.063 |
| 2021-01 | 15.603 | 13.572 | 12.416 | 11.458 |
| 2022-01 | 15.890 | 13.855 | 13.765 | 12.704 |
| 2023-01 | 16.911 | 14.882 | 14.356 | 13.264 |
| 2024-01 | 17.192 | 15.033 | 13.959 | 13.000 |
| 2025-01 | 16.799 | 14.633 | 13.719 | 12.684 |
| 2026-01 | 16.603 | 14.111 | 14.173 | 13.129 |
| 2026-07 | 17.311 | 14.631 | 14.026 | 12.976 |
| 2026-08 | 17.253 | 14.579 | 14.000 | 12.951 |

Controle da P9 (ago/2026): PF 17.253 e PRF 14.000 — reproduzidos. FBSP 2025: PF 12.536 (abril/2025) e PRF 12.328 (março/2025). Diferença ≈ 38 % (PF) e 14 % (PRF): inclui carreiras administrativas e registros de função; **não** é crescimento de policiais.

