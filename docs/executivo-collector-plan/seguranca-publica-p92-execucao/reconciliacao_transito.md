# Reconciliação de Trânsito (P9.2)

Cada família é reconciliada contra o **seu próprio arquivo-fonte** (caches agregados de extração, ou o agregado do RENAEST preservado no RAW), de forma independente do caminho de escrita no banco. As famílias **não** são reconciliadas entre si: os universos são diferentes (ver `sobreposicao_fontes.md`).

## SIM — mortes em acidentes de transporte

- Conferência fatia a fatia (351 arquivos × 4 medidas): **1404 de 1404** idênticas ao agregado do arquivo (V01–V89, V90–V99, Y85.0 e total V01–V99). Nenhuma divergência.
- Total nacional V01–V99 por ano — residência × ocorrência (os dois universos são o mesmo conjunto de óbitos nos 27 arquivos, vistos por municípios diferentes):

| Ano | Residência | Ocorrência | Diferença |
|---|---:|---:|---:|
| 2013 | 43452 | 43452 | 0 |
| 2014 | 44823 | 44823 | 0 |
| 2015 | 39543 | 39543 | 0 |
| 2016 | 38265 | 38265 | 0 |
| 2017 | 36430 | 36430 | 0 |
| 2018 | 33625 | 33625 | 0 |
| 2019 | 32879 | 32879 | 0 |
| 2020 | 33716 | 33716 | 0 |
| 2021 | 35032 | 35032 | 0 |
| 2022 | 34892 | 34892 | 0 |
| 2023 | 35938 | 35938 | 0 |
| 2024 | 38253 | 38253 | 0 |
| 2025 | 37954 | 37954 | 0 |

- **Controles da P9 (2023, residência, V01–V99 + Y85.0)**:

| UF | P9 | Agudo V01–V99 | Sequela Y85.0 | Soma | Igual |
|---|---:|---:|---:|---:|---|
| ES | 819 | 818 | 1 | 819 | sim |
| SP | 5132 | 5111 | 21 | 5132 | sim |
| RS | 1770 | 1758 | 12 | 1770 | sim |
| MG | 3351 | 3344 | 7 | 3351 | sim |

A P9 somava V01–V99 e Y85.0; a P9.2 separa a sequela (Y85.0) do evento agudo — as duas fórmulas reproduzem exatamente os controles.

- Fatias preliminares (2025): 27. Município ignorado (residência) e óbitos sem município (ocorrência) estão em `cobertura_sim_transito.csv` e na qualidade de cada publicação.

## Senatran — frota registrada por município e tipo

- Total Brasil por competência (Σ das 27 UFs no banco) × soma da coluna TOTAL do arquivo: **165 de 165** competências idênticas. Nenhuma divergência.
- Competências publicadas: 165 (2013-01 a 2026-09), uma por mês; meses faltantes: nenhum no intervalo. Nada foi interpolado.
- TOTAL = Σ dos 21 tipos? Em 1 competência(s) o TOTAL do arquivo difere da soma dos tipos: 2013-08 (+6) — preservado como publicado.
- **Conferência independente com o arquivo "Frota por UF e Tipo"** (dezembro de cada ano e último mês): 378 de 378 pares UF × competência idênticos (Σ municípios + município ignorado = UF).
  - 2013-12: 27 UFs lidas; Brasil no arquivo 81600729; Σ UFs do arquivo 81600729; Σ banco 81600729
  - 2014-12: 27 UFs lidas; Brasil no arquivo 86700490; Σ UFs do arquivo 86700490; Σ banco 86700490
  - 2015-12: 27 UFs lidas; Brasil no arquivo 90686936; Σ UFs do arquivo 90686936; Σ banco 90686936
  - 2016-12: 27 UFs lidas; Brasil no arquivo 93867016; Σ UFs do arquivo 93867016; Σ banco 93867016
  - 2017-12: 27 UFs lidas; Brasil no arquivo 97091956; Σ UFs do arquivo 97091956; Σ banco 97091956
  - 2018-12: 27 UFs lidas; Brasil no arquivo 100746553; Σ UFs do arquivo 100746553; Σ banco 100746553
  - 2019-12: 27 UFs lidas; Brasil no arquivo 104784375; Σ UFs do arquivo 104784375; Σ banco 104784375
  - 2020-12: 27 UFs lidas; Brasil no arquivo 107948371; Σ UFs do arquivo 107948371; Σ banco 107948371
  - 2021-12: 27 UFs lidas; Brasil no arquivo 111446870; Σ UFs do arquivo 111446870; Σ banco 111446870
  - 2022-12: 27 UFs lidas; Brasil no arquivo 115116532; Σ UFs do arquivo 115116532; Σ banco 115116532
  - 2023-12: 27 UFs lidas; Brasil no arquivo 119227657; Σ UFs do arquivo 119227657; Σ banco 119227657
  - 2024-12: 27 UFs lidas; Brasil no arquivo 123974520; Σ UFs do arquivo 123974520; Σ banco 123974520
  - 2025-12: 27 UFs lidas; Brasil no arquivo 129102214; Σ UFs do arquivo 129102214; Σ banco 129102214
  - 2026-09: 27 UFs lidas; Brasil no arquivo 133337839; Σ UFs do arquivo 133337839; Σ banco 133337839
