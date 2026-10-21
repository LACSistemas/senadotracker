# Cívica — P8: Investigação nacional de indicadores de saúde pública

**Viabilidade técnica, cobertura territorial, granularidade, histórico, qualidade dos dados e potencial de implementação**

Data: 2026-10-19 · Branch `post-migration` · Natureza: investigação (nenhum collector, migração, backfill, alteração de banco ou de frontend foi feito; sem commit/push).
Entregáveis: este relatório, `investigacao_executivo_p8_saude_fontes.json` e `investigacao_executivo_p8_saude_indicadores.csv` (separador `;`, UTF-8 com BOM, aberto direto no Excel).

---

## 1. Resumo executivo

**Veredito.** Dos 20 indicadores da planilha, **14 têm extração pública comprovada por teste real** (11 plenos ou com ressalvas e 3 parciais/a validar), **1 depende de uma rota SIOPS que não consegui comprovar**, **2 exigem integração com sistemas locais** e **3 são inviáveis com dado público**. Nenhum fica "somente estadual": todos os 14 comprovados chegam ao município. Para 8 deles (cobertura de APS, leitos, vacinação, mortalidade infantil, mortalidade materna, ICSAP, pré-natal e cesáreas) medi a cobertura nacional completa; para os 5 financeiros (gasto per capita, execução, evolução, restos a pagar, pessoal), a prova é uma amostra aleatória de 150 municípios (150/150) mais 14 municípios escolhidos, não os 5.570.

| Pergunta | Resultado comprovado |
|---|---|
| Quantos dos 20 indicadores podemos obter? | **14** (01, 02*, 05, 07, 08, 09*, 10, 11, 12, 16, 17, 18*, 19, 20; *parcial/a validar) |
| Quantos em nível municipal? | **14** (8 com cobertura nacional medida; 6 com prova amostral: 02 em 1 UF×1 mês; 16, 17, 18, 19 e 20 em 150 municípios) |
| Quantos somente estadual? | **0** |
| Quantos exigem integração local? | **2** (03 absenteísmo, 04 tempo de espera) |
| Quantos são inviáveis com dados públicos? | **3** (06 ocupação de leitos, 13 resolutividade, 14 satisfação) |
| Sem rota comprovada | **1** (15 aplicação de recursos em saúde — SIOPS) |
| Quantos têm histórico desde 2013 (recuperado em teste)? | **6** (05, 08, 09, 10, 11, 12) |
| Quantos têm atualização mensal? | **4** (01, 02, 05, 10) |
| Quantos dependem de mais de uma fonte? | **9** (02, 05, 06, 08, 09, 10, 15, 16, 18) |
| Municípios com **todos** os indicadores essenciais observados* | **5.569** de 5.571 (**3.184** se exigir ≥100 nascidos no ano, para evitar números instáveis) |
| Estabelecimentos detalháveis | **501.726** no CNES (131.831 com vínculo SUS; 6.636 hospitais em 3.159 municípios) |
| Armazenamento do MVP (PostgreSQL) | **A: 0,42 GiB · B: 1,97 GiB · C: 12,5 GiB** (+ objetos: 4,7 / 5,0 / 19,0 GiB) |
| Primeiros collectors | (1) SIM/SINASC/PNI por FTP e parquet; (2) CNES por FTP; (3) cobertura de APS (e-Gestor); (4) SIH-RD com ICSAP; (5) Siconfi com formulários simplificados; (6) descoberta do SIOPS |
| Exigem revisão metodológica | 01, 02, 06, 07, 08, 09, 10, 11, 12, 15, 18 (e rotular 20 como "pessoal do Executivo") |

\* essenciais = 01 (cobertura APS), 05 (leitos), 07 (BCG 2025), 08 (mortalidade infantil), 10 (ICSAP, jun/2024), 11 (pré-natal), 12 (cesáreas). "Observado" significa que existe valor; não significa que o valor seja estatisticamente estável.

**Achados que mudam decisões anteriores (P0–P7 e plano diretor):**

1. **SIM e SINASC pelo DEMAS não servem; o FTP do DATASUS serve.** O endpoint de SINASC do DEMAS segue com 0 linhas e o de SIM não filtra por município. Os arquivos `DO{UF}{ANO}.dbc` e `DN{UF}{ANO}.dbc` (1996–2024 definitivo, 2025–2026 preliminar) permitem o cálculo completo por município de residência.
2. **A cobertura vacinal já existe pronta por município**: `Cobertura_Residencia.parquet` (5,1 MB, 1.088.479 linhas, 2015–2026). Não é preciso reconstruir a partir das doses individuais.
3. **A cobertura de APS tem API pública por município** (a usada pelo portal e-Gestor), mas com **quebra metodológica em 2021** e valores acima de 100%.
4. **O Siconfi não serve o Anexo 12 (ASPS) nem o 8 (MDE).** O "% aplicado em saúde" depende do SIOPS, cuja API pública não consegui enumerar.
5. **Parte dos municípios entrega RREO e RGF Simplificados** (64 de 150 na amostra aleatória, 43%). Um collector que só leia o formulário padrão perde essa parcela; o simplificado é opcional (Borá, com 935 habitantes, usa o padrão).
6. **O CNES tem 501.726 estabelecimentos** (o plano diretor usava 330 mil como referência externa) e **a população-base oficial da APS (DOU) difere da do IBGE**.
7. **O IBGE lista 5.571 municípios** (um novo, sem nascidos em 2024); as fontes de saúde cobrem 5.570. O "5.570" deve ser tratado como constante fraca.
8. **Correção de identificação:** em relatórios anteriores a amostra "Alto Rio Novo" pode ter sido associada ao código 320040; o código correto é **320035** (320040 é Anchieta). Todos os números de Alto Rio Novo neste relatório usam 320035.

---

## 2. Escopo e metodologia

- **Planilha de referência.** `monitoramento-indicadores-saude-municipal.xlsx` **não está no repositório** (busca por nome em todo o projeto). Na sessão, a pessoa responsável colou o texto da planilha: os 20 indicadores, descrições e fontes batem com a lista da missão. O texto colado **não traz metas, benchmarks nem classificações**; os benchmarks avaliados na seção 23 são os reproduzidos na missão. A planilha não foi modificada.
- **Leitura prévia.** P0–P7 e plano diretor (`catalogo_fontes_collectors.json`, 113 datasets, 55 collectors). IDs `SAU-*`, `FIN-SICONFI-*`, `TER-*` e `EXEC-C*` foram reutilizados. Foram criados apenas 2 IDs de dataset novos (`SAU-APS-COBERTURA`, `SAU-SIAPS-ATEND`) e 5 de fonte (marcados `NEW` no JSON).
- **Testes executados** (todos de leitura; ver seção 32): 24 testes registrados (IDs TST-P8-01…26; os números 06 e 07 foram incorporados a outros testes) com download real do FTP do DATASUS (≈0,5 GB de DBC lidos em cache local), APIs JSON do DEMAS, e-Gestor, Siconfi, IBGE, TabNet (POST) e leitura de textos legais. Nada foi gravado em banco.
- **Convenções.** Município = código IBGE de 6 dígitos nas fontes de saúde e 7 dígitos no Siconfi/IBGE. Residência (não ocorrência) é a base de todos os indicadores epidemiológicos. Ausência de registro nunca foi tratada como zero: município sem leito no CNES aparece como "sem leito registrado".
- **Ano de referência dos testes.** Epidemiologia: 2024 (último definitivo). Leitos/estabelecimentos: competência 2026-09. Vacinação: 2025 (2026 parcial). Finanças: exercício 2024. APS: competência 2026-08.
- **Escopo excluído.** Nenhuma pontuação de desempenho de prefeitos ou governadores; nenhum semáforo.

---

## 3. Auditoria da planilha

Texto recebido (20 indicadores) × achados:

| # | Item da planilha (fonte citada) | Auditoria |
|---|---|---|
| 01 | Cobertura AB/ESF — e-Gestor AB/SISAB | OK; a metodologia mudou em 2021 (AB→APS). |
| 02 | Consultas médicas/hab — SIA/SUS | SIA não contém a atenção primária; precisa SIAPS/e-SUS. |
| 03 | Absenteísmo — sistema municipal | Correto: não há fonte nacional. |
| 04 | Tempo de espera — regulação municipal | Correto: não há fonte nacional; "tempo médio" deve virar mediana e percentis. |
| 05 | Leitos/1.000 — CNES | OK; definir leito de internação vs complementar vs hospital-dia. |
| 06 | Ocupação — CNES/AIH | Fontes insuficientes: AIH não mede ocupação. |
| 07 | Cobertura vacinal — SI-PNI | OK; cobertura = doses/população-alvo, não indivíduos. |
| 08 | Mortalidade infantil — SIM/SINASC | OK. |
| 09 | Mortalidade materna — SIM/SINASC | OK; instável em municípios. |
| 10 | ICSAP — AIH/SUS | OK; "evitáveis" no título da planilha não é a nomenclatura da Portaria 221/2008 (condições sensíveis). |
| 11 | Pré-natal ≥6 — SISPREN/SINASC | SISPRENATAL foi descontinuado (FTP vai de 2012 a 2014); usar SINASC. |
| 12 | Cesáreas — SINASC | OK. |
| 13 | Resolutividade — e-Gestor/avaliação municipal | Sem definição nacional nem dado público de desfecho. |
| 14 | Satisfação — pesquisas municipais | Sem instrumento nacional vigente. |
| 15 | Aplicação em saúde — SIOPS | Descrição "receita de impostos" é incompleta: a base legal inclui transferências constitucionais (LC 141 arts. 6º/7º). |
| 16 | Gasto per capita — SIOPS | Alternativa comprovada: Siconfi (função Saúde); não é ASPS. |
| 17 | Execução — "RREO" (a missão cita SIOPE) | SIOPE é Educação (FNDE); a fonte é Siconfi RREO/DCA ou SIOPS. |
| 18 | Despesa × receita — RREO/RGF | Numerador, denominador e deflator indefinidos. |
| 19 | Restos a pagar — demonstrativos/SIOPS | Siconfi RREO Anexo 02 e DCA I-E/I-G. |
| 20 | Pessoal — RGF | É pessoal do Executivo, não da Saúde. |

A "classificação" (eficiência operacional, qualidade assistencial, saúde financeira) é uma divisão editorial; os sete + sete + seis indicadores foram mantidos.

---

## 4. Fontes oficiais de Saúde

| ID | Catálogo | Fonte | Rota testada | Estado | Testes |
|---|---|---|---|---|---|
| SRC-DATASUS-SIM | EXISTENTE | SIM — Declarações de Óbito (DO) por UF e ano | FTP + DBC (blast) → DBF | VERIFIED_DATASET | TST-P8-01, TST-P8-02 |
| SRC-DATASUS-SINASC | EXISTENTE | SINASC — Declarações de Nascido Vivo (DN) por UF e ano | FTP + DBC → DBF | VERIFIED_DATASET | TST-P8-01, TST-P8-02 |
| SRC-DATASUS-SIH | EXISTENTE | SIH-RD — AIH reduzida por UF e mês | FTP + DBC | VERIFIED_DATASET | TST-P8-08, TST-P8-09 |
| SRC-DATASUS-SIA | EXISTENTE | SIA-PA — Produção ambulatorial por UF e mês | FTP + DBC | VERIFIED_DATASET | TST-P8-10 |
| SRC-DATASUS-CNES-FTP | NEW | CNES via FTP: ST, LT, EQ, PF, SR, EP, HB por UF e competência | FTP + DBC | VERIFIED_DATASET | TST-P8-03, TST-P8-04, TST-P8-05 |
| SRC-DEMAS-CNES | EXISTENTE | DEMAS: CNES (estabelecimentos, leitos, equipamentos, profissionais, serviços) | API REST JSON (limit/offset) | VERIFIED_API | TST-P8-25 |
| SRC-DATASUS-PNI | EXISTENTE | SI-PNI — cobertura vacinal por residência (parquet) e TabNet | FTP (arquivo único) + POST TabNet | VERIFIED_DATASET | TST-P8-13, TST-P8-14 |
| SRC-EGESTOR-APS | NEW | e-Gestor AB — Relatórios Públicos da APS (API do front) | API REST JSON (rotas extraídas do bundle do SPA relatorioaps.saude.gov.br) | VERIFIED_API | TST-P8-11, TST-P8-12 |
| SRC-DEMAS-SISAB | EXISTENTE | DEMAS: Indicadores de desempenho Previne Brasil (SISAB) | API REST JSON | VERIFIED_API | TST-P8-15 |
| SRC-DEMAS-SIAPS | NEW | DEMAS: SIAPS — atendimento individual (MIAI), agregado | API REST JSON | VERIFIED_API | TST-P8-16 |
| SRC-SIOPS | EXISTENTE | SIOPS — consulta pública | NÃO COMPROVADA (rotas da API pública não enumeráveis; app novo exige login; PHP legado respondeu "não transmitiu") | NOT_ENUMERABLE | TST-P8-19 |
| SRC-SICONFI | EXISTENTE | Siconfi/Tesouro — API de dados (RREO, RGF, DCA) | API REST JSON | VERIFIED_API | TST-P8-17, TST-P8-18, TST-P8-20 |
| SRC-IBGE-SIDRA | EXISTENTE | IBGE SIDRA — estimativas de população (tabela 6579) e Censo 2022 (9514) | API REST JSON | VERIFIED_API | TST-P8-21 |
| SRC-IBGE-LOC | EXISTENTE | IBGE Localidades — municípios | API REST JSON | VERIFIED_API | TST-P8-21 |
| SRC-DATASUS-SIGTAP | NEW | Tabela Unificada SUS (SIGTAP) mensal | FTP ZIP (layout posicional) | VERIFIED_DATASET | TST-P8-10 |
| SRC-REF-PORTARIA-SAS-221 | NEW | Portaria SAS/MS nº 221/2008 — Lista Brasileira de ICSAP | HTTP (HTML) | VERIFIED_DATASET | TST-P8-09 |
| SRC-REF-LC141 | NEW | LC 141/2012 (ASPS), texto com redação da LC 227/2026 | HTTP (HTML) | VERIFIED_DATASET | TST-P8-22 |
| SRC-REF-LRF | NEW | LC 101/2000 (LRF), arts. 19 e 20 | HTTP (HTML) | VERIFIED_DATASET | TST-P8-22 |
| SRC-DEMAS-BNAFAR | EXISTENTE | DEMAS: estoque de medicamentos BNAFAR/Hórus | API REST JSON | VERIFIED_API | — |

