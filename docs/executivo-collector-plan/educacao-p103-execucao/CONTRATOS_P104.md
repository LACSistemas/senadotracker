# Contratos para a P10.4 (Aprendizagem, Ideb, Saeb e fluxo escolar) · G19

Estado: **PASS**. Esta fase **não coletou** Ideb nem Saeb; entrega o que a P10.4 encontra pronto e as regras de integração.

## 1. O que já existe (P10.1 + P10.2 + P10.3)
| Item | Onde | Garantia medida |
|---|---|---|
| Identidade escolar e histórico 2007–2025 | `exec_edu_school`, `exec_edu_school_year (inep, year)` | 299.547 códigos; 4.272.656 escola × edição; 513 fatias |
| Oferta por etapa, matrículas e turmas | `exec_edu_offer_year (inep, year)` | `mat_fund_ai`, `mat_fund_af`, `mat_med` por escola; FK para o cadastro |
| Infraestrutura | `exec_edu_infra_year (inep, year)` | 3.597.617 escolas em atividade × edição; 100 variáveis; estados SIM/NAO/NAO_INFORMADO/FORA_DA_EDICAO |
| Indicadores oficiais do INEP por escola | `exec_edu_ind_school (inep, year)` | 3.512.097 linhas; ATU, HAD, DSU, AFD, IED, IRD, ICG |
| Indicadores oficiais por Brasil/região/UF/município × dependência × localização | `exec_edu_ind_terr (year, entity_id, dep, loc)` | 1.287.807 linhas |
| Docentes distintos oficiais | `exec_edu_doc_terr (year, entity_id)` | Brasil, UF e município, 2007–2025 |
| Cobertura | `exec_edu_cov`, `exec_edu_offer_cov`, `exec_edu_infra_cov`, `exec_edu_ind_cov` | por edição × UF |
| Publicação | datasets 70, 71, 72, 73 e 74, competência `ano × 100 + 5` | `NO_CHANGE`, retificação com log, rollback exato |
| Leitura | `getEducation{National,State,Municipality,School}Offer`, `…Infra`, `getEducationTerritoryIndicators`, `getEducationSchoolIndicators`, `getEducationTeachers` | pontos `extensions: {}` |
| RAW | `D:\Civica\raw\inep\` (Censo, indicadores, sinopse_docentes) com SHA-256 no manifesto | **não rebaixar** |
| Ids livres | dataset ≥ 75, `table_id` ≥ 93, migration v13 | conferir em `specs.ts` |

## 2. Regras de integração
1. **Chave e edição.** Ideb e Saeb por escola chegam com o mesmo `inep` e o ano do Censo é o ano do Ideb (o Ideb sai em ciclos de dois anos; Saeb idem). Use FK para `exec_edu_school_year (inep, year)`. Escola que não existir no cadastro da edição é rejeitada com motivo, nunca criada.
2. **Etapas do Ideb = partições da P10.2.** Anos iniciais = `mat_fund_ai`, anos finais = `mat_fund_af`, ensino médio = `mat_med`. O universo "escola com anos iniciais" é `mat_fund_ai > 0` na edição. Quem tem Ideb é decisão de participação do INEP: não inferir.
3. **Mesma regra de ausência.** NULL = não publicado / suprimido; zero publicado é zero; "fora da edição" é estado próprio. Mesmo vocabulário de estados de `getEducationSchoolInfra`.
4. **Rede e território.** Dependência pela edição (`exec_edu_school_year.dep`); Ideb de rede/município/UF/Brasil vem **pronto do INEP** e nunca se calcula como média das escolas. Mesma regra dos indicadores da P10.3.
5. **Taxas de rendimento, transição e distorção idade-série.** Famílias já inventariadas (`inep_indicadores_arquivos.csv`: 188 arquivos, ≈ 2,9 GB) e **não baixadas** na P10.3: mesmo extrator genérico (`censo_ind_extract.py`, só ampliar as tabelas de códigos) e mesmo formato escola × edição / território × recorte. Layouts por era já conhecidos (2007–2016, 2017–2018, 2019+).
6. **Denominadores.** Matrícula da etapa (P10.2) é o peso para descrever cobertura (quantas matrículas estão em escolas com Ideb), nunca para recalcular o Ideb. Infraestrutura (P10.3) é contexto, não explicação causal: **não** construir "efeito da biblioteca no Ideb" nesta fase.
7. **Docentes.** Para escola, só os indicadores oficiais (DSU, AFD, IED, IRD); para território, docentes distintos da Sinopse. Não somar.
8. **Comparabilidade.** Cada família leva sua própria nota de quebra metodológica; Ideb muda de metodologia entre ciclos. Herdar o campo `comparability` do catálogo.
9. **Privacidade.** Sem microdados de aluno (Saeb por aluno é proibido); só agregados oficiais por escola, município, UF e Brasil. Pequenos números: mesma regra de supressão do INEP, sem inferir valor suprimido.
10. **Armazenamento.** Folga acumulada ≈ 2,5 GB dos 5 GB (`CUSTO_REAL_ARMAZENAMENTO_P103.md`). Piloto de armazenamento antes do backfill, como nas ondas anteriores.

## 3. O que ainda NÃO existe e a P10.4 precisa construir
Ideb, Saeb, taxas de rendimento/transição, distorção idade-série, INSE, tabelas de ligação do Ideb (por escola, município, UF), contratos de nota técnica por ciclo, leitura por escola/território e benchmarks de aprendizagem.

## 4. Fora do escopo da P10.4 (para não antecipar)
Programas do FNDE, obras, contratos, SIOPE, ensino superior e frontend.