- **Identidade territorial:** os nomes de município vêm sem código IBGE; tra-xw-v1 resolve por UF + chave compacta + 48 aliases validados, sem fuzzy. "MUNICIPIO NAO INFORMADO" e nomes sem correspondência (SP "IBITIUVA", 7 meses) vão ao município ignorado da UF e **entram** na UF. Detalhes em `crosswalk_transito_ibge.csv`.

## RENAEST — sinistros e vítimas reportados

- Pacote cumulativo processado: recurso mais recente do CKAN, SHA-256 `4aa84ea561130f3125c82e36a94e523475493c66b998303f9bb179fc3d98232e`, 529020946 bytes. **O original (microdados com endereço, CEP, coordenadas, hora e atributos de vítimas) foi descartado após a agregação** (manifesto: state 3); ficou o agregado sem dado pessoal em `transito/renaest/4aa84ea561130f31_202605.agg.json.gz`.
- Linhas lidas: 8659572 sinistros (num_acidente único; qtde_acidente = 1 em todas), 13200418 linhas de vítimas, 12338582 veículos (213797 linhas de veículo sem sinistro correspondente = 2.1 % — preservadas na qualidade, não contadas).
- Agregado × banco (UF × ano × 3 medidas): **660 de 660** idênticos. Nenhuma divergência.
- Σ sinistros no banco: 8659572 (arquivo: 8659572). Óbitos nos sinistros × óbitos na tabela de vítimas: 192221 × 192221.

| Ano | UFs com registro (≥ 1 sinistro) | UFs sem registro |
|---|---:|---|
| 2018 | 25 | PA, AP |
| 2019 | 27 | — |
| 2020 | 26 | PA |
| 2021 | 26 | PA |
| 2022 | 26 | PA |
| 2023 | 25 | PA, RN |
| 2024 | 23 | PA, AP, MA, RN |
| 2025 | 23 | AM, PA, MA, RN |
| 2026 | 19 | AM, PA, AP, TO, MA, RN, AL, RS |

P9 informou 25, 27, 26, 26, 26, 25, 23, 23 UFs para 2018–2025 (contagem por "uf_acidente"); a tabela acima usa o mesmo critério sobre o pacote de 05-2026.

- **Escopo restrito a fatais (inferido: ≥ 30 sinistros e ≥ 90 % com óbito no UF × mês)**: 168 UF-meses em AM, MA, AL, SP, RS, MT. Isto é inferência a partir dos dados, não confirmação da fonte.

### Teste obrigatório — ES 2023

| Medida | Valor | Universo |
|---|---:|---|
| RENAEST — óbitos em sinistros (Σ qtde_obitos) | 972 | sinistros reportados no ES em 2023 (45369 sinistros; 901 com óbito); município do **sinistro** |
| SIM — V01–V99 por **residência** (agudo) | 818 | óbitos de residentes do ES, em qualquer lugar |
| SIM — V01–V99 + Y85.0 por **residência** | 819 | idem, com sequelas (fórmula da P9) |
| SIM — V01–V99 por **ocorrência** | 847 | óbitos ocorridos no ES, de qualquer residente |
| SIM — V01–V89 (terrestre) por residência | 810 | recorte terrestre |