URLs completas e observações por fonte estão em `investigacao_executivo_p8_saude_fontes.json`. As APIs do e-Gestor e do DEMAS são APIs de portal sem contrato publicado; devem ser tratadas como instáveis e cobertas por testes de contrato no collector.

---

## 5. Capacidade assistencial (CNES)

**Rota recomendada: FTP (arquivos DBC por UF e competência).** O DEMAS tem os mesmos conjuntos, mas sem varredura nacional comprovada.

| Conjunto | Evidência |
|---|---|
| ST (estabelecimentos) 2026-09 | 501.726 registros, 5.571 municípios, 114 campos; 131.831 com vínculo SUS (`VINC_SUS=1`); UBS (TP_UNID 02): 43.841 em 5.469 municípios; hospitais gerais+especializados (05, 07): 6.636 em 3.159 municípios |
| LT (leitos) 2026-09 | 51.965 linhas CNES×tipo/código; 543.524 leitos existentes; SUS 362.715; não SUS 180.809; `QT_EXIST = QT_SUS + QT_NSUS` em 100% das linhas |
| EQ / PF / SR / EP (ES) | 26.875 / 145.836 / 23.595 / 2.552 linhas; escala nacional ≈ ×48,9 |
| Competências | 200508–202609 listadas; ES recuperado em 2013-01, 2018-12, 2023-01 e 2026-09 |

Cuidados: cadastro autodeclarado; `DT_ATUAL` contém datas futuras (até 2027-04) e 72.955 registros com atualização anterior a 2023; coordenadas só no DEMAS; profissionais carregam nome/identificação (DEMAS) e devem ser agregados por município × CBO antes de gravar.

---

## 6. Atenção primária

**Cobertura (IND-SAU-01).** API `relatorioaps-prd.saude.gov.br` (rotas extraídas do bundle do SPA do portal). Em 2026-08, 27 chamadas (uma por UF) devolvem 5.570 municípios em 36 s. Campos: população-base (`qtPopulacao`, origem DOU, ano de referência 2025), equipes por tipo, `qtCapacidadeEquipe` e `qtCobertura`. A fórmula foi verificada: Vitória 346.500 / 343.378 = 100,9%. **A cobertura não é truncada**: 4.755 municípios passam de 100% (mediana 148,8%; máximo 408,9%).

**Quebra metodológica.** `/cobertura/ab` (campos `pcCoberturaAb`, `pcCoberturaSf`) responde de 201912 a 202012 e devolve 0 linhas depois; `/cobertura/aps` responde de 202112 e devolve 0 linhas antes. Vitória: AB 92,28% (202001); APS 92,46% (202112), 89,44% (202212), 101,55% (202301), 104,02% (202312), 107,26% (202412), 101,05% (202512), 100,9% (202608). As séries antes/depois não são comparáveis. Competências 202511 e 202601 não constam da lista da API.

**Previne Brasil (SISAB, DEMAS).** Só 2024Q1–Q3 foram localizados: 2024Q3 tem 100.242 linhas (5.570 municípios × 6 códigos × 3 visões). O campo `percentual` não é numerador/denominador (mediana 92 vs 58,8 do cálculo direto) e o dicionário de códigos (10, 20, 30, 40, 50, 70) **não foi localizado**; o significado não deve ser assumido. O SISAB legado (`sisab.saude.gov.br`) respondeu HTTP 500 no relatório de cobertura.

**SIAPS (atendimento individual).** Agregado por categoria profissional/CID/tipo de atendimento. Só a competência 202512 devolveu dados (Vitória: 100.992 registros, 49.829 de médicos); 202101, 202312, 202412, 202506 e 202603 devolveram 0 linhas.

---

## 7. Consultas e produção ambulatorial

SIA-PA ES 2024-06 (33 MB): **1.109.849 linhas**, 59 campos, 1.067 estabelecimentos. Consultas médicas por quantidade aprovada: 0301010072 (atenção especializada) **210.799**; 0301010064 (atenção primária) **18.308**; 0301010056 (saúde do trabalhador) 533; 0301010307 (teleconsulta especializada) 2.304 — total 231.944. Para ~4,15 mi de habitantes (IBGE 2026) isso dá ≈0,7 consultas/hab/ano: **subestimado**, porque a atenção primária está no e-SUS, não no SIA. Procedimentos não médicos (0301010048: 143.350; 0301010030: 21.429) e urgência em UPA (0301060096: 204.606) não são consulta médica. `PA_QTDPRO` (apresentada) difere de `PA_QTDAPR` (aprovada): 214.854 vs 210.799 para 0301010072. `PA_MUNPCN` permite atribuir ao município do paciente.

Nomes dos procedimentos vêm do SIGTAP (Tabela Unificada, 5.039 procedimentos, layout posicional decodificado).

---

## 8. Leitos e ocupação

**Leitos por 1.000 habitantes (IND-SAU-05)**, CNES 2026-09, excluindo hospital-dia (TP_LEITO 7): **2,47** (SUS 1,66); total com hospital-dia 543.524 leitos. 3.605 municípios têm ≥1 leito; **1.966 não têm leito registrado** (municípios sem hospital, não dado faltante: 2.411 dos 2.412 municípios sem hospital no CNES têm AIH de residentes em jun/2024, todas atendidas fora). Vitória 6,48; Recife 7,01; Belo Horizonte 4,70; São Paulo 3,13; Alto Rio Novo 0. Por UF: de 1,80 (AM) a 3,50 (RO) e 3,37 (DF). Denominador: população IBGE 2026 (214.211.951).

**Ocupação (IND-SAU-06): não calculável.** Seria pacientes-dia ÷ leitos-dia operacionais. Disponíveis: leitos *existentes* (CNES) e dias de permanência das AIH SUS (SIH, na competência de saída). Apenas como auditoria, testei o proxy "Σ DIAS_PERM ÷ (leitos SUS × 366)" no ES 2024: 69 hospitais com ≥20 leitos SUS, mediana 53%, p10 11%, p90 88%. **Não é um indicador de ocupação** (exclui pacientes não SUS, UTI e leitos não operacionais) e não deve ser publicado. O DEMAS só publica ocupação diária para COVID-19.

---

## 9. Vacinação

Rota: `Cobertura_Residencia.parquet` (5,1 MB). Campos: `CO_ANO`, `CO_UF`, `CO_MUNICIPIO` (6 dígitos), `NU_IMUNO`, `QT_DOSE`, `NU_POPULACAO`, `NU_TAXA_COBERTURA` (fração). 1.088.479 linhas; 2015–2026; **36 rótulos** de imunobiológico/dose (ex.: "Hepatite B (≤30 dias)" aparece em 5 grafias; "Pneumo 10", "Pneumo 20" e "Pneumocócica Conjugada" coexistem); carga em 01/07/2026, logo 2026 é parcial. Municípios por ano: 5.570 (2021–2022) e 5.571 (2023–2026).

Regra oficial (PDF `Regrascobertura2013`, lido): *cobertura = doses aplicadas ÷ população na idade-alvo × 100*; denominador = SINASC; a dose que conta (D3, DU, reforço) varia por período. É **cobertura de doses**, não proporção de indivíduos vacinados.

Validação cruzada: Vitória, BCG 2022 = 55% no parquet e **55,1%** no TabNet (POST `webtabx.exe`, Linha=Município, Coluna=Ano). Sinal de alerta: Vitória BCG 142% (2017), 124% (2019), 91% (2021), 55% (2022). No BCG 2025, {f(bcg25_gt,0)}% dos {f(bcg25_n,0)} municípios ficam acima de 100% (denominador SINASC por residência vs doses por local); no TabNet 2022, 2.303 de 5.569 (41%).

O `Doses_Residencia.parquet` (1,17 GB) não foi baixado; as doses individuais do DEMAS (`doses-aplicadas-pni-AAAA`) são microdados (paciente, estabelecimento) e **não devem ser armazenados**.

---

## 10. Mortalidade infantil

Cálculo reproduzido para o Brasil em 2024 (54 arquivos DBC, 27 UFs): **30.020 óbitos <1 ano ÷ 2.389.325 nascidos vivos = 12,56‰**, ambos por `CODMUNRES`, mesmo ano. Numerador: `TIPOBITO=2` e `IDADE` iniciando em 0, 1, 2 ou 3 (minutos, horas, dias, meses). Denominador: uma linha por DN.

| Verificação | Resultado |
|---|---|
| Municípios com nascidos em 2024 | 5.570 de 5.571 (IBGE); 14 códigos adicionais de "município ignorado" (xx0000) |
| Municípios com <100 nascidos | 2.387 (523 com <30) |
| Códigos sem nenhum óbito infantil | 1.575 |
| ES: Σ municipal vs UF | 609 óbitos vs 610 por UF (um óbito sem município de residência) → a soma municipal ≠ total da UF |
| Óbitos infantis fora do município de residência | 48,6% |
| Nascidos fora do município de residência | 34,5% |
| UFs (‰) | 10,2 (RS) a 19,1 (AP) |
| Vitória / SP / Recife / BH | 10,6 / 11,2 / 11,9 / 10,7 |
| Alto Rio Novo (90 nascidos, 2 óbitos) | 22,2 — um caso muda o valor em 11 pontos |

Histórico: arquivos 1996–2024 (recuperados ES 1996, 2000, 2013, 2022; Brasil 2024). 2025–2026 são **preliminares** (pastas `PRELIM`). Em `SINASC/NOV/DNRES` o definitivo termina em 2022; 2023 e 2024 estão em `SINASC/1996_/Dados/DNRES`.

---

## 11. Mortalidade materna

Definição aplicada no teste: `CAUSABAS` O00–O95 e O98–O99, `SEXO=2` (exclui causas obstétricas tardias O96/O97). Brasil 2024: **1.326 óbitos → 55,5 por 100 mil NV**; 798 municípios com ≥1 óbito; **4.786 sem nenhum**; 5.183 com <1.000 nascidos. A definição oficial (que também considera outras causas, investigação e campos `TPMORTEOCO`/`OBITOGRAV`/`OBITOPUERP`) **não foi reproduzida**: por isso `NEEDS_VALIDATION`. Em município, a taxa anual é ruído; só agregações regionais e plurianuais são defensáveis.

---

## 12. Internações por condições sensíveis à atenção primária (ICSAP)

Lista oficial da **Portaria SAS/MS 221/2008** (HTML da BVS lido): 19 grupos, 117 códigos de 3 dígitos e 71 de 4 dígitos (ex.: E10.0–E10.8, A15–A16, A17.1–A17.9, J15.3/.4/.8/.9, J18.1, N39.0, K92.0–K92.2, O23, P35.0). Aplicada a `DIAG_PRINC` do SIH-RD.

| Medida | Resultado |
|---|---|
| Brasil jun/2024 (27 UFs) | 1.188.890 AIH (1.188.340 `N_AIH` únicos), R$ 1,97 bi, 53.714 óbitos hospitalares, **ICSAP 15,8%** |
| ES 2024 (12 meses) | 307.500 AIH, R$ 533,4 mi, 47.561 ICSAP (15,5%), 54,6% das internações de residentes fora do município |
| Residentes do ES, jun/2024 | 25.915 nos arquivos nacionais vs 25.651 no arquivo RDES (−1,0%): residência exige os 27 arquivos |
| UFs (jun/2024, % ICSAP) | SP 14,1 · PE 14,9 · MG 17,4 · RR 23,0 · MT 14,1 · RS 17,3 |
| Municípios com ≥1 AIH de residente | 5.570/5.571 |
| Alto Rio Novo, ES 2024 | {f(len(arn),0)} AIH de residentes, {arn_ic} ICSAP, {f(arn_fora,0)}% atendidas fora do município |

