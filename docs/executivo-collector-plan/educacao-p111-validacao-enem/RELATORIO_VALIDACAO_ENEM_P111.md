# P11.1 — Prova empírica do ENEM municipal

Data da execução: 27/10/2026. Banco consultado apenas em leitura: `projetoeleitor_db`. Raw/staging: `D:\Civica`.

## Resumo executivo

Os microdados oficiais do ENEM 2023, 2024 e 2025 foram baixados integralmente, tiveram tamanho e SHA-256 conferidos e foram processados em streaming. A prova fecha a publicação de desempenho por **município da escola de conclusão**, rede administrativa, UF da escola e Brasil. Ela não fecha desempenho por município de residência: essa dimensão foi removida dos arquivos públicos.

O resultado nacional reconcilia exatamente com as Sinopses do Inep nos inscritos, presença nos dois dias, Matemática e redação. A semântica de redação correta é `TP_STATUS_REDACAO = 1`; contar toda nota numérica superestima o denominador.

**P11.1 = PASS_WITH_DOCUMENTED_SOURCE_LIMITATIONS.**

## Fonte e inventário

| Ano | ZIP | Bytes | SHA-256 | Resultado |
|---|---|---:|---|---|
| 2023 | `microdados_enem_2023.zip` | 549.511.687 | `19512B7E29C9C8E940554396969722081341CAA275C245A6C9D2D559C5D13A0A` | 200 / application/zip |
| 2024 | `microdados_enem_2024.zip` | 526.073.856 | `69EE52DBCDAE61410A7B2C31B776F396F2DA30FEBFC1D2856E9E0AD064C76FB1` | 200 / application/zip |
| 2025 | `microdados_enem_2025.zip` | 1.035.674.693 | `B8D3E72CBF387EE08F18D552367005429017D43EEA1F6D4B9BAFE1D83A116071` | 200 / application/zip |

Página oficial: [Microdados do Enem](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/enem). Sinopses: [Sinopses Estatísticas do Enem](https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/sinopses-estatisticas/enem).

## Campos realmente publicados

`CO_MUNICIPIO_ESC`/`NO_MUNICIPIO_ESC` existem nos três resultados. `TP_DEPENDENCIA_ADM_ESC` permite separar federal, estadual, municipal e privada. As quatro presenças e notas, status/redação e conclusão do Ensino Médio foram validados no dicionário real. `CO_ESCOLA` só aparece em 2024–2025 e é limitado por mascaramento de células pequenas. Município de residência não aparece.

Em 2024–2025, `PARTICIPANTES` e `RESULTADOS` não têm chave comum; portanto, não foi feito join. `TP_ST_CONCLUSAO` é comprovado na base de participantes, mas não é atribuído a uma escola/nota individual.

## Provas territoriais

Foram calculados `n` de linhas de resultados, presença, presença nas quatro provas, notas válidas, média, mediana e redação por município-alvo e rede. O arquivo `PROVAS_MUNICIPAIS_ENEM.csv` contém também UF e Brasil para comparação.

Exemplo de Matemática (todos os tipos de rede):

| Edição | Vitória (escola) média/mediana | ES média/mediana | Brasil média/mediana |
|---|---:|---:|---:|
| 2023 | 614,0 / 620,4 | 568,5 / 571,6 | 533,8 / 523,6 |
| 2024 | 584,3 / 579,1 | 540,9 / 524,5 | 527,0 / 499,0 |
| 2025 | 585,5 / 578,6 | 538,2 / 524,8 | 520,0 / 500,0 |

O recorte de rede é material: em Vitória 2023, Matemática média estadual foi 537,7 e privada 685,5; a tabela completa preserva os denominadores. Afonso Cláudio foi usado como município pequeno: 98, 167 e 191 linhas em 2023–2025, respectivamente (evidência separada em `evidencias/small_municipality_afonso_claudio.json`).

## Reconciliação nacional

| Edição | Inscritos | Presentes nos dois dias | Matemática válida | Redação válida |
|---|---:|---:|---:|---:|
| 2023 | 3.933.955 | 2.678.264 | 2.692.427 | 2.704.814 |
| 2024 | 4.332.944 | 2.990.093 | 3.004.981 | 3.002.710 |
| 2025 | 4.810.772 | 3.244.348 | 3.260.336 | 3.245.696 |

Todos os deltas contra as Sinopses são zero. Médias e medianas coincidem, salvo erro de representação decimal inferior a 1e-10.

## Privacidade e publicação

Nenhum identificador de participante, código de escola ou linha bruta foi para o repositório de evidências. A publicação futura exige supressão de células pequenas e revisão jurídica. A base permite análise escolar-territorial agregada, não perfil de pessoa nem cruzamento residência↔escola.

## Gates

- `G0_SAFETY`: PASS — read-only, raw em D, processos existentes não interrompidos.
- `G1_SOURCE_ACCESS`: PASS — três ZIPs oficiais 200, tamanho e SHA conferidos; Sinopses 2023–2025 200 e baixadas em staging.
- `G2_SCHEMA_PROVEN`: PASS_WITH_LIMITATIONS — schema/dicionários reais; residência NOT_PUBLISHED, `CO_ESCOLA` ausente em 2023 e mascarado em 2024–2025.
- `G3_TERRITORIAL_PROOFS`: PASS_WITH_LIMITATIONS — municípios de escola, UF, Brasil e rede; não residência.
- `G4_NATIONAL_RECONCILIATION`: PASS — inscritos, presença, Matemática e redação reconciliam exatamente.
- `G5_PRIVACY`: PASS_FOR_AGGREGATE_ONLY — nenhum identificador persistido; publicação pública ainda requer política de supressão/jurídico.
- `G6_STORAGE_PERFORMANCE`: PASS — streaming em 64–85 s/edição, sem espelhamento no banco; bruto em D.
- `G7_PRODUCT_READINESS`: PASS_WITH_LIMITATIONS — pronto para read model escolar-territorial, não para residência ou join participante-escola.

## Readiness separado

`READY_FOR_P11_2_IES = YES` (as limitações do ENEM não bloqueiam IES).

`READY_FOR_ENEM_COLLECTOR = YES_WITH_LIMITATIONS` (coleta agregada por escola/UF/rede, sem joins e sem residência).

`READY_FOR_ENEM_PUBLICATION = NO` (aguarda supressão de células pequenas e revisão jurídica).

Nenhum collector, migration, frontend ou schema foi alterado. P11.1 termina aqui; P11.2 não é iniciada automaticamente.
