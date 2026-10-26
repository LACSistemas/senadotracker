# Contratos de benchmarks de condições educacionais · P10.3 (G14)

Estado: **PASS_WITH_CAVEATS**. Prepara a P10.9 e a P10.10. Nada aqui é página; são regras e contratos para comparar sem enganar. Ressalva: os benchmarks por escola dependem de uma decisão jurídica de exibição (ver `PRIVACIDADE_PUBLICABILIDADE_P103.md`).

## 1. Indicadores comparáveis (mesmo indicador, mesmo ano, mesma unidade, mesma definição, mesmo universo)
| Benchmark | Fonte no banco | Unidade e denominador | Observação |
|---|---|---|---|
| % de escolas com internet | `exec_edu_infra_year.internet`, agregados `exec_edu_infra_agg` | sim ÷ (sim + não) | acesso declarado, não qualidade |
| % de escolas com biblioteca e/ou sala de leitura | `biblioteca_ou_leitura` | idem | única medida presente nas 19 edições |
| % com laboratório de informática / de ciências | `lab_informatica`, `lab_ciencias` | idem | |
| % com quadra, cozinha, refeitório | `quadra`, `cozinha`, `refeitorio` (2012+) | idem | |
| % com recurso de acessibilidade (rampa, elevador, piso tátil…) | `acess_*` (2019+) | idem | só de 2019 em diante |
| % de escolas com água da rede, energia da rede, esgoto da rede | `agua_rede`, `energia_rede`, `esgoto_rede` | idem | |
| Formação: % de docentes no grupo 1 de adequação | `afd_*1` | % **publicado pelo INEP** | por etapa |
| Docentes com curso superior | `dsu_*` | % de funções docentes, publicado | |
| Esforço docente / regularidade | `ied_*`, `ird_*` | publicado | |
| Média **oficial** de alunos por turma | `atu_*` (`MEDIA_OFICIAL_INEP`) | publicado | difere da razão derivada da P10.2 |
| Horas-aula diárias | `had_*` | publicado | |

## 2. Recortes de comparação
- **Município × mediana dos municípios da mesma UF**, mesmo ano, mesma dependência e localização do recorte, apenas municípios com o indicador publicado e denominador mínimo (≥ 5 escolas para percentuais de infraestrutura; abaixo disso, mostrar o número e não ranquear).
- **UF × Brasil** ou distribuição das 27 UFs.
- **Escola × escolas da mesma etapa e dependência no município/UF** (nunca entre etapas diferentes).
- A mediana é calculada **sobre os valores oficiais territoriais**, nunca como média simples de percentuais de escolas para reconstruir o percentual de um território.

## 3. Comparações enganosas (proibidas)
1. Comparar escola de educação infantil com escola só de ensino médio para concluir "melhor infraestrutura": o conjunto de ambientes esperado difere por etapa (use `exec_edu_offer_year` da P10.2 para filtrar a etapa; `getEducationMunicipalityInfra` aceita `stage`).
2. Apresentar diferença de infraestrutura como prova de qualidade pedagógica.
3. Criar índice único de "qualidade escolar" ou de "infraestrutura" (sem metodologia aprovada).
4. Comparar 2007–2018 com 2019–2025 em variável redefinida (`DISCONTINUED`/`NEW_VARIABLE`), ou tratar "fora da edição" como "não".
5. Tratar "não informado" (2022, 4.259 escolas) como "sem infraestrutura".
6. Somar docentes de escolas, redes ou etapas; média de percentuais de escolas para obter o percentual do município; reconstruir valor suprimido por subtração.
7. Confundir `MEDIA_OFICIAL_INEP` (ATU) com `RAZAO_DERIVADA_CIVICA` (matrículas ÷ turmas, P10.2).
8. Comparar rede municipal com "escolas localizadas no município" (herdado da P10.2).
9. Ranquear escolas por percentual de formação docente quando o número de docentes é pequeno.
10. Rotular escola como "conectada para aprender" a partir do acesso à internet.

## 4. Contrato de saída (para a P10.9/P10.10)
Cada benchmark devolve: `{indicador, ano, território, recorte (dep, loc, etapa), valor, unidade, denominador (n escolas ou docentes quando conhecido), fonte, comparabilidade, estado (SIM/NAO/NAO_INFORMADO/FORA_DA_EDICAO), restrições}`. As funções de leitura já entregam esse contrato: `getEducationNationalInfra`, `getEducationMunicipalityInfra` (com `stage`), `getEducationSchoolInfra`, `getEducationTerritoryIndicators`, `getEducationSchoolIndicators`, `getEducationTeachers`.