Limitações: só internações pagas pelo SUS; população por idade necessária para taxa padronizada (o endpoint SVSA do DEMAS devolveu 0 linhas; o Censo 2022 via SIDRA 9514 é alternativa não implementada); a lista é de 2008; não chamar de "internações evitáveis" (a Portaria fala em condições sensíveis). Layout do SIH-RD mudou: 86 campos (2008-01), 95 (2013-01), 113 (2020+).

---

## 13. Pré-natal e cesáreas

**Cesáreas (IND-SAU-12).** `PARTO=2` entre os partos com tipo informado: **60,6%** (Brasil 2024); mediana municipal 65,0% (0–100%); `PARTO` ignorado em 1.173. Vitória 59,9%, SP 52,9%, Recife 49,6%, BH 47,1%. `TPROBSON` (grupo de Robson) está no SINASC e permite padronizar. 34,5% dos nascidos têm município de residência diferente do de parto.

**Pré-natal ≥6 (IND-SAU-11).** `CONSPRENAT` (número de consultas) é preenchido de forma válida em 98,4% dos nascidos (ignorado 99: 6.749; branco: 30.516). Entre os válidos, **87,5%** têm ≥6. O campo categórico `CONSULTAS` (1 nenhuma, 2 de 1–3, 3 de 4–6, 4 de 7+, 9 ignorado — layout a confirmar no dicionário) **não separa 6 de 4–5**; por isso é preciso `CONSPRENAT`, presente a partir de 2011–2013 (ausente em 1996 e 2000). O DN registra consultas **declaradas**, não produção da APS. SISPRENATAL foi descontinuado (FTP de 2012 a 2014). A recomendação de 6 consultas deve ser revalidada pelo especialista (a OMS passou a recomendar 8 contatos).

---

## 14. Resolutividade, satisfação, espera e absenteísmo

- **Resolutividade (13):** não existe definição nacional localizada; o SIAPS agregado não tem campo de encaminhamento ou desfecho. `NOT_FEASIBLE_WITH_PUBLIC_DATA`.
- **Satisfação (14):** o PMAQ-AB (módulo III, ciclos 2012–2018) é a referência acadêmica; não encontrei microdados nem instrumento nacional vigente. A Ouvidoria (`ouvidoria/ouvidor2|3` no DEMAS) mede manifestações e **não deve ser convertida em satisfação**. `NOT_FEASIBLE_WITH_PUBLIC_DATA`.
- **Tempo de espera (04) e absenteísmo (03):** nenhuma base nacional. Existem painéis subnacionais (Rio Grande do Sul — Painel de Dados da Regulação, Porto Alegre, e o Mapa Social da Saúde do MPDFT sobre SISREG), **que não extraí**. `LOCAL_INTEGRATION_REQUIRED`.

---

## 15. Aplicação financeira em Saúde (IND-SAU-15, 16)

**Base legal** (LC 141/2012, texto com redação da LC 227/2026, lido): Municípios aplicam no mínimo **15%** (art. 7º) e Estados **12%** (art. 6º) da receita de impostos e transferências definidas; o art. 7º inclui também o DF e o art. 8º trata do DF: leitura jurídica necessária.

**Extração do percentual apurado: não comprovada.** (i) A API pública do SIOPS responde 404 em `/swagger-ui/`, `/v3/api-docs`, `/v2/api-docs` e devolve `[]` em `/swagger-resources`; (ii) o app novo (`siops.saude.gov.br`) aponta para APIs de gestor/relatório com login; (iii) o PHP legado `rel_LRF.php` respondeu "O Municipio mun – mun não transmitiu os dados" ao meu POST, o que indica parâmetros incorretos, não ausência de dado; (iv) o Siconfi **não serve** RREO Anexo 12 (nem 8) para Vitória, São Paulo, Recife, Belo Horizonte, ES-UF e SP-UF. Anexos servidos: 01, 02, 03, 04, 06, 07, 09, 10-RPPS, 11, 13, 14.

**Despesa de Saúde per capita (16).** Vitória, 2024: empenhado R$ 503,0 mi ÷ 331.785 hab. (população do Siconfi) = **R$ 1.516/hab**. Amostra aleatória de 150 municípios: mediana **R$ 1.242** (p10 493; p90 2.276). É despesa da **função** Saúde: inclui todas as fontes e não é ASPS; somar entes duplicaria transferências.

---

## 16. Execução orçamentária da Saúde (IND-SAU-17)

Fonte aplicável é o **Siconfi (RREO Anexo 02, DCA I-E)** ou o SIOPS — **não o SIOPE**, que é de Educação. Vitória 2024 (função Saúde): dotação atualizada R$ 546,5 mi; empenhado 503,0 mi (**92,0%**); liquidado 457,5 mi (**83,7%**); pago 447,8 mi (**82,0%**, só no DCA); RPNP inscritos 45,5 mi; RPP inscritos 9,6 mi. Colunas do RREO Anexo 02: dotação inicial e atualizada, empenhadas e liquidadas no bimestre e até o bimestre, saldos, % do total e inscritas em RPNP. **Pago por função só aparece no DCA (anual).**

**Evolução despesa × receita (18).** Insumos existem (Anexos 01 e 02, RCL no RGF), mas faltam: definição da receita de referência, deflator (não testado) e o sentido da leitura. `NEEDS_VALIDATION`.

---

## 17. Restos a pagar e pessoal (IND-SAU-19, 20)

**Restos a pagar (19).** DCA I-G (restos a pagar por função), Vitória 2024, `10 - Saúde`: RPNP inscritos em exercícios anteriores 3,47 mi; inscritos em 31/12 do ano anterior 47,39 mi; liquidados/pagos 35,42 mi; cancelados 13,71 mi; RPP inscritos 6,78 mi, pagos 6,14 mi, cancelados 0,66 mi. Resto a pagar não é inadimplência. Só um município foi testado no I-G.

**Pessoal (20).** RGF Anexo 01, `co_poder=E`: Vitória 2024-Q3 DTP **41,53%** da RCL ajustada; limite máximo **54%**, prudencial 51,3%, alerta 48,6%. É a despesa total com pessoal **do Poder Executivo**, nunca da Saúde. LRF (lida): art. 19, limites globais União 50%, Estados 60%, Municípios 60%; art. 20, Executivo municipal 54% e Legislativo 6%; Executivo estadual 49%. Na amostra aleatória (n=150): mediana 43,9%, mínimo 29,7%, máximo 77,4%; **9 municípios acima de 54%** e 7 acima de 60%.

---

## 18. Cobertura municipal

**Medida em escala nacional (5.571 municípios do IBGE):**

| Indicador | Municípios com valor | Observação |
|---|---|---|
| 01 Cobertura APS (2026-08) | 5.570 | 1 município novo sem linha |
| 05 Leitos (2026-09) | 5.571 com estabelecimento CNES; 3.605 com leito | 1.966 sem leito (sem hospital), não ausentes |
| 07 Vacinação (2025) | 5.571 | BCG: {f(bcg25_gt,0)}% acima de 100% |
| 08 Mortalidade infantil (2024) | 5.570 | 2.387 com <100 nascidos |
| 09 Mortalidade materna (2024) | 5.570 | 4.786 sem óbito |
| 10 ICSAP (jun/2024) | 5.570 | AIH de residentes |
| 11 Pré-natal ≥6 (2024) | 5.570 | CONSPRENAT válido em 98,4% |
| 12 Cesáreas (2024) | 5.570 | |
| 16–20 Finanças (2024) | amostra 150/150 (+14) | cobertura nacional não medida; 43% usam formulário simplificado |
| 03, 04, 06, 13, 14 | 0 | ver seções 8 e 14 |

**Amostras territoriais (14 municípios):**

| Município | Perfil | Pop. 2026 | Nascidos 2024 | Mort. inf. ‰ | RMM /100 mil | Cesárea % | Pré-natal ≥6 % | Leitos /1.000 | Hosp. CNES | Cob. APS % | ICSAP % (jun/24) | BCG 2025 % | Saúde R$/hab emp. 2024 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Vitória/ES (320530) | ES capital (hospital) | 343.935 | 3.498 | 10,6 | 28,6 | 59,9 | 89,6 | 6,48 | 22 | 100,9 | 14,6 | 95 | 1.516 |
| Alto Rio Novo/ES (320035) | ES pequeno, sem hospital (05/07) | 7.772 | 90 | 22,2 | instável | 63,3 | 80,9 | 0,00 | 0 | 180,4 | 8,3 | 110 | RREO Simplificado |
| São Paulo/SP (355030) | SP capital | 11.911.337 | 120.789 | 11,2 | 29,0 | 52,9 | 91,2 | 3,13 | 230 | 59,5 | 13,1 | 84 | 1.865 |
| Caçapava/SP (350850) | SP médio (~100 mil) | 100.422 | 887 | 10,1 | instável | 67,1 | 92,2 | 2,37 | 5 | 72,6 | 19,3 | 93 | 1.530 |
| Borá/SP (350720) | SP menor município | 935 | 4 | 250,0 | instável | 100,0 | 100,0 | 0,00 | 0 | 187,8 | 8,3 | 175 | 6.428 |
| Recife/PE (261160) | PE capital | 1.588.983 | 16.116 | 11,9 | 68,3 | 49,6 | 83,7 | 7,01 | 85 | 89,0 | 16,2 | 130 | 1.297 |
| Cabo de Santo Agostinho/PE (260290) | PE médio (~220 mil) | 219.044 | 2.435 | 13,1 | 164,3 | 52,5 | 83,7 | 1,89 | 9 | 86,3 | 14,2 | 55 | 1.097 |
| Belo Horizonte/MG (310620) | MG capital | 2.415.451 | 21.530 | 10,7 | 37,2 | 47,1 | 90,2 | 4,70 | 63 | 92,6 | 18,2 | 102 | 2.505 |
| Serra da Saudade/MG (316660) | MG menor município | 857 | 5 | 0,0 | instável | 60,0 | 100,0 | 0,00 | 0 | 408,9 | 14,3 | 80 | RREO Simplificado |
| Rio Branco/AC (120040) | Norte (AC) capital | 390.058 | 4.745 | 14,8 | 42,1 | 57,9 | 77,4 | 2,87 | 12 | 88,8 | 11,5 | 95 | 891 |
| Santa Rosa do Purus/AC (120043) | Norte (AC) pequeno, sem hospital (05/07) | 7.285 | 188 | 69,1 | instável | 14,9 | 36,1 | 2,20 | 0 | 145,5 | 32,0 | 53 | 771 |
| Campo Grande/MS (500270) | Centro-Oeste (MS) capital | 970.843 | 11.487 | 11,4 | 17,4 | 65,5 | 85,4 | 2,97 | 24 | 82,9 | 12,9 | 103 | 2.107 |
| Curitiba/PR (410690) | Sul (PR) capital | 1.832.183 | 16.872 | 7,3 | 11,9 | 59,4 | 95,2 | 3,17 | 60 | 61,8 | 13,3 | 102 | 1.664 |
| André da Rocha/RS (430066) | Sul (RS) menor município | 1.156 | 12 | 0,0 | instável | 83,3 | 100,0 | 0,00 | 0 | 302,8 | 12,5 | 41 | RREO Simplificado |

Leitura: os cinco municípios sem estabelecimento do tipo hospital (CNES 05/07) — Alto Rio Novo, Borá, Serra da Saudade, Santa Rosa do Purus e André da Rocha — têm AIH de residentes (atendidas fora), não "zero internações"; quatro deles têm 0 leito, e Santa Rosa do Purus tem 2,2 leitos/1.000 em unidade não classificada como hospital (provável unidade mista). Municípios com menos de 1.000 nascidos têm RMM marcada "instável". Santa Rosa do Purus (AC) tem cesárea 14,9% e pré-natal ≥6 de 36,1% — valores que parecem outliers, não confirmados. Alto Rio Novo, Serra da Saudade e André da Rocha usam RREO/RGF Simplificado (o RREO padrão devolve 0 linhas); Borá, com 935 habitantes, usa o formulário padrão — o simplificado é opcional para municípios pequenos (TST-P8-20).

**Espírito Santo (78 municípios, todos testados):** 78/78 com nascidos; 31 sem hospital no CNES; 22 sem leito registrado; TMI da UF pela soma dos municípios 12,2‰ (mediana municipal 11,5‰; 9 municípios com <100 nascidos); cobertura de APS com mediana 137,8% e 72 municípios acima de 100%.

---

## 19. Cobertura estadual

