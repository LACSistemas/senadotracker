# Modelo de matrículas, turmas e oferta · P10.2

Migration **v10** (`packages/db/src/exec/ddl-v10.ts`), aditiva e reversível (`DROP` de três tabelas). Catálogo tipado das medidas: `packages/db/src/exec/educacao-oferta-catalog.ts` (31 entradas; `MATRIZ_INDICADORES_P102.csv` é gerada dele).

## 1. As três tabelas
| Tabela | Chave | Papel |
|---|---|---|
| `exec_edu_offer_year` | `(inep, year)` | **Uma linha por escola × edição do universo** (`mat_bas > 0` ou `tur_bas > 0`). 30 colunas inteiras de medida. FK composta para `exec_edu_school_year (inep, year)` (cadastro da P10.1): não existe oferta de escola sem identidade e sem registro na edição. |
| `exec_edu_offer_agg` | `(year, uf, dep, loc)` | Somas por edição × UF × dependência × localização (211 linhas na edição de 2025), para séries de UF e Brasil sem varrer 4 milhões de linhas. Gerada da mesma fatia, na mesma transação e dentro do mesmo hash. |
| `exec_edu_offer_cov` | `(year, uf)` | Cobertura: linhas lidas, válidas, rejeitadas, escolas com matrícula, com turma e só com turma. |

Publicação: dataset `DATASET.edu_oferta = 71` (independente do cadastro, dataset 70), fatia UF × edição, competência `ano × 100 + 5`, `publishSlice`. Primeira publicação de cada fatia sem change log (`bootstrap`); retificação (hash diferente) registra só o que mudou e tem rollback exato.

**Regra de ausência.** Escola do cadastro **sem** linha de oferta = sem matrícula e sem turma no arquivo da edição, o que equivale ao `bit0 = 0` de `exec_edu_school_year.flags`. Cada publicação **verifica** isso: `bit0 ⇔ existe linha com mat_bas > 0` para todas as escolas da UF e edição; qualquer divergência aborta a fatia inteira (provado em teste).
**NULL × 0.** `NULL` = a edição não tem a coluna; `0` = zero declarado. Turno (`mat_noturno`, `mat_ead`) só existe a partir de 2014; tempo integral de turmas (`tur_int_*`) só a partir de 2023; antes disso a coluna é `NULL`, nunca zero.

## 2. Semântica, com a prova de cada regra
Todas as provas são linha a linha sobre o RAW (scripts em `reproducibilidade/`, resultados em `evidencias/`).

1. **Matrícula não é aluno.** `QT_MAT_BAS` conta vínculos aluno–turma na data de referência; o mesmo aluno pode ter mais de uma matrícula (nota 1 da Sinopse 1.2). Não existe aluno único no dado aberto.
2. **Partição exata da matrícula básica.** Em **2023, 2024 e 2025, em 100% das escolas** (178.476, 179.286 e 178.766):
   `QT_MAT_BAS = INF + FUND + MED + EJA + curso técnico concomitante + curso técnico subsequente + FIC concomitante` (2025 acrescenta o itinerário técnico exclusivo: curso técnico e qualificação profissional), diferença total 0 (`particao_exata_matricula.json`). Antes de 2023 os campos profissionais separados não existem; o **resto** `BAS − (INF + FUND + MED + EJA)` é calculado, **nunca negativo em nenhuma das 19 edições** (`residuo_profissional.json`) e igual à educação profissional não integrada onde se pode conferir. Por isso o catálogo define `mat_prof_ni` (derivada) e as etapas aditivas: creche, pré-escola, anos iniciais, anos finais, médio, EJA fundamental, EJA médio e profissional não integrada.
3. **Sub-partições exatas** (100% das escolas em todas as edições testadas): `INF = creche + pré`, `FUND = AI + AF`, `EJA = fundamental + médio`, `ESP = classes comuns + classes exclusivas`. Turno: `diurno + noturno + EAD = BAS` exato de 2014 a 2025 e **falso antes** (partição incompleta em 2007–2013), por isso turno é `NULL` até 2013.
4. **Medidas transversais (nunca somar às etapas).** `mat_prof` (educação profissional total) inclui o técnico integrado ao médio, que já está em `mat_med`; `mat_esp_cc/ce` é um recorte da matrícula básica (nunca maior que ela: 0 violações); tempo integral é subconjunto de cada etapa (nunca maior que a etapa: 0 violações).
5. **Turmas.** `QT_TUR_*` conta turmas (exclui atividade complementar e AEE). O arquivo é **uma linha por escola** (não por turma): 0 códigos duplicados nas 19 edições e nas duas tabelas de 2025. Turma multietapa conta em cada etapa: `TUR_BAS − (INF + FUND + MED + EJA)` nunca é negativo (0 violações), mas as etapas podem somar mais que o total quando há técnico integrado. Em **2025**, 4.696 turmas de EJA (2.663 escolas) não têm etapa fundamental/médio classificada: o total de turmas de EJA (`tur_eja`) é a medida de partição, e fundamental + médio é só informativo.
6. **Universo.** Em 2007–2024 as escolas com matrícula e com turma são exatamente as mesmas; em 2025, 6 escolas têm turma e nenhuma matrícula (`only_tur`).
7. **Tamanho médio de turma.** O read model devolve `matPorTurma = Σ matrículas ÷ Σ turmas do mesmo recorte` (razão de somas, nunca média de médias), rotulado como derivado. Não substitui o indicador oficial do INEP (alunos por turma), que fica para a P10.3 junto com os Indicadores Educacionais.
8. **Tempo integral é série descontínua.** Matrículas de ensino fundamental em tempo integral: 3,18 mi (2013), 4,48 (2014), 4,65 (2015), **2,51 (2016)**, 3,79 (2017), 2,56 (2018), 1,94 (2020), 3,89 (2023), 4,82 (2025): queda de 46% de 2015 para 2016 e oscilação seguinte. A definição não foi verificada edição a edição; só comparar de 2016 em diante, com aviso (`PUBLICO_COM_CONDICOES`).
9. **Erro do dicionário.** A célula de nota de `QT_TUR_BAS` no dicionário oficial de 2025 repete o texto de "Docentes" (copiado de outra variável): o contrato usa a nota 2 da Sinopse 4.1 ("não inclui turmas de AC e AEE; inclui todas as turmas de ensino regular e/ou EJA").

## 3. O que NÃO foi feito (e por quê)
- Sem tabela por ano, UF, município ou indicador; sem JSONB; sem cópia do CSV; sem replicar o cadastro (a escola é a FK da P10.1).
- Sem `exec_ind_value`: município, UF e Brasil saem de `exec_edu_offer_year`/`exec_edu_offer_agg` com índices; replicar 30 medidas × 5.598 entes × 19 anos como indicadores seria duplicação sem ganho.
- Sem estudantes únicos, sexo, cor/raça, faixa etária, deficiência individual nem gestor/docente: a whitelist do extrator (`scripts/exec/censo_oferta_extract.py`) lê só contagens de etapa, modalidade, jornada e turno. `Tabela_Gestor` e `Tabela_Docente` não foram baixadas.
- Sem taxa de atendimento (matrículas ÷ população da idade): depende de população por faixa etária e metodologia (P10.9).