A diferença **não é erro**: (a) o RENAEST conta o óbito pelo município do sinistro e vem de boletins de órgãos de trânsito/segurança, o SIM pela declaração de óbito; (b) o SIM por ocorrência (847) é a comparação de local mais próxima; (c) a janela de óbito do RENAEST (óbito no local ou registrado no sinistro) difere da causa básica do SIM, que inclui óbitos tardios e exclui os sem declaração; (d) a cobertura do RENAEST no ES muda por mês; (e) óbitos de pessoas não residentes e sequelas não coincidem. As duas séries **não** são somadas nem usadas para validar uma à outra.

## PRF — sinistros em rodovias federais (agrupados por ocorrência)

- Arquivos: 20 (um por ano, 2007–2026), links lidos da página oficial e **validados pelo conteúdo** (o ano das datas confere com o do link em todos).
- Agregado do arquivo × banco (anual, 11 medidas): **220 de 220** idênticos. Nenhuma divergência.
- Sinistros com UF informada como "(null)" no arquivo (não atribuíveis a UF, não inferidos): 2007: 5; 2008: 3; 2012: 4.
- Sinistros cujo município não concilia com o IBGE (preservados na UF, no município ignorado): 118.
- **Quebra de série em 2016:** o arquivo deixa de trazer a maior parte dos sinistros sem vítimas (ver abaixo); a série "com vítimas" (fatais + feridas) é a única comparável de 2007 a 2026.

| Ano | Sinistros | Sem vítimas | Com vítimas (fatais + feridas) |
|---|---:|---:|---:|
| 2007 | 127666 | 75435 | 51794 |
| 2008 | 141035 | 85227 | 55218 |
| 2009 | 158646 | 97066 | 60848 |
| 2010 | 183465 | 113116 | 69357 |
| 2011 | 192322 | 118744 | 72413 |
| 2012 | 184557 | 112419 | 70764 |
| 2013 | 186745 | 114052 | 71155 |
| 2014 | 169197 | 98310 | 69216 |
| 2015 | 122158 | 58409 | 62221 |
| 2016 | 96362 | 34478 | 60227 |
| 2017 | 89567 | 30683 | 58883 |
| 2018 | 69333 | 15253 | 54079 |
| 2019 | 67558 | 11683 | 55874 |
| 2020 | 63585 | 11602 | 51981 |
| 2021 | 64567 | 11691 | 52875 |
| 2022 | 64606 | 11506 | 53099 |
| 2023 | 67766 | 10963 | 56802 |
| 2024 | 73202 | 11782 | 61419 |
| 2025 | 72529 | 11138 | 61390 |
| 2026 | 48712 | 7556 | 41155 |

## Senatran — infrações com notificação de penalidade (UF de jurisdição do veículo)

- Competências: 93 (2019-01 a 2026-09); layouts encontrados: wide 51, long 42 (UTF-16 largo, largo com aspas duplicadas, longo com colunas em ordem variável, XLSX com linhas de título).
- Total do arquivo × banco: **93 de 93** competências idênticas. Nenhuma divergência.
- Arquivos com coluna "TOTAL" própria (excluída da carga para não contar duas vezes): 1; coluna TOTAL ≠ Σ das 27 UFs em: nenhum.
- Cada arquivo traz as 27 UFs; células vazias da matriz (UF × código) permanecem sem linha (não são zero declarado).
- **A UF é a de jurisdição do veículo**, não o local da infração. Série irregular de 2020 (abril a novembro com 0,23–1,08 milhão de notificações contra ≈ 6 milhões em 2019) e dois vales em 2021 estão nos arquivos oficiais e foram preservados; a razão não consta na fonte.

## Incompatibilidades de universo (resumo)

- SIM (óbitos) × RENAEST (sinistros reportados) × PRF (rodovias federais) × frota (veículos registrados) × infrações (UF de jurisdição) medem coisas diferentes. Nenhum total entre famílias foi calculado. Ver `sobreposicao_fontes.md`.
- O RENAEST não tem identificador comum com a PRF: sobreposição não resolvida; nada foi deduplicado nem somado.