- Os arquivos SIM/SINASC/SIH/CNES/SIA estão presentes para **27/27 UFs** (incluindo DF). O arquivo da UF no SIH refere-se ao estabelecimento: AIH de residentes de uma UF aparecem nos arquivos de outras (ES: −1,0% em jun/2024).
- O e-Gestor devolve nível `UF` (27 linhas) e `BRASIL`.
- **Agregação sem duplicidade:** UF = soma de municípios exige o código "município ignorado" (xx0000): no ES, 609 óbitos infantis somados por município vs 610 por UF.
- Não transferi taxas estaduais para municípios em nenhum teste.
- Finanças estaduais: RREO de ES-UF e SP-UF foram lidos (mesmos anexos do município, sem 8/12). A amostra de estados não é sistemática (limitação da P8).

---

## 20. Séries históricas

| Dataset | Listado | Recuperado em teste | Lote |
|---|---|---|---|
| SIM / SINASC | 1996–2024 definitivo; 2025–2026 preliminar | ES 1996, 2000, 2013, 2022; Brasil 2024 | 27 DBC/ano |
| CNES LT/ST | 2005-08–2026-09 | ES 2013-01, 2018-12, 2023-01; Brasil 2026-09 | 27 DBC/competência |
| SIH-RD | 2008-01–2026 | ES 2008-01, 2013-01, 2020-01, 2024 (12 meses); Brasil 2024-06 | 27 DBC/mês |
| SIA-PA | 2008-01–2026 (PAES0801, PAES1301 existem) | ES 2024-06 | 27 DBC/mês |
| PNI cobertura | parquet 2015–2026; TabNet 1994–2022 | parquet integral; TabNet 2019 e 2022 | 1 arquivo |
| e-Gestor APS | 201912–202608 (79 competências) | 201912–202012 (AB); 202112–202608 (APS) | 27 chamadas/competência |
| Previne | só 2024Q1–Q3 | 2024Q1–Q3 | API paginada |
| Siconfi | RREO/DCA/RGF a partir de 2015 | 2015, 2018, 2023, 2024 (Vitória) | API por ente |
| SIAPS | competência única | 202512 | API paginada |
| BNAFAR | só mês corrente | P4 | API |

Formatos: DBC (FTP, decodificação com `pyreaddbc`), DBF, JSON paginado, parquet, HTML (TabNet), XLSX (exportação do e-Gestor, não usada).

---

## 21. Relacionamentos entre fontes

| ID | Relação | Estado |
|---|---|---|
| REL-01 | Código IBGE de 6 dígitos (DATASUS, e-Gestor, PNI, DEMAS) ↔ 7 dígitos (IBGE, Siconfi) por remoção do dígito verificador | EXATA: 5.570/5.570 nos testes |
| REL-02 | SIM `CODMUNRES` ↔ SINASC `CODMUNRES` (mesmo município e ano) | EXATA; 14 códigos xx0000 sem município |
| REL-03 | CNES de 7 dígitos: ST ↔ LT ↔ SIH `CNES` ↔ SIA `PA_CODUNI` | EXATA (ES testado) |
| REL-04 | SIH `MUNIC_RES` ↔ população IBGE | EXATA |
| REL-05 | Denominador do PNI (`NU_POPULACAO`, SINASC) ↔ nascidos SINASC | NÃO verificada nesta fase |
| REL-06 | e-Gestor `qtPopulacao` (DOU) ↔ IBGE | DIVERGENTE (213,4 mi vs 214,2 mi) |
| REL-07 | Siconfi `populacao` ↔ IBGE | DIVERGENTE (Vitória 331.785 vs 343.935) |
| REL-08 | CNES lat/long ↔ setor censitário (P3) | PROVADA em P3, não repetida |

---

## 22. Indicadores adicionais (fora da planilha)

| ID | Oportunidade | Granularidade | Estado | Resultado/limite |
|---|---|---|---|---|
| EXT-01 | Estabelecimentos por tipo e natureza jurídica (CNES ST) | estabelecimento × competência | READY_FOR_CONTRACT | 501.726 estabelecimentos; 131.831 SUS; UBS 43.841; hospitais 6.636 em 3.159 municípios |
| EXT-02 | Leitos SUS vs não SUS por tipo (UTI/complementares) | estabelecimento × tipo/código de leito | READY_WITH_CAVEATS | TP_LEITO 3 (complementares) 82.975; SUS 44.236 |
| EXT-03 | Equipamentos (EQ) e profissionais por CBO (PF) | estabelecimento × equipamento; profissional × estabelecimento × CBO | NEEDS_VALIDATION (privacidade) | ES: 26.875 e 145.836 linhas. PF contém identificação individual: agregar por município × CBO antes de gravar. |
| EXT-04 | Internações de residentes fora do município (fluxo) | município de residência × município de atendimento × mês | READY_WITH_CAVEATS | ES 2024: 54,6% fora do município; Alto Rio Novo (sem hospital): 100% fora do município; Vitória recebe 79,3% das AIH ocorridas de outros municípios |
| EXT-05 | Valor aprovado e permanência por hospital/procedimento | hospital × procedimento × mês | READY_WITH_CAVEATS | VAL_TOT = valor aprovado (não pago); DIAS_PERM média 4,86 dias, mediana 2 (ES 2024); letalidade hospitalar 3,9% |
| EXT-06 | Cobertura vacinal por imunobiológico | município × ano × vacina | READY_WITH_CAVEATS | 25 rótulos em 2026; 1.088.479 linhas |
| EXT-07 | Indicadores Previne Brasil por município e quadrimestre | município × quadrimestre × indicador × visão | NEEDS_VALIDATION | Só 2024Q1–Q3; dicionário não localizado; campo percentual não é razão simples |
| EXT-08 | Estoque de medicamentos (BNAFAR/Hórus) | CNES × CATMAT × lote (só mês corrente) | READY_WITH_CAVEATS (sem histórico; ausência ≠ estoque zero) | P4 (ES: 53.999 linhas, 393 CNES, 68/78 municípios); não reexecutado |
| EXT-09 | Despesa de Saúde por subfunção | ente × exercício × subfunção | READY_WITH_CAVEATS | RREO Anexo 02 (Vitória) traz as subfunções de Saúde por nome: Atenção Básica; Assistência Hospitalar e Ambulatorial; Suporte Profilático e Terapêutico; Vigilância Sanitária; Vigilância Epidemiológica |
| EXT-10 | Produção ambulatorial por estabelecimento | estabelecimento × procedimento × mês | NEEDS_VALIDATION | ES 2024-06: 1.067 estabelecimentos; 44.337 pares estab×procedimento |
| EXT-11 | Atendimento individual da APS (categoria profissional, CID/CIAP) | município × competência × perfil | NEEDS_VALIDATION | Vitória 202512: 100.992 registros; 49.829 por médico; só uma competência |
| EXT-12 | Cobertura de equipes de APS por tipo (eSF, eAP, eSB…) | município × competência | READY_WITH_CAVEATS | 56.244 eSF no Brasil em 2026-08; campos por tipo de equipe |

---

## 23. Benchmarks e interpretação clínica

| ID | Benchmark da missão | Fonte oficial verificada? | Vigente? | Aplica-se a | Tipo | Adequado para comparação pública? | Observação |
|---|---|---|---|---|---|---|---|
| BM-01 | Mortalidade infantil abaixo de 12 por 1.000 NV | Não localizada nesta fase. 12‰ coincide com a referência do ODS 3.2 para mortalidade NEONATAL (não infantil); fonte primária não lida. | NÃO VERIFICADO | nacional/estados | referência gerencial | NÃO para comparação pública municipal | Brasil 2024 medido: 12,56‰; 1.575 dos 5.584 códigos sem nenhum óbito infantil; 2.387 municípios com <100 nascidos. Comparar município a limiar fixo gera ruído estatístico. |
| BM-02 | Mortalidade materna abaixo de 30 por 100 mil NV | Não verificada com fonte primária. 30/100 mil aparece como meta brasileira do ODS 3.1 (global: 70); a confirmar. | NÃO VERIFICADO | nacional | meta de política (ODS) | NÃO para município | Medido: RMM Brasil 2024 = 55,5; 4.786 municípios sem óbito materno; 5.183 com <1.000 NV (instável). Só agregação regional/plurianual é defensável. |
| BM-03 | Cesáreas entre 15% e 30% | Sem norma brasileira localizada para 15–30%. A referência da OMS de 10–15% nasceu em 1985 (reunião de Fortaleza) e a declaração da OMS de 2015 recomenda não perseguir uma taxa específica e usar a classificação de Robson (leitura via PAHO e imprensa; documento original não lido). | 15–30%: SEM FONTE; 10–15%: SUPERADA | população de gestantes, não hospital | referência gerencial contestável | NÃO | Brasil 2024: 60,6%; mediana municipal 65,0%; TPROBSON disponível no SINASC para padronizar. |
| BM-04 | Ocupação de leitos entre 70% e 85% | Não localizada. A faixa vem de parâmetros antigos (Portaria 1.101/2002, depois 1.631/2015, hoje consolidada) — conforme estudos técnicos secundários (CNM 2018). Leitos-dia hospital-dia e UTI têm cálculo separado. | NÃO VERIFICADO | hospital/serviço, não município | parâmetro técnico histórico | NÃO | Ocupação alta pode indicar superlotação; baixa pode indicar acesso inadequado ou mix. Indicador não é calculável com dado público (ver IND-SAU-06). |
| BM-05 | Absenteísmo abaixo de 20% | Nenhuma norma localizada. | SEM FONTE | serviço/município | referência gerencial | NÃO | Sem base nacional (TST-P8-26). |
| BM-06 | Cobertura vacinal ≥ 95% | Metas do PNI variam por imunobiológico; o PDF "Regrascobertura2013" do DATASUS define o cálculo mas não lista metas. Metas (95% geral; 90% para BCG e rotavírus) são de conhecimento do PNI e NÃO foram confirmadas em documento nesta fase. | A CONFIRMAR | por vacina e faixa etária | meta técnica do PNI | PARCIAL: só por vacina, com denominador SINASC e coberturas >100% tratadas | BCG 2022: 41% dos municípios acima de 100% no TabNet (2.303/5.569). |
| BM-07 | Aplicação mínima em Saúde de 15% da receita de referência | LC 141/2012, arts. 6º e 7º (texto lido em planalto.gov.br, redação LC 227/2026): Estados 12%; Municípios 15%; DF aparece nos dois artigos (leitura jurídica necessária). | SIM | Municípios 15%; Estados 12%; DF a esclarecer | meta legal (mínimo constitucional) | SIM, com a base legal de cada ente | A base de cálculo (impostos e transferências constitucionais, deduções) só é reproduzível com os demonstrativos do SIOPS; o Siconfi não serve o Anexo 12. |
| BM-08 | Pessoal até 60% da RCL | LRF arts. 19 e 20 (lidos): global 60% para Estados e Municípios (50% União). Por Poder: Executivo municipal 54%, Legislativo 6%; Executivo estadual 49%. O RGF do Siconfi (Vitória) traz limite máximo 54% para o Executivo. | SIM | por ente e por Poder | limite legal | SIM, desde que rotulado como despesa total com pessoal do Executivo (não da Saúde) | Na amostra aleatória de 150 municípios, 9 excederam 54%. Não existe limite legal de pessoal específico da Saúde. |

**Interpretação (o que cada indicador mede e não mede):**

- *Cobertura APS:* capacidade teórica das equipes, não acesso ou qualidade.
- *Leitos:* oferta cadastrada, não oferta operacional; ignora fluxo regional.
- *Vacinação:* doses/população-alvo; denominador SINASC; >100% é comum.
- *Mortalidade infantil/materna:* residência vs ocorrência (48,6% dos óbitos infantis ocorrem fora); subnotificação; defasagem (2024 é o último definitivo); pequenos números.
- *ICSAP:* internação SUS por condição sensível; depende de acesso à APS, perfil etário e oferta hospitalar; precisa de padronização por idade.
- *Cesáreas:* taxa bruta sem perfil de risco; não há faixa universal.
- *Finanças:* empenhado ≠ liquidado ≠ pago; função Saúde ≠ ASPS; transferências geram dupla contagem entre entes; restos a pagar ≠ inadimplência.
- *Supressão estatística:* nenhuma regra oficial de supressão de células pequenas foi localizada nos arquivos do DATASUS; sugere-se agregar ≥3 anos ou ≥1.000 nascidos antes de divulgar taxas municipais.

Não foi construída nenhuma pontuação de governantes e **não recomendo semáforos** antes da validação do especialista.

---

## 24. Viabilidade de coleta automática

