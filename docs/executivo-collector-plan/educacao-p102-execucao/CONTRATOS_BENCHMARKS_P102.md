# Contratos de benchmark de base · P10.2 (G12)

Estado: **PASS_WITH_CAVEATS** (contratos definidos e dados prontos; a consolidação em benchmarks por porte, grupo e quintil é a P10.9). Nada aqui é ranking de qualidade.

## 1. Medidas de comparação que a P10.2 já sustenta
Todas saem de `getEducationMunicipalityOffer`, `getEducationStateOffer` e `getEducationNationalOffer`, sobre o mesmo ano e o mesmo recorte de rede/localização.

| Código | Medida | Fórmula (mesmo ano, mesmo universo) | Comparável entre | Regra de elegibilidade |
|---|---|---|---|---|
| B1 | Composição da matrícula por etapa | etapa ÷ `mat_bas` (a partição soma 100%) | municípios, UFs, Brasil, redes | denominador ≥ 30 matrículas; senão "pequeno número" |
| B2 | Participação da educação infantil | (creche + pré-escola) ÷ `mat_bas` | idem | idem |
| B3 | Distribuição por dependência | matrículas da dependência ÷ `mat_bas` do **conjunto de escolas localizadas no território** | idem | rotular "escolas localizadas", nunca "rede municipal do município" |
| B4 | Matrículas por escola | Σ `mat_bas` ÷ escolas com oferta | idem, dentro da mesma dependência e localização | ≥ 5 escolas no grupo |
| B5 | Turmas por escola | Σ `tur_bas` ÷ escolas com oferta | idem | ≥ 5 escolas no grupo |
| B6 | Matrículas por turma (derivada) | Σ matrículas da etapa ÷ Σ turmas da **mesma** etapa e do mesmo recorte | idem, só dentro da mesma etapa e dependência | ≥ 5 turmas; não é o indicador oficial do INEP (P10.3) |
| B7 | Evolução de matrículas | índice com ano-base explícito por etapa (e variação % entre duas edições nomeadas) | série do mesmo território | só edições publicadas; mostrar descontinuidades (ver §3) |
| B8 | Educação de Jovens e Adultos e educação profissional | participação (EJA, profissional não integrada) e evolução | idem | profissional total (`mat_prof`) só com a nota de sobreposição ao médio |
| B9 | Tempo integral | `mat_int_x` ÷ `mat_x` da etapa | idem | **só 2016 em diante**; aviso de série descontínua |
| B10 | Educação especial | (classes comuns + exclusivas) ÷ `mat_bas` | município agregado, UF, Brasil | célula com 1 a 4 matrículas suprimida; **nunca por escola** (`NEEDS_LEGAL_VALIDATION`, ver `LICENCA_E_USO_DADOS_INEP.md`) |

## 2. Redes: o que comparar
Separar sempre: (a) **todas as escolas localizadas** no município; (b) **rede municipal** (dependência 3); (c) **rede estadual** (2); (d) **rede federal** (1); (e) **rede privada** (4). Uma comparação entre municípios só vale dentro do mesmo recorte. Um município pode ter escola da rede municipal registrada em outro município e, sobretudo nos pequenos, depende da rede estadual para o ensino médio: comparar "matrículas no município" com "matrículas da prefeitura" é erro.

## 3. Descontinuidades conhecidas (medidas)
| Item | Evidência |
|---|---|
| Turno (`mat_noturno`, `mat_ead`) | só partem o total a partir de 2014; antes, `NULL` |
| Tempo integral de matrículas | fundamental: 4,65 mi (2015) → 2,51 mi (2016); oscilação até 4,82 mi (2025) |
| Tempo integral de turmas | só a partir de 2023 |
| Educação profissional (campos separados) | só a partir de 2023; antes, o resto derivado |
| EJA de turmas, 2025 | 4.696 turmas sem etapa classificada (a Sinopse as atribui ao fundamental) |
| Total de matrículas 2007 → 2025 | 53,03 mi → 46,02 mi (−13%), queda geral com oscilações (sobem em 2008 e em 2022); a etapa de educação infantil cresce (6,57 mi → 9,29 mi em `QT_MAT_INF`) |

## 4. Proibições (valem para P10.9 e P10.10)
1. Nenhum ranking de municípios por número absoluto de matrículas, turmas ou escolas como se medisse desempenho ou esforço.
2. Nenhuma taxa de atendimento ou "universalização" sem população da faixa etária correspondente e metodologia (P10.9).
3. Nenhuma soma de etapas com modalidades transversais (educação profissional total, educação especial, tempo integral, turno).
4. Nenhum "alunos" no lugar de "matrículas"; nenhum aluno único.
5. Nenhum zero no lugar de `NULL` (edição sem a variável) e nenhuma interpolação de anos.
6. Nenhuma média de médias: toda razão é soma ÷ soma do mesmo recorte.
7. Nenhuma comparação de tamanho de turma entre etapas diferentes; nenhum uso de B6 como substituto do indicador oficial.
8. Nenhuma comparação de um município de 5 mil habitantes com São Paulo em valores absolutos; usar composição (B1–B3) ou grupos de porte (P10.9).

## 5. Regra de pequenos números (para publicação)
- Percentual só com denominador ≥ 30 matrículas (≥ 5 turmas para B6); abaixo disso, exibir a contagem e o selo "pequeno número".
- Categoria de educação especial com 1–4 matrículas: suprimida no recorte município; por escola, não publicada.
- Em qualquer recorte, a supressão complementar (evitar recuperar o valor suprimido por subtração do total) é obrigação da P10.10.

## 6. O que a P10.9 herda
Medidas e fórmulas acima; tabelas `exec_edu_offer_agg` (UF e Brasil) e a soma por município pelo índice `(year, entity_id)`; `matPorTurma`, `stages` e `byDependency` já nos read models; a população por faixa etária (SIDRA 9514, testada com HTTP 200 na P10) e a definição de grupos de porte ficam para a P10.9.
