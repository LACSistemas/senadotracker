# Contrato de matrículas, turmas e oferta · G4

Estado: **PASS_WITH_CAVEATS** · Fase consumidora: P10.2 (depende de P10.1) · Provas: `censo_2025_reconciliacao_matriculas.json`, `censo_escolar_headers.json`, `censo_escolar_variaveis_x_ano.csv`, Sinopse Estatística 2025 (tabelas 1.1 e 1.2, lidas do arquivo oficial).

## 1. Unidade estatística (oficial, nota da Sinopse 2025)
- **Matrícula, não aluno**: "O mesmo aluno pode ter mais de uma matrícula". Nenhum número do Cívica pode ser rotulado "alunos".
- **Não inclui** matrículas de turmas de Atividade Complementar e de Atendimento Educacional Especializado (AEE).
- Nível do dado aberto: **agregado por escola** (`QT_MAT_*`, `QT_TUR_*`, `QT_DOC_*`), tanto em 2007–2024 (um CSV) quanto em 2025 (tabelas separadas). Não existe aluno individual no dado aberto.

## 2. Dimensões e medidas disponíveis (por escola × ano)
| Dimensão | Variáveis (exemplos reais) | Anos |
|---|---|---|
| Ano | `NU_ANO_CENSO` | 2007–2025 (todas as 6 tabelas, exceto Gestor 2019+) |
| Município/UF/região | `CO_MUNICIPIO`, `SG_UF`, `CO_REGIAO` | 2007–2025 |
| Dependência/rede | `TP_DEPENDENCIA` (1 federal, 2 estadual, 3 municipal, 4 privada), `CO_REDE`, `TP_CATEGORIA_ESCOLA_PRIVADA` | 2007–2025 |
| Localização | `TP_LOCALIZACAO` (1 urbana, 2 rural), `TP_LOCALIZACAO_DIFERENCIADA` | 2007–2025 |
| Etapa | `QT_MAT_INF_CRE`, `QT_MAT_INF_PRE`, `QT_MAT_FUND_AI` (+ séries), `QT_MAT_FUND_AF`, `QT_MAT_MED` (+ séries) | 2007–2025 |
| Modalidade | `QT_MAT_EJA`, `QT_MAT_ESP`, `QT_MAT_MED_PROP/_IFTP_*/_NM`, cursos técnicos (`Tabela_Curso_Tecnico`) | 2007–2025 (IFTP e `QT_MAT_MED_IFA` entram em 2025) |
| Tempo integral | `QT_MAT_BAS_INT`, `QT_TUR_BAS_INT` | 2007–2025 |
| Turno | variáveis `*_DIURNO/_NOTURNO` por etapa (dicionário) | conforme matriz |
| Sexo/cor/idade/PCD | `QT_MAT_BAS_FEM/MASC/BRANCA/PRETA…/_0_3…` | 2007–2025 → **sensíveis** (G14) |
| Turmas | `QT_TUR_BAS`, `QT_TUR_*` (inclui `QT_TUR_FUND_AI_MULTIETAPA`) | 2007–2025 |

## 3. Identidades verificadas (arquivos oficiais, 2025)
| Teste | Resultado |
|---|---|
| Σ `QT_MAT_BAS` das 178.766 escolas com matrícula (Tabela_Matricula) | **46.018.380** |
| Sinopse 2025, Brasil, total | **46.018.380** → diferença **0** |
| Σ por dependência (fed 383.526 · est 13.330.302 · mun 23.059.168 · priv 9.245.384) | igual à Sinopse 1.2 nas 4 dependências |
| Rede pública (fed+est+mun) | 36.772.996 = Sinopse |
| Σ por UF = Σ por município = Brasil | 46.018.380 = 46.018.380 |
| Município de teste (Vitória, 3205309) | 77.662 = Sinopse 1.2 (pública 55.427: fed 2.635 · est 11.879 · mun 40.913; privada 22.235) |
| Creche + Pré-escola = Educação Infantil | 4.182.646 + 5.103.536 = 9.286.182 |
| Anos Iniciais + Anos Finais = Ensino Fundamental | 14.514.244 + 11.292.523 = 25.806.767 |
| Linhas sem correspondência na Tabela_Escola | 0 |