| Fonte | Automação | Observação |
|---|---|---|
| DATASUS FTP (SIM, SINASC, SIH, SIA, CNES) | **Sim** | arquivos previsíveis `{SIS}{UF}{AAMM}.dbc`; decodificar `.dbc`; reprocessar quando o arquivo é substituído (checar data/tamanho do LIST) |
| Parquet PNI | **Sim** | arquivo único; checar `DT_CARGA` |
| e-Gestor APS | **Sim, com risco** | API não documentada; o collector deve ter testes de contrato |
| Siconfi | **Sim** | volume alto de chamadas (≈168 mil para o backfill); tratar formulário simplificado e entes sem entrega |
| DEMAS (Previne, SIAPS) | **Sim** | séries curtas |
| SIOPS | **Não comprovado** | descoberta pendente |
| Espera, absenteísmo, resolutividade, satisfação | **Não** | exigem convênio |

Credenciais: nenhuma das rotas comprovadas exige autenticação. Convênios: apenas para 03 e 04.

---

## 25. Estimativas de armazenamento

**Calibração.** Fórmula do plano diretor (validada contra `civica_state.movements`: 1.070 B previstos vs 1.060 B medidos), com a linha de base do PostgreSQL de 13/10/2026 (`_baseline_postgres_tables.csv`). Linhas são **medidas** quando existe contagem real (vacinação 1.088.479; CNES ST 501.726; LT 51.965; razões do SIH/SIA/EQ/PF no ES) e **estimadas por razão de escala** quando não (marcado na nota de cada tabela). Não usei microdados nacionais integrais.

| Cenário | Conteúdo | Linhas históricas | Dados (GiB) | Índices (GiB) | Histórico (GiB) | **Total PostgreSQL (GiB)** | Crescimento anual (GiB) | Objetos (GiB) |
|---|---|---|---|---|---|---|---|---|
| A — Agregados territoriais | tabela longa indicador × ente × período (14 indicadores) + população | 3,5 mi | 0,25 | 0,17 | 0,00 | **0,42** | 0,05 | 4,7 |
| B — + estabelecimentos e séries hospitalares | A + CNES (estabelecimentos, leitos, equipamentos, profissionais agregados) + SIH hospital×mês×subgrupo | 14,8 mi | 1,31 | 0,52 | 0,14 | **1,97** | 0,16 | 5,0 |
| C — + detalhamento ampliado | B + SIH hospital×procedimento e ×residência, SIA estab×grupo, vínculos, serviços, BNAFAR | 107,9 mi | 9,02 | 3,38 | 0,14 | **12,54** | 1,56 | 19,0 |

Tabelas por cenário (bytes por linha = heap + índices; histórico = fator de versões cadastrais):

| Cen. | ID | Tabela | Linhas | B/linha | GiB | Base da estimativa |
|---|---|---|---|---|---|---|
| A | A1 | sau_indicador_valor | 3.420.067 | 130 | 0,415 | indicador (smallint) × ente (int IBGE) × período (int) com numerador, denominador, valor, flags. Soma dos 14 indicadores com extração comprovada (ver INDROWS) + 6% de agregados por UF. |
| A | A2 | ter_pop_mun_ano (SIDRA 6579 / FIN) | 78.000 | 107 | 0,008 | denominador populacional município × ano (2013–2026); dataset TER-SIDRA-SERIES já previsto |
| A | A3 | sau_indicador_def + dicionários (imunobiológico, CID/ICSAP, procedimento) | 2.500 | 235 | 0,001 | metadados e listas oficiais (lista ICSAP 188 códigos, SIGTAP 5.039) |
| B | B1 | sau_cnes_estab (SCD) | 501.726 | 799 | 0,373 | 501.726 estabelecimentos (ST 2026-09, medido) com tipo, natureza, vínculo SUS, lat/long, município; fator de histórico 0,6 por versões cadastrais |
| B | B2 | sau_cnes_leitos_estab (snapshots dez/ano + último) | 545.632 | 108 | 0,055 | 51.965 linhas por competência (medido) × 14 snapshots × 0,75 (mudanças reais) |
| B | B3 | sau_cnes_equip_estab (último + variações) | 2.100.702 | 108 | 0,211 | EQ ES = 26.875 linhas (medido); escala ×48,9 por razão de estabelecimentos; +15%/ano de mudanças |
| B | B4 | sau_cnes_prof_agreg (município × grupo CBO × dez) | 1.949.850 | 100 | 0,181 | agregado de PF (ES: 145.836 vínculos, medido) por município × 25 grupos CBO × 14 snapshots; sem identificação individual |
| B | B5 | sau_sih_hospital_mes | 1.000.000 | 132 | 0,123 | hospital × mês (ES 2024: 842 hospital-meses, medido; escala por AIH ≈ 0,8 mi; arredondado para 1 mi) |
| B | B6 | sau_sih_hospital_mes_subgrupo | 5.193.071 | 124 | 0,599 | hospital × mês × subgrupo de procedimento (7.896 linhas no ES 2024 = 0,026 por AIH; 14 anos de 14,3 mi AIH/ano) |
| C | C1 | sau_sih_hospital_residencia_mes | 11.984.011 | 116 | 1,293 | hospital × município de residência × mês (18.593 linhas no ES 2024 = 0,06 por AIH) |
| C | C2 | sau_sih_hospital_proc_mes | 36.151.767 | 116 | 3,900 | hospital × procedimento (10 dígitos) × mês (55.518 linhas no ES 2024 = 0,181 por AIH) |
| C | C3 | sau_sia_estab_grupo_mes | 28.701.267 | 116 | 3,096 | estabelecimento × grupo de procedimento (4 dígitos) × mês; ES 2024-06 = 3.766 linhas (medido); 13 anos |
| C | C4 | sau_cnes_prof_vinculo (pseudonimizado) | 11.399.371 | 141 | 1,496 | vínculo × estabelecimento × CBO; ES 145.836 por competência (medido). Dado pessoal: só com pseudônimo e decisão jurídica |
| C | C5 | sau_cnes_servicos_estab (SR) | 1.498.509 | 108 | 0,150 | SR ES 23.595 linhas (medido) × 48,9 × 1,3 |
| C | C6 | sau_bnafar_estoque (corrente) + agregado mensal | 3.350.000 | 205 | 0,640 | P4: 53.999 linhas no ES (78 municípios) → 3,35 mi nacional; API só mês corrente; sem histórico retroativo |

**Cobertura possível por cenário:** A cobre os 14 indicadores comprovados; B adiciona 501.726 estabelecimentos, leitos por estabelecimento, equipamentos, profissionais agregados e séries hospitalares por mês/subgrupo; C adiciona hospital × procedimento × mês (36 mi linhas), hospital × município de residência, SIA por estabelecimento × grupo (29 mi) e vínculos profissionais pseudonimizados (dado pessoal: exige decisão jurídica). Excluídos de todos os cenários: SIH hospital × residência × procedimento (≈90 mi linhas ≈ 10 GiB), SIA estabelecimento × procedimento (≈26 mi linhas/ano), doses individuais do PNI (1,17 GB só de cobertura agregada em parquet) e microdados de SIM/SINASC.

**Backfill (cenário A)** — arquivos/chamadas e volume baixado:

| Fonte | Arquivos/chamadas | Volume (GiB) |
|---|---|---|
| SIM+SINASC 1996–2024 | 54 arquivos/ano × 29 anos = 1.566 DBC | 4,7 |
| CNES LT 14 snapshots + ST dez | 2 × 27 UFs × 14 = 756 DBC | 0,3 |
| SIH-RD (agregar ICSAP por município × ano) | 27 UFs × 12 meses × 14 anos (2013–2026) = 4.536 DBC (processados em fluxo; retidos apenas no cenário C) | 14,0 |
| e-Gestor APS | 27 UFs × 93 competências = 2.511 chamadas JSON | 0,4 |
| PNI parquet | 1 arquivo | 0,0 |
| Siconfi RREO/RGF/DCA | ≈5.600 entes × 10 anos × 3 chamadas ≈ 168 mil chamadas (≈1 s cada) | 6,0 |
| SIA consultas (PA) | 27 UFs × 12 meses × 14 anos = 4.536 DBC grandes (≈1,6 GB/mês nacional) | 268,8 |

O volume maior do backfill é o SIA (≈1,6 GB/mês nacional, extrapolado do ES por razão de estabelecimentos); só é necessário se IND-SAU-02 for aprovado. Comparação: o plano diretor estimava 20,26 GiB para todo o escopo de Saúde no cenário B; o MVP aqui proposto (B) ocupa 2,0 GiB porque agrega os microdados.

**Recomendação:** MVP = cenário **B** (~2,0 GiB no PostgreSQL + ~5 GiB de objetos), com opção de crescer para C apenas para SIH hospitalar.

---

## 26. Matriz dos 20 indicadores

(Versão resumida; **todos os campos** estão em `investigacao_executivo_p8_saude_indicadores.csv`.)

| ID | Nome | Fonte | Granularidade | Histórico testado | Cobertura | Classe | Viabilidade | Collector | PG (GiB, A) |
|---|---|---|---|---|---|---|---|---|---|
| IND-SAU-01 | Cobertura da Atenção Básica/ESF | Ministério da Saúde — e-Gestor AB / SISAB (API do portal Relatórios Públicos da APS) | município × competência mensal | 201912–202608 listados; /ab recuperado 201912–202012; /aps recuperado 202112–202608; 2021 intra-ano não testado; antes de 2019 não testado | 2026-08: 5.570 de 5.571 municípios; 27 UFs; Brasil 98,77% | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | ADAPTAÇÃO de EXEC-C20 (SIOPS + SISAB) | 0,063 |
| IND-SAU-02 | Consultas médicas por habitante/ano | DATASUS SIA-PA (+ SIAPS/DEMAS para APS) e IBGE (população) | estabelecimento × procedimento × mês (SIA); município × competência (SIAPS) | SIA 2008–2026 listado (PAES0801 e PAES1301 existem); só 2024-06 recuperado; SIAPS: só 202512 devolveu dados | SIA: 27 UFs em arquivo, 1 UF×1 mês testado; APS fora do SIA | PARTIAL_MUNICIPAL | NEEDS_VALIDATION | ADAPTAÇÃO de EXEC-C34 (SIA) + NOVO SRC-DEMAS-SIAPS | 0,009 |
| IND-SAU-03 | Taxa de absenteísmo em consultas | Sistemas municipais/estaduais de agendamento e regulação (SISREG local) | unidade/serviço × dia | — | Nenhuma base nacional ou estadual testada | LOCAL_SYSTEM_ONLY | LOCAL_INTEGRATION_REQUIRED | NOVO por ente (não priorizar) | — |
| IND-SAU-04 | Tempo médio de espera por consulta ou exame | Sistemas de regulação (SISREG/estaduais/municipais) | solicitação (microdado local); painéis agregados | RS: 3 anos (conforme notícia); POA: desde 2020; não testado | 3 painéis subnacionais identificados; extração não testada | LOCAL_SYSTEM_ONLY | LOCAL_INTEGRATION_REQUIRED | NOVO por UF (RS, DF como candidatos a piloto) | — |
| IND-SAU-05 | Leitos hospitalares por 1.000 habitantes | DATASUS CNES-LT (FTP) e DEMAS cnes-leitos; população IBGE | estabelecimento CNES × tipo/código de leito × competência | LT 2005–2026 listado; ES recuperado em 2013-01, 2018-12, 2023-01, 2026-09 | 2026-09: 3.605 municípios com ≥1 leito; 1.966 sem leito registrado; 27 UFs; Brasil 2,47 (SUS 1,66) | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C30 (CNES leitos) com rota FTP | 0,009 |
| IND-SAU-06 | Taxa de ocupação de leitos | CNES (leitos existentes), SIH-RD (DIAS_PERM), sistemas hospitalares | estabelecimento CNES (proxy) | proxy possível desde 2008 (RD) — sem validade | Proxy ES 2024: n=69 hospitais com ≥20 leitos SUS; mediana 53%, p10 11%, p90 88% | FACILITY_LEVEL | NOT_FEASIBLE_WITH_PUBLIC_DATA | Não criar (apenas como análise interna rotulada) | — |
| IND-SAU-07 | Cobertura vacinal | DATASUS/MS — SIPNIBD (parquet) e TabNet | município de residência × ano × imunobiológico/dose | parquet 2015–2026 (2026 parcial, carga 01/07/2026); TabNet 1994–2022 | 5.570–5.571 municípios por ano; 25+ rótulos por ano | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C35 (SIM/SINASC/PNI) — rota parquet | 0,132 |
| IND-SAU-08 | Mortalidade infantil | DATASUS — SIM (DO) e SINASC (DN) | município de residência × ano (microdado → agregável por mês, sexo, peso, causa) | 1996–2024 definitivo; 2025–2026 preliminar; recuperado em teste: ES 1996, 2000, 2013, 2022; Brasil 2024 | 2024: 5.570/5.571 municípios com nascidos; Brasil 12,56‰ | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C35 — trocar rota DEMAS por FTP DBC | 0,020 |
| IND-SAU-09 | Mortalidade materna | DATASUS — SIM (DO) e SINASC (DN) | município de residência × ano | 1996–2024 (campos de investigação/morte materna variam por ano) | 2024: 1.326 óbitos em 798 municípios; 4.786 municípios sem óbito; RMM Brasil 55,5 | NATIONAL_MUNICIPAL | NEEDS_VALIDATION | REUTILIZADO EXEC-C35 | 0,020 |
| IND-SAU-10 | Internações por Condições Sensíveis à Atenção Primária (ICSAP) | DATASUS SIH-RD e Portaria SAS 221/2008 | município de residência × mês (agregável por hospital, sexo, idade) | 2008–2026 listado; recuperado ES 2008-01, 2013-01, 2020-01 e 2024 completo; Brasil 2024-06 | 2024-06: 5.570/5.571 municípios com AIH de residentes; ICSAP 15,8% (1.188.890 AIH) | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C32 (SIH-RD agregado) com campo ICSAP | 0,024 |
| IND-SAU-11 | Cobertura de pré-natal com 6 ou mais consultas | DATASUS SINASC (DN); Previne Brasil indicador (a confirmar) | município de residência × ano | CONSPRENAT presente em 2013 (ausente em 1996/2000, quando só há CONSULTAS categórico); SISPRENATAL FTP 2012–2014 (descontinuado) | 2024: Brasil 87,5% dos válidos; 98,4% com informação válida; ignorado 6.749; em branco 30.516 | NATIONAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C35 | 0,020 |
| IND-SAU-12 | Taxa de cesáreas | DATASUS SINASC (DN) | município (residência e ocorrência) × ano; TPROBSON permite classificação de Robson | 1996–2024; recuperado ES 1996, 2000, 2013, 2022; Brasil 2024 | 2024: Brasil 60,6%; mediana municipal 65,0% (0–100); PARTO ignorado 1.173 | NATIONAL_MUNICIPAL | READY_FOR_CONTRACT | REUTILIZADO EXEC-C35 | 0,020 |
| IND-SAU-13 | Resolutividade da Atenção Básica | e-SUS APS / SISAB (individual) — não público | — | SIAPS: 202512 | SIAPS agregado não traz conduta/encaminhamento | LOCAL_SYSTEM_ONLY | NOT_FEASIBLE_WITH_PUBLIC_DATA | Não criar | — |
| IND-SAU-14 | Satisfação dos usuários | PMAQ-AB avaliação externa (módulo III; ciclos antigos); pesquisas municipais; Ouvidoria SUS | unidade básica (PMAQ) / município (pesquisas) | PMAQ ciclos 2012–2018 (publicações); URL de microdados não confirmada | Nenhum instrumento nacional vigente comparável encontrado | NOT_PROVEN | NOT_FEASIBLE_WITH_PUBLIC_DATA | Não criar | — |
| IND-SAU-15 | Percentual de aplicação de recursos em Saúde (ASPS) | SIOPS (Ministério da Saúde), com reconciliação via Siconfi | ente × ano (ou bimestre) | não testado | Extração não comprovada; o Siconfi não serve RREO Anexo 12 | NOT_PROVEN | NEEDS_VALIDATION | ADAPTAÇÃO EXEC-C20 (SIOPS) — depende de novo discovery | — |
| IND-SAU-16 | Gasto público per capita em Saúde | Siconfi (RREO Anexo 02 / DCA Anexo I-E) e IBGE | ente × exercício (× bimestre, × subfunção) | RREO e DCA desde 2015 (2013: 0 linhas) | Amostra aleatória: 150/150 municípios; 86 padrão + 64 simplificado | PARTIAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C11/C12 (Siconfi DCA/RREO) — incluir Anexo 02 e formulário simplificado | 0,007 |
| IND-SAU-17 | Execução orçamentária da Saúde | Siconfi RREO Anexo 02 e DCA Anexo I-E | ente × exercício × bimestre | 2015 em diante | Amostra: 150/150 | PARTIAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C11/C12 | 0,020 |
| IND-SAU-18 | Evolução da despesa versus receita | Siconfi RREO (Anexos 01 e 02), RCL do RGF, deflator IPCA | ente × exercício | 2015 em diante | Insumos comprovados em amostra; deflator não testado | PARTIAL_MUNICIPAL | NEEDS_VALIDATION | Derivado (sem collector próprio) | 0,007 |
| IND-SAU-19 | Restos a pagar em Saúde | Siconfi RREO Anexo 02 (RPNP inscritos), DCA Anexos I-E e I-G | ente × exercício × função | 2015 em diante | Vitória: I-E e I-G com função 10 - Saúde; amostra nacional não executada para I-G | PARTIAL_MUNICIPAL | READY_WITH_CAVEATS | REUTILIZADO EXEC-C11 (DCA) | 0,027 |
| IND-SAU-20 | Gasto total com pessoal | Siconfi RGF Anexo 01 (Q3 ou semestral simplificado) | ente × Poder × quadrimestre/semestre | 2015 em diante (RGF 2015 Vitória: 226 linhas) | Amostra: 150/150 (86 padrão + 64 simplificado); mediana 43,9% | PARTIAL_MUNICIPAL | READY_FOR_CONTRACT | REUTILIZADO EXEC-C12 (RGF) | 0,014 |

Motivo da classificação de cada indicador (resumo):

- **IND-SAU-01 — Cobertura da Atenção Básica/ESF** · `READY_WITH_CAVEATS`: Extração por município comprovada nos 27 UFs, mas a série é descontínua e a regra de teto não está documentada.
- **IND-SAU-02 — Consultas médicas por habitante/ano** · `NEEDS_VALIDATION`: Só a parte especializada é mensurável; a parte de APS depende de competência única no SIAPS. Definir o indicador (conjunto de procedimentos) exige especialista.
- **IND-SAU-03 — Taxa de absenteísmo em consultas** · `LOCAL_INTEGRATION_REQUIRED`: Exige convênio com cada secretaria; sem dado público comprovado.
- **IND-SAU-04 — Tempo médio de espera por consulta ou exame** · `LOCAL_INTEGRATION_REQUIRED`: Sem fonte nacional; painéis estaduais são heterogêneos e não foram extraídos.
- **IND-SAU-05 — Leitos hospitalares por 1.000 habitantes** · `READY_WITH_CAVEATS`: Extração completa e reproduzível; a definição do que conta como leito e a leitura regional exigem decisão de especialista.
- **IND-SAU-06 — Taxa de ocupação de leitos** · `NOT_FEASIBLE_WITH_PUBLIC_DATA`: Não há fonte pública com pacientes-dia e leitos-dia operacionais para todos os hospitais; o proxy não é metodologicamente defensável.
- **IND-SAU-07 — Cobertura vacinal** · `READY_WITH_CAVEATS`: Arquivo oficial único com cobertura municipal e fórmula documentada; exige dicionário canônico de imunobiológicos e tratamento de >100%.
- **IND-SAU-08 — Mortalidade infantil** · `READY_WITH_CAVEATS`: Cálculo completo reproduzido; instabilidade estatística exige agregação plurianual ou intervalos de confiança.
- **IND-SAU-09 — Mortalidade materna** · `NEEDS_VALIDATION`: Dado disponível, mas a definição oficial e o uso municipal exigem validação epidemiológica.
- **IND-SAU-10 — Internações por Condições Sensíveis à Atenção Primária (ICSAP)** · `READY_WITH_CAVEATS`: Cálculo completo reproduzido; denominador por idade e revisão da lista dependem de especialista.
- **IND-SAU-11 — Cobertura de pré-natal com 6 ou mais consultas** · `READY_WITH_CAVEATS`: Cálculo municipal reproduzido com SINASC; referência de 6 consultas precisa de validação clínica.
- **IND-SAU-12 — Taxa de cesáreas** · `READY_FOR_CONTRACT`: Campo único, definição inequívoca, cobertura nacional e histórica comprovadas; benchmark é uma decisão editorial separada.
- **IND-SAU-13 — Resolutividade da Atenção Básica** · `NOT_FEASIBLE_WITH_PUBLIC_DATA`: O dado necessário (encaminhamento individual) não é público.
- **IND-SAU-14 — Satisfação dos usuários** · `NOT_FEASIBLE_WITH_PUBLIC_DATA`: Sem instrumento nacional vigente e sem microdados confirmados.
- **IND-SAU-15 — Percentual de aplicação de recursos em Saúde (ASPS)** · `NEEDS_VALIDATION`: A base legal está verificada, mas a rota de extração do percentual apurado não foi comprovada.
- **IND-SAU-16 — Gasto público per capita em Saúde** · `READY_WITH_CAVEATS`: Extração comprovada em amostra aleatória; falta medir entrega nacional e decidir tratamento de transferências.
- **IND-SAU-17 — Execução orçamentária da Saúde** · `READY_WITH_CAVEATS`: Colunas de dotação e execução comprovadas; falta cobertura nacional medida.
- **IND-SAU-18 — Evolução da despesa versus receita** · `NEEDS_VALIDATION`: Insumos existem, mas a definição do indicador é metodologicamente aberta.
- **IND-SAU-19 — Restos a pagar em Saúde** · `READY_WITH_CAVEATS`: Colunas comprovadas em um município e RPNP em 150; falta medir I-G em amostra.
- **IND-SAU-20 — Gasto total com pessoal** · `READY_FOR_CONTRACT`: Definição legal inequívoca, campos explícitos e extração comprovada em amostra aleatória, mas só como indicador do Executivo, nunca como indicador de Saúde.

Distribuição: `READY_FOR_CONTRACT` 2 · `READY_WITH_CAVEATS` 9 · `NEEDS_VALIDATION` 4 · `LOCAL_INTEGRATION_REQUIRED` 2 · `NOT_FEASIBLE_WITH_PUBLIC_DATA` 3 · `BLOCKED_EXTERNAL` 0.

---

## 27. Classificação dos collectors

| Collector (existente/novo) | Datasets | Indicadores | Classificação |
|---|---|---|---|
| EXEC-C35 (SIM, SINASC, PNI) | SAU-SIM-AGREG, SAU-SINASC-AGREG, SAU-PNI-AGREG | 07, 08, 09, 11, 12 | **Reutilizado, com troca de rota** (FTP DBC + parquet em vez do DEMAS) |
| EXEC-C30 / C21 (CNES) | SAU-CNES-LEITOS, SAU-CNES-ESTAB | 05 (+ EXT-01/02) | **Reutilizado**, rota FTP |
| EXEC-C20 (SIOPS + SISAB) | SAU-SISAB-PREVINE, SAU-SIOPS, **SAU-APS-COBERTURA (novo)** | 01, 15 | **Adaptação**: APS nova; SIOPS exige descoberta |
| EXEC-C32 (SIH-RD agregado) | SAU-SIH-AGREG | 10 (+ fluxos) | **Reutilizado** com campo ICSAP e 27 UFs |
| EXEC-C11/C12 (Siconfi) | FIN-SICONFI-RREO/RGF/DCA-CORE | 16, 17, 18, 19, 20 | **Reutilizado**, + Anexo 02, + formulário simplificado, + DCA I-E/I-G |
| EXEC-C34 (SIA) | SAU-SIA-AGREG | 02 | **Adaptação**, após validação do indicador |
| SAU-SIAPS-ATEND (novo) | — | 02 (APS), 13 | **Novo**, só se houver série |
| EXEC-C14 (SIDRA) | TER-SIDRA-SERIES | denominadores | **Reutilizado** |
| (nenhum) | — | 03, 04, 06, 13, 14 | **Não criar** |

---

## 28. Oportunidades para o MVP

**Pacote 1 (pronto para contrato):** 12 (cesáreas), 20 (pessoal do Executivo), 05 (leitos) com rotulagem; 08 e 11 (com agregação plurianual). **Pacote 2 (com ressalvas):** 01, 07, 10, 16, 17, 19. **Pacote 3 (decisão de especialista):** 02, 09, 18, 15 (depende de nova discovery do SIOPS). Estabelecimentos CNES (EXT-01/02) são um ativo imediato para mapas e para o P3 (CNES → setor censitário).

Ordem de implementação sugerida:

1. SIM/SINASC/PNI por FTP e parquet (um collector, 5 indicadores, ≈0,4 GiB).
2. CNES ST/LT por FTP (leitos e estabelecimentos).
3. Cobertura de APS (e-Gestor).
4. SIH-RD agregado com ICSAP (27 UFs × meses).
5. Siconfi RREO/RGF/DCA com formulário simplificado.
6. Discovery do SIOPS.
7. SIA (se 02 for aprovado).

---

## 29. Bloqueios e dependências externas

- **SIOPS:** rota pública não enumerável; app novo com login; PHP legado exige parâmetros não confirmados. Alternativa: pedir o contrato da API ao Ministério/DATASUS ou executar discovery com navegador autenticado (não feito: não contornei autenticação).
- **Espera/absenteísmo:** convênios com secretarias; painéis RS/POA/DF como pilotos possíveis.
- **Ocupação hospitalar:** requer censo diário (CIHA/CNES dos hospitais) — sem dado aberto.
- **Resolutividade/satisfação:** sem dado público.
- **API do e-Gestor:** não documentada; risco de mudança.
- **OpenDataSUS:** a API CKAN respondeu HTML (portal Next.js); o acesso ao S3 do OpenDataSUS foi 403 em P1; por isso priorizei o FTP.
- **Dado pessoal:** CNES profissionais (nome), PNI doses (paciente), SIH (`N_AIH`, nascimento, sexo): agregar na ingestão.