Conclusão: `Σ escolas = município` e `Σ municípios = UF = Brasil` **valem** para a matrícula total e por dependência, porque a matrícula é contada na escola onde está localizada. A reconciliação entra como gate de publicação da P10.2.

## 4. Aditividade (regra para a P10.2)
- **Aditivas entre si (partições exclusivas confirmadas):** creche + pré-escola; anos iniciais + anos finais; as quatro dependências; urbana + rural.
- **Não aditivas com a etapa:** EJA, Educação Especial (`QT_MAT_ESP`), Educação Profissional e tempo integral são **recortes que cruzam etapas** (a mesma matrícula entra em etapa e modalidade). Soma de etapas (9.286.182 + 25.806.767 + 7.370.879 = 42.463.828) **não** é o total (46.018.380): o restante vem de EJA, cursos técnicos não articulados etc. Nenhuma soma "etapa + modalidade" pode ser publicada.
- **Turmas:** `QT_TUR_*` contam turmas; turma **multietapa** (`QT_TUR_FUND_AI_MULTIETAPA`, `…_AF_MULTI`) aparece em mais de uma coluna → turmas por etapa não somam o total. "Classe" (AEE/atividade complementar) não é turma regular.
- **Escola × oferta:** os indicadores de oferta estão na Tabela de Escola desde 2007: `IN_COMUM_CRECHE`, `IN_COMUM_PRE`, `IN_COMUM_FUND_AI`, `IN_COMUM_FUND_AF`, `IN_COMUM_MEDIO_MEDIO/_INTEGRADO/_NORMAL`, `IN_COMUM_PROF`, `IN_EJA`, `IN_PROFISSIONALIZANTE`, `IN_ESPECIAL_EXCLUSIVA` (`IN_COMUM_MEDIO_FIC` só em 2025). "Escolas com oferta de X" é contagem de escolas, não de matrículas.
- Zero × ausente: `QT_*` vazio ≠ 0; escola ausente da edição = lacuna (G3).

## 5. Totais oficiais para reconciliar
Sinopse Estatística da Educação Básica (zip `https://download.inep.gov.br/dados_abertos/sinopses_estatisticas/sinopse_estatistica_censo_escolar_AAAA.zip`; 2025: 232 MB, xlsx de 199 MB com 268 abas): tabela 1.1 (etapa × região/UF/município) e 1.2 (localização × dependência). Edições 2007–2025 listadas na página (40 links). O XLSX é grande: a P10.2 deve ler por fluxo só as abas 1.1/1.2 (a leitura completa não é necessária).

## 6. Indicadores derivados oficiais (já calculados pelo INEP)
Média de alunos por turma (ATU), horas-aula diárias (HAD), distorção idade-série (TDI), taxas de rendimento (aprovação/reprovação/abandono): arquivos por escola/município/UF/Brasil (ver `contrato_infraestrutura_docentes.md` e `contrato_aprendizagem_ideb_saeb.md`). Preferir os oficiais ao recálculo.

## 7. Contrato de saída (P10.2)
`exec_edu_school_year` (escola × ano) com as medidas da whitelist; **agregações municipais/estaduais calculadas no banco e verificadas contra a Sinopse**; indicadores em `exec_ind_value` só para medidas aditivas (matrícula total, por etapa exclusiva e por dependência); taxa de escolarização só com denominador do mesmo ano (população por idade do Censo 2022 via SIDRA t/9514; não há por idade em 2023–2025: sem interpolar).

## 8. Limitações
- Turmas não foram reconciliadas com a Sinopse (tabela de turmas = 100 MB; não baixada).
- Séries 2007–2018 vs 2019+ têm variáveis redefinidas (ver matriz).
- Anos 2007–2024: matrícula está no CSV único; só 2021–2024 foram lidos linha a linha nesta fase (contagem de escolas), não as matrículas.