---

## 30. Perguntas para especialista em Saúde

| Indicador | Pergunta |
|---|---|
| IND-SAU-01 | A cobertura de APS deve ser truncada em 100%? Como apresentar a mudança de metodologia de 2021? |
| IND-SAU-02 | Quais procedimentos SIGTAP definem "consulta médica" e como combinar SIA (especializada) com e-SUS (APS) sem dupla contagem? |
| IND-SAU-05 | Quais tipos de leito compõem o indicador? Devem ser mostrados por região de saúde em vez de por município? |
| IND-SAU-06 | Há fonte oficial de ocupação hospitalar ou censo de leitos operacionais que possamos acessar? |
| IND-SAU-07 | Qual dose/imunobiológico representa cada meta? Como tratar coberturas >100% e a mudança de rótulos? |
| IND-SAU-08 | Qual janela de agregação mínima para municípios pequenos? Separar neonatal e pós-neonatal? |
| IND-SAU-09 | Qual a definição oficial de morte materna e em que nível territorial publicar? |
| IND-SAU-10 | A lista de 2008 continua válida? Como padronizar por idade e excluir internações obstétricas? |
| IND-SAU-11 | Manter 6 consultas ou migrar para 8 contatos? SINASC (declarado) ou produção da APS? |
| IND-SAU-12 | Publicar a taxa bruta ou o grupo de Robson? Hospital público e privado separados? |
| IND-SAU-15 | Como reconciliar o percentual ASPS do SIOPS com o Siconfi? DF aplica 12% ou 15% após a LC 227/2026? |
| IND-SAU-16/17 | Qual base (empenhado, liquidado, pago) é a pública? Como evitar dupla contagem de transferências? |
| IND-SAU-18 | Qual receita de referência e qual deflator? |
| IND-SAU-20 | Rotular como pessoal do Executivo e comparar com o limite de 54%/49%? |

---

## 31. Gates

| Gate | Estado | Justificativa |
|---|---|---|
| P8_SOURCE_VALIDATION | PASS_WITH_CAVEATS | 18 fontes primárias consultadas (17 com acesso real nesta fase; BNAFAR só por P4) (TST-P8-01…26). SIOPS não enumerável; SISAB legado respondeu 500; OpenDataSUS S3/CKAN não acessível por API. |
| P8_20_INDICATORS | PASS_WITH_CAVEATS | Os 20 indicadores têm linha na matriz e estado de viabilidade; 14 com extração pública comprovada (alguns parciais), 1 sem rota comprovada (IND-15), 2 locais, 3 inviáveis. |
| P8_MUNICIPAL_COVERAGE | PASS_WITH_CAVEATS | Medida em escala nacional para 9 indicadores (01, 05, 07, 08, 09, 10, 11, 12 + população). Finanças só em amostra (150 aleatórios + 14 dirigidos). |
| P8_STATE_COVERAGE | PASS_WITH_CAVEATS | 27/27 UFs nos arquivos SIM/SINASC/SIH/CNES; APS 27/27. Finanças estaduais: RREO de ES e SP-UF lidos (Anexos 01–14 sem 08/12); amostra de estados não sistemática. |
| P8_HISTORICAL_AVAILABILITY | PARTIAL | Histórico recuperado em teste: SIM/SINASC ES 1996–2024 (parcial), CNES LT ES 2013–2026, SIH ES 2008–2024, PNI 2015–2026, Siconfi 2015–2024. e-Gestor só 201912+. Séries completas por UF não baixadas. |
| P8_CNES_FACILITIES | PASS | ST 2026-09: 501.726 estabelecimentos, 5.571 municípios, 27 UFs; campos de tipo, natureza jurídica e vínculo SUS verificados; lat/long no DEMAS. |
| P8_CNES_BEDS | PASS_WITH_CAVEATS | LT 2026-09 completo (51.965 linhas; 543.524 leitos). Cadastro autodeclarado, DT_ATUAL defasado; definição de leito precisa ser decidida. |
| P8_CNES_PROFESSIONALS | PARTIAL | PF só em ES (145.836 vínculos). Contém identificação individual; agregação nacional por CBO não executada. |
| P8_SIH_HOSPITAL_ACTIVITY | PASS_WITH_CAVEATS | Brasil 2024-06 e ES 2024 completos; hospital, residência e procedimento verificados. Valor é aprovado, não pago. |
| P8_SIA_AMBULATORY_ACTIVITY | PARTIAL | Só ES/2024-06. A atenção primária não aparece no SIA; consulta médica por habitante subestimada. |
| P8_SISAB_PRIMARY_CARE | PASS_WITH_CAVEATS | Cobertura APS por município (e-Gestor API) comprovada nos 27 UFs; quebra AB→APS; Previne só 2024Q1–Q3; SISAB legado indisponível. |
| P8_PNI_VACCINATION | PASS_WITH_CAVEATS | Parquet nacional de cobertura por município 2015–2026 e TabNet; regra oficial lida; denominadores e >100% a tratar. |
| P8_SIM_MORTALITY | PASS_WITH_CAVEATS | Brasil 2024 completo por residência; mortes maternas e infantis calculadas; definição oficial de morte materna não reproduzida. |
| P8_SINASC_BIRTHS | PASS_WITH_CAVEATS | Brasil 2024 completo; cesárea e pré-natal por município. DEMAS SINASC vazio — usar FTP. |
| P8_ICSAP | PASS_WITH_CAVEATS | Lista oficial transcrita e aplicada em 1,19 mi AIH (Brasil 2024-06) e 307,5 mil (ES 2024). Padronização por idade não executada. |
| P8_SIOPS_FINANCE | PARTIAL | Siconfi comprova função Saúde, execução, RP e pessoal; o percentual ASPS (SIOPS) não foi comprovado: rotas não enumeráveis e Anexo 12 ausente no Siconfi. |
| P8_WAITING_TIMES | BLOCKED | Sem base nacional; só painéis estaduais/municipais não extraídos. |
| P8_ABSENTEEISM | BLOCKED | Sem base pública localizada. |
| P8_PATIENT_SATISFACTION | BLOCKED | Sem instrumento nacional vigente; ouvidoria não é satisfação. |
| P8_BENCHMARK_VALIDITY | PARTIAL | Dois benchmarks verificados em texto legal (LC 141; LRF); seis sem fonte primária lida ou contestáveis. Nenhum semáforo recomendado. |
| P8_STORAGE_ESTIMATION | PASS_WITH_CAVEATS | Cenários A/B/C calculados com a fórmula calibrada (1.070 previsto vs 1.060 medido em civica_state.movements); contagens medidas quando possível, escala por razão quando não. |
| P8_MVP_READINESS | PASS_WITH_CAVEATS | MVP de 11 indicadores prontos ou com ressalvas definido; depende de decisões de especialista (seção 30). |

---

## 32. Inventário de evidências

Todos os testes foram executados em 2026-10-19 a partir de scripts Python locais (fora do repositório, no diretório temporário da sessão; os parâmetros e URLs abaixo bastam para reproduzir). Dados baixados ficam fora do repositório.

| ID | Teste | URL / arquivo | Método | Resultado |
|---|---|---|---|---|
| TST-P8-01 | Inventário FTP SIM/SINASC | ftp://ftp.datasus.gov.br/dissemin/publicos/{SIM,SINASC} | FTP LIST | SINASC definitivo 1996–2024 (27 UFs + 2 códigos extras por ano); SIM CID10 definitivo 1996–2024; PRELIM 2025–2026 (SIM e SINASC). Em /SINASC/NOV/DNRES o definitivo termina em 2022; 2023–2024 só em /SINASC/1996_/Dados/DNRES. |
| TST-P8-02 | SIM + SINASC 2024, 27 UFs, por município de residência | ftp://…/SINASC/1996_/Dados/DNRES/DN{UF}2024.dbc ; …/SIM/CID10/DORES/DO{UF}2024.dbc | download 54 arquivos DBC → DBF; agregação por CODMUNRES | 2.389.325 nascidos; 1.532.015 óbitos não fetais; 30.020 óbitos <1 ano (IDADE 0xx–3xx); TMI Brasil 12,56‰. 5.584 códigos de residência (5.570 do IBGE + 14 códigos UF-ignorado xx0000). Maternos (CAUSABAS O00–O95,O98–O99, sexo F): 1.326 → RMM 55,5/100 mil NV. Cesárea (PARTO=2): 60,6%. CONSPRENAT válido em 98,4%; ≥6 consultas em 87,5% dos válidos. Nascimentos fora do município de residência: 34,5%; óbitos infantis: 48,6%. |
| TST-P8-03 | CNES LT (leitos) e ST (estabelecimentos) 2026-09, 27 UFs | ftp://…/CNES/200508_/Dados/{LT,ST}/{LT,ST}{UF}2609.dbc | download 54 DBC | LT: 51.965 linhas (CNES × tipo/código de leito); 543.524 leitos existentes (362.715 SUS, 180.809 não SUS; QT_EXIST = QT_SUS + QT_NSUS em 100% das linhas); sem hospital-dia (TP_LEITO 7): 528.275 → 2,47 por 1.000 hab. (SUS 1,66). 3.605 municípios com ≥1 leito; 1.966 sem leito registrado. ST: 501.726 estabelecimentos em 5.571 municípios; 131.831 com vínculo SUS; UBS (TP_UNID 02) 43.841 em 5.469 municípios; hospitais (05,07) 6.636 em 3.159 municípios. |
| TST-P8-04 | Histórico CNES LT (ES) | ftp://…/CNES/200508_/Dados/LT/LTES{AAMM}.dbc | download | LTES1301 (1.029 linhas), LTES1812 (991), LTES2301 (1.023) recuperados; LTES0508 inexistente (série ES começa depois de 2005-08). DT_ATUAL do ST tem datas futuras (até 2027-04) e 72.955 registros com DT_ATUAL anterior a 2023. |
| TST-P8-05 | CNES PF, EQ, SR, EP — ES 2026-09 | ftp://…/CNES/200508_/Dados/{PF,EQ,SR,EP}/…ES2609.dbc | download | PF: 145.836 vínculos/40 campos (7,6 MB); EQ: 26.875 linhas/28 campos; SR: 23.595 linhas; EP: 2.552 (equipes). Escala nacional por razão de estabelecimentos (ST ES 10.270 / BR 501.726 = 1/48,9): PF ≈ 7,1 mi, EQ ≈ 1,31 mi por competência. |
| TST-P8-08 | SIH-RD ES 2024 (12 meses) | ftp://…/SIHSUS/200801_/Dados/RDES24{01..12}.dbc | download 12 DBC (23,6 MB) | 307.500 AIH, R$ 533,4 mi (VAL_TOT = valor aprovado), 73 CNES com AIH. ICSAP 15,5% (47.561). Internações de residentes fora do município: 54,6%. Óbitos hospitalares (MORTE=1): 11.968 (3,9%). Vitória: 18.335 AIH de residentes (26,1% fora); 65.329 AIH ocorridas em 9 CNES, 79,3% de residentes de outros municípios. Layout: 113 campos em 2020; 95 em 2013-01; 86 em 2008-01. |
| TST-P8-09 | SIH-RD Brasil, 27 UFs, 2024-06 + lista ICSAP | ftp://…/SIHSUS/200801_/Dados/RD{UF}2406.dbc (89,2 MB) | download 27 DBC; DIAG_PRINC × lista oficial | 1.188.890 AIH (1.188.340 N_AIH únicos), R$ 1,970 bi, 53.714 óbitos hospitalares, ICSAP 15,8%. 5.570/5.571 municípios com ≥1 AIH de residente; 3.062 municípios onde alguma AIH foi faturada. Residentes do ES: 25.915 (arquivos nacionais) vs 25.651 (só RDES) → −1,0%. Municípios sem hospital CNES com AIH de residentes: 2.411/2.412. |
| TST-P8-10 | SIA-PA ES 2024-06 e SIGTAP | ftp://…/SIASUS/200801_/Dados/PAES2406.dbc (33 MB) ; ftp2…/TabelaUnificada_202610_v2610151110.zip | download; decodificação; agregação por PA_PROC_ID | 1.109.849 linhas/59 campos; 1.067 estabelecimentos; 44.337 pares estab×procedimento. Consultas (QTDAPR): 0301010072 médica especializada 210.799; 0301010064 médica atenção primária 18.308; 0301010056 saúde do trabalhador 533; 0301010307 teleconsulta médica 2.304; (não médicas: 0301010048 143.350; 0301010030 21.429). A atenção primária quase não aparece no SIA. |
| TST-P8-11 | e-Gestor APS: competências e cobertura 2026-08 | https://relatorioaps-prd.saude.gov.br/cobertura/aps?unidadeGeografica=MUNICIPIO&coUf={UF}&nuCompInicio=202608&nuCompFim=202608 | GET JSON (27 chamadas, 36 s) | 79 competências listadas (201912–202608; faltam 202511 e 202601). 5.570 municípios devolvidos (IBGE lista 5.571); Brasil 98,77% (213.418.341 hab., 56.244 eSF). qtCobertura>100 em 4.755 municípios (mediana 148,8; máx 408,9): cobertura NÃO é limitada a 100. Vitória: 346.500/343.378 = 100,9. População-base: DOU 2025. |
| TST-P8-12 | e-Gestor APS: quebra metodológica | …/cobertura/{ab/aps}?unidadeGeografica=MUNICIPIO&coMunicipio=320530&nuCompInicio=C&nuCompFim=C | GET JSON | /cobertura/ab responde 201912–202012 (pcCoberturaAb, pcCoberturaSf; Vitória 202001: AB 92,28 / SF 79,89) e 0 linhas de 202112 em diante; /cobertura/aps responde de 202112 (Vitória 92,46; 202212 89,44; 202301 101,55; 202312 104,02; 202412 107,26; 202512 101,05; 202608 100,9) e 0 linhas até 202012. 2021 inteiro não foi testado mês a mês. |
| TST-P8-13 | Cobertura vacinal — parquet SIPNIBD | ftp://…/Dados_Abertos/SIPNIBD/Cobertura_Residencia.parquet | download (5,1 MB) | 1.088.479 linhas; 2015–2026; 36 rótulos de imunobiológico (variações de nome entre anos); 5.570–5.571 municípios por ano desde 2021; carga 01/07/2026 (2026 parcial). Campos: CO_ANO, CO_UF, CO_MUNICIPIO, NU_IMUNO, QT_DOSE, NU_POPULACAO, NU_TAXA_COBERTURA, DT_CARGA. Vitória BCG: 2017 142%; 2019 124%; 2021 91%; 2022 55% (TabNet 2022: 55,1% — confere). Doses_Residencia.parquet = 1,17 GB, não baixado. |
| TST-P8-14 | Cobertura vacinal — TabNet POST e regra oficial | http://tabnet.datasus.gov.br/cgi/webtabx.exe?bd_pni/cpnibr.def ; ftp://…/PNI/DOCS/Regrascobertura2013.pdf | POST (Linha=Município, Coluna=Ano, Incremento=BCG, PAno=2019,2022) ; leitura do PDF | 5.569 municípios com BCG; 2.303 acima de 100% em 2022; Brasil 86,67% (2019) e 90,09% (2022). Fórmula do TabNet: soma(QT_DOSE)×100/soma(NU_POPULACAO). PDF oficial: cobertura = doses aplicadas / população na idade-alvo × 100; denominador = SINASC; regras de dose (D3, DU, reforço) mudam por período. Séries TabNet terminam em 2022. |
| TST-P8-15 | Previne Brasil — indicadores de desempenho | https://apidadosabertos.saude.gov.br/atencao-primaria/indicador-desempenho-programa-previne-brasil | GET JSON (filtros uf, quadrimestre, codigo_municipio, competencia) | Somente 2024Q1, Q2 e Q3 em Vitória; 2024Q3: 100.242 linhas, 5.570 municípios, códigos 10,20,30,40,50,70 × 3 visões (válidas, homologadas, geral). O campo "percentual" não é numerador/denominador (mediana 92 vs 58,8 do cálculo do código 10); denominador<30 em 2.198 municípios. Dicionário dos códigos não localizado: significado NÃO verificado. |
| TST-P8-16 | SIAPS atendimento individual (MIAI) | https://apidadosabertos.saude.gov.br/atencao-primaria/siaps-atendimento-individual | GET JSON (competencia_siaps, municipio) | Competências testadas: 202101, 202312, 202412, 202506, 202603 → 0 linhas; 202512 → 13.489 linhas em Vitória, 100.992 registros (49.829 de categoria MÉDICO). Agregado por categoria profissional, CID/CIAP, tipo de atendimento e equipe. Não há campo de encaminhamento/seguimento. |
| TST-P8-17 | Siconfi: RREO Anexo 02 (função Saúde) e RGF Anexo 01 | https://apidatalake.tesouro.gov.br/ords/siconfi/tt/{rreo/rgf} | GET JSON | Vitória 2024 bim.6: 3.234 linhas RREO; Saúde: dotação atualizada R$ 546,5 mi, empenhado 503,0 mi (92,0%), liquidado 457,5 mi (83,7%), inscrito em RPNP 45,5 mi. RGF 2024 Q3 Executivo: DTP 41,53% da RCL ajustada, limite máximo 54%. Anexos servidos: 01,02,03,04,06,07,09,10,11,13,14 — NÃO há Anexo 08 (MDE) nem 12 (ASPS) em Vitória, SP, Recife, BH, nem em ES-UF e SP-UF. |
| TST-P8-18 | Siconfi: DCA Anexos I-E, I-F, I-G | …/dca?an_exercicio=2024&id_ente=3205309&no_anexo=DCA-Anexo I-E | GET JSON | I-E (Vitória, 10 - Saúde): empenhadas 503,0 mi; liquidadas 457,5 mi; pagas 447,8 mi; RPNP inscritos 45,5 mi; RPP inscritos 9,6 mi. I-G (restos a pagar por função): RPNP inscrito até 31/12 anterior 47,4 mi; liquidados/pagos 35,4 mi; cancelados 13,7 mi; RPP pagos 6,1 mi. DCA e RREO existem desde 2015 (2013: 0 linhas). |
| TST-P8-19 | SIOPS: rotas e formulário legado | https://siops-consulta-publica-api.saude.gov.br ; https://siops.saude.gov.br ; https://siops.datasus.gov.br/rel_LRF.php | GET/POST | API pública: /swagger-ui/, /v3/api-docs, /v2/api-docs → 404; /swagger-resources → []. App novo siops.saude.gov.br: env.js aponta siops-backend/-gestor-api/-relatorio-api (área com login). PHP legado rel_LRF.php: POST com cmbAno/cmbUF/cmbMunicipio/cmbPeriodo respondeu "O Municipio mun – mun não transmitiu os dados": parâmetros reais não confirmados. Extração do indicador "% ASPS" NÃO comprovada. |
| TST-P8-20 | Siconfi: amostra aleatória de 150 municípios (seed 8) | …/rreo ; …/rgf | GET JSON (RREO bim.6 ou RREO Simplificado sem.2; RGF Q3 ou RGF Simplificado) | 150/150 com despesa Saúde (RREO Anexo 02) e DTP %RCL (RGF Anexo 01). 86 usam RREO/RGF padrão, 64 usam os Simplificados. Despesa de Saúde empenhada per capita: mediana R$ 1.242 (p10 493; p90 2.276). DTP do Executivo: mediana 43,9% da RCL ajustada (29,7–77,4); 9/150 acima de 54%. Três municípios pequenos (Alto Rio Novo, Serra da Saudade, André da Rocha) têm 0 linhas no RREO padrão e dados completos no Simplificado. |
| TST-P8-21 | IBGE: municípios e população | https://servicodados.ibge.gov.br/api/v1/localidades/municipios ; https://apisidra.ibge.gov.br/values/t/6579/n6/all/v/9324/p/last | GET JSON | 5.571 municípios (um novo, sem nascidos em 2024); população 2026: 214.211.951. Atenção: o prefixo 3200359 = Alto Rio Novo (código de 6 dígitos 320035); 320040 é Anchieta. |
| TST-P8-22 | Normas: LC 141/2012 e LRF | https://www.planalto.gov.br/ccivil_03/leis/lcp/lcp141.htm ; …/lcp101.htm | GET HTML | LC 141 art. 6º: Estados e DF, mínimo 12%; art. 7º: Municípios e DF, mínimo 15% (redação da LC 227/2026). LRF art. 19: União 50%, Estados 60%, Municípios 60% da RCL; art. 20: Executivo municipal 54% / Legislativo 6%; Executivo estadual 49%. |
| TST-P8-23 | Amostras territoriais (14 municípios + 78 do ES) | (derivado de TST-P8-02/03/09/11/13) | junção por código IBGE de 6 dígitos | Ver seção 18. ES: 78/78 municípios com nascidos; 31 sem hospital CNES; 22 sem leito; TMI do ES pela soma dos municípios 12,20‰; óbitos <1 ano por UF = 610 vs soma municipal 609 (um óbito sem município de residência). |
| TST-P8-24 | DEMAS: SIM, SINASC, população SVSA, PNI doses | https://apidadosabertos.saude.gov.br/{vigilancia-e-meio-ambiente/…/vacinacao/doses-aplicadas-pni-2024} | GET JSON (limit) | SIM: devolve registros (campos minúsculos, só limit/offset, sem filtro municipal). SINASC: 0 linhas. svsa-populacao-residente (ano=2024, cod_mun=320530): 0 linhas. PNI doses 2024: microdado individual (paciente, estabelecimento, vacina, data), só limit/offset. Swagger de 113 rotas em /static/swagger.json. |
| TST-P8-25 | DEMAS CNES: campos | https://apidadosabertos.saude.gov.br/assistencia-a-saude/cnes-{estabelecimentos,leitos,equipamentos,profissionais} | GET JSON (limit=1) | Estabelecimentos: nu_comp, co_ibge, co_cnes, nu_cnpj, tp_gestao, tp_unidade, ds_natureza_juridica, nu_latitude, nu_longitude, ds_status. Leitos: nu_comp (200812 em Vitória), tp_leito, ds_leito, qt_existente, qt_sus. Equipamentos: tp_equipamento, qt_existente, qt_uso, disp_sus. Profissionais: traz no_profissional (nome em claro), ds_cbo, carga horária, equipe (co_ine). Dado pessoal: agregar antes de armazenar. |
| TST-P8-26 | Busca por fontes de espera, absenteísmo e satisfação | (busca web + swagger DEMAS) | WebSearch + leitura do swagger | Não há base nacional de tempo de espera nem de absenteísmo. Painéis estaduais/municipais existem (RS Painel de Dados da Regulação, POA, MPDFT Mapa Social da Saúde sobre SISREG), sem teste de extração nesta fase. DEMAS tem "ouvidoria/ouvidor2/3" (manifestações) — não é satisfação. PMAQ (módulo III) existe nas publicações acadêmicas, sem URL de microdados confirmada. |

**Receitas de reprodução (resumo).**

- *Mortalidade infantil:* `DN{UF}2024.dbc` e `DO{UF}2024.dbc`; decodificar com `pyreaddbc.dbc2dbf`; `numerador = DO[TIPOBITO=='2' & IDADE[0] in '0123'].groupby('CODMUNRES').size()`; `denominador = DN.groupby('CODMUNRES').size()`; `taxa = numerador / denominador × 1000`.
- *ICSAP:* `DIAG_PRINC[:3] ∈ C3 or DIAG_PRINC[:4] ∈ C4` com a lista da Portaria SAS 221/2008.
- *Cobertura de APS:* `GET /cobertura/aps?unidadeGeografica=MUNICIPIO&coUf=32&nuCompInicio=202608&nuCompFim=202608`.
- *Vacinação:* `pd.read_parquet('Cobertura_Residencia.parquet')`; `QT_DOSE / NU_POPULACAO`.
- *Siconfi:* `GET /rreo?an_exercicio=2024&nr_periodo=6&co_tipo_demonstrativo=RREO&id_ente=3205309` (ou `RREO Simplificado`, `nr_periodo=2`).

---

## 33. Conclusão e recomendação

1. **Comece por SIM/SINASC/PNI/CNES via FTP**: são os indicadores de maior valor público, cobertura nacional comprovada, sem credencial, e já têm collectors planejados (EXEC-C35, C30). Em conjunto com o e-Gestor (APS) formam o núcleo do MVP, com cerca de 2 GiB de PostgreSQL.
2. **Não publique rankings ou semáforos.** Em municípios pequenos, mortalidade infantil e materna são ruído (2.387 municípios com <100 nascidos; 4.786 sem óbito materno). Publicar com média plurianual, intervalo de confiança ou por região de saúde.
3. **Rotular com precisão**: "despesa da função Saúde" (não ASPS), "despesa total com pessoal do Executivo" (não da Saúde), "cobertura de doses" (não de indivíduos), "capacidade de equipes" (não acesso).
4. **Trate o SIOPS como pendência de discovery**, não como prova negativa. Enquanto isso, ASPS não deve ser aproximado por despesa da função Saúde.
5. **Cinco indicadores não devem entrar no produto**: ocupação de leitos, resolutividade, satisfação (inviáveis com dado público), absenteísmo e tempo de espera (dependem de integração local).
6. **Pergunte ao especialista** as 14 questões da seção 30 antes de congelar definições (principalmente 02, 06, 09, 11, 12 e 18).

*P8 encerrada. Não iniciei a P9.*
