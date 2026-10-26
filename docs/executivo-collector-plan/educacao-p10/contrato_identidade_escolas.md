# Contrato de identidade histórica das escolas · G3

Estado: **CLEAR_TO_IMPLEMENT** (com 3 pendências de validação listadas no §8) · Fase consumidora: P10.1 · Provas: `censo_identidade_escolas_2021_2025.json` (gerado por `reproducibilidade/censo_identidade_analise.py` sobre TSV compactos extraídos dos arquivos oficiais), `censo_2025_reconciliacao_matriculas.json`.

## 1. Chave natural
**`CO_ENTIDADE` do Censo Escolar = código INEP da escola (8 dígitos).** É também `co_escola`/`CO_ENTIDADE` no PDDE Info, `ID_ESCOLA` nos arquivos do Ideb e do INEP Indicadores (P0/P3/P4: PDDE × Censo 2023 casaram 99,99% das 126.402 escolas, UF 100% consistente).

Medido agora, 5 edições (2021–2025):
| Ano | Escolas (linhas) | Duplicados | Código vazio | Fora do padrão de 8 dígitos |
|---|---:|---:|---:|---:|
| 2021 | 221.140 | 0 | 0 | 0 |
| 2022 | 224.649 | 0 | 0 | 0 |
| 2023 | 217.625 | 0 | 0 | 0 |
| 2024 | 215.545 | 0 | 0 | 0 |
| 2025 | 214.192 | 0 | 0 | 0 |

- **239.155 códigos distintos** aparecem em pelo menos um ano; **198.819 estão nos 5 anos**.
- Unicidade e formato: sem exceção nas 5 edições. Exceções conhecidas e **não observadas** nesta amostra: escolas sem código válido não existem no microdado aberto (a escola entra no Censo já com código); pré-2007 não verificado.

## 2. Persistência e mudanças (evidência)
Transições entre edições consecutivas (escolas presentes nas duas):
| De→Para | Em ambas | Só no ano anterior | Novas | Mudou de município | Mudou de dependência |
|---|---:|---:|---:|---:|---:|
| 2021→2022 | 216.559 | 4.581 | 8.090 | 15 | 110 |
| 2022→2023 | 214.626 | 10.023 | 2.999 | 21 | 153 |
| 2023→2024 | 210.581 | 7.044 | 4.964 | 30 | 118 |
| 2024→2025 | 209.209 | 6.336 | 4.983 | 40 | 148 |

- **Mudança de município** e de **dependência administrativa** acontecem todo ano, em dezenas/centenas de escolas: o município e a rede **não fazem parte da identidade**; vão no *snapshot*.
- **Ausência não é encerramento (prova):**
  - 2023→2024: das 7.044 escolas que somem, 771 estavam "em atividade" e 961 "paralisadas" em 2023; só 5.312 já constavam como extintas.
  - 2024→2025: das 6.336 ausentes, 1.674 estavam em atividade e 1.505 paralisadas em 2024.
  - **Ausência intermitente:** 1.675 escolas ausentes só em 2023 (presentes em 2022 e 2024) e 605 ausentes só em 2024 (presentes em 2023 e 2025).
- Situação de funcionamento (`TP_SITUACAO_FUNCIONAMENTO`): 1 em atividade, 2 paralisada, 3 extinta no ano. Transições observadas 2024→2025: paralisada→extinta 3.231; ativa→paralisada 2.782; paralisada→ativa 640; ativa→extinta 446; **extinta→ativa 2** (reativação é rara mas existe).
- Município novo: 2025 traz `5101837` (Boa Esperança do Norte/MT, 7 escolas). **Já existe em `exec_entity`** (kind 4): a ponte territorial cobre.

## 3. Regras (vinculantes na P10.1)
1. **Nunca** inferir encerramento por ausência em uma edição. Encerrada = `TP_SITUACAO_FUNCIONAMENTO = 3` publicado, ou ausente em **todas** as edições seguintes **e** sem situação publicada — este segundo caso entra como `desaparecida_sem_situacao`, nunca como "fechada".
2. **Nunca** unir escolas por similaridade de nome/endereço. A ligação é só por `CO_ENTIDADE`. Nome muda entre edições (não é chave).
3. **Nunca** identificar por CNPJ: escolas públicas não têm CNPJ no Censo; só privadas trazem `NU_CNPJ_ESCOLA_PRIVADA`/`NU_CNPJ_MANTENEDORA` (mantenedora ≠ escola).
4. Município, UF, dependência, rede, localização, situação e etapas ofertadas são **atributos do snapshot (ano)**.
5. Escola não é "da prefeitura" por estar no município: a relação é `escola × dependência` (municipal = rede municipal).
6. Troca de código: não observada nas 5 edições. Se surgir, o vínculo só é aceito com evidência oficial (`CO_ESCOLA_SEDE_VINCULADA` ou nota do INEP), registrado em `school_source_identity` com `evidence_ref`.
7. Escola sem aparecer em edição fica com **lacuna** no calendário (`school_coverage`), nunca com zero de matrícula.

## 4. Modelo (conceitual → ver `arquitetura_educacao_modelo_d.md`)
| Conceito | Chave | Conteúdo |
|---|---|---|
| `school` | `school_id` (interno, `integer`) · `inep_code` (único, 8 dígitos) | primeira/última edição vista, flag de estado derivado, **não** nome |
| `school_snapshot` | (`school_id`, `year`) | município (`entity_id`), UF, dependência, rede, localização, situação, nome da edição, etapas ofertadas (bitmask), revisão |
| `school_source_identity` | (`source`, `code`) → `school_id` | liga o mesmo `inep_code` em PDDE, Ideb, SIOPE (não há), obras; `evidence_ref`, `valid_from/to` |
| `school_education_offer` | (`school_id`, `year`, `measure_id`) | matrículas/turmas/docentes por etapa (P10.2/3) |
| `school_coverage` | (`school_id`, `year`, `source`) | presente / ausente / suprimida, motivo |

## 5. Relação com o município
`school_snapshot.entity_id → exec_entity(entity_id)` (kind 4) via `CO_MUNICIPIO` (IBGE7). Escolas com município inexistente no catálogo vão para `kind 5` ("município ignorado da UF") **apenas se** o código for inválido; nas 5 edições todos os códigos existiam (5.570 em 2021–2024, 5.571 em 2025 = Boa Esperança do Norte, presente no catálogo).

## 6. Índices necessários (prever na migration, não executada)
`UNIQUE(inep_code)`; `(school_id, year)` PK de snapshot; `(entity_id, year, dependencia)`; `(year, dependencia, situacao)`; para leitura municipal: `(entity_id, year)` incluindo matrícula total.

## 7. Migrations previstas (não executadas)
Uma migration `v9` aditiva: `exec_edu_school`, `exec_edu_school_snapshot`, `exec_edu_school_identity`, `exec_edu_school_year` (fatos), `exec_edu_school_cov`. Nenhuma alteração em tabelas existentes (decisão: não estender `exec_entity.kind`).

## 8. Pendências de validação
1. Edições 2007–2020 não foram lidas linha a linha (só o dicionário e a listagem); a persistência 2007→2025 deve ser medida na P10.1 antes de afirmar "série de 19 anos por escola".
2. Cruzamento escola × Ideb × PDDE por código: PDDE × Censo 2023 já medido (P4); Ideb 2025 × Censo 2025 **não** executado (arquivo de escolas AI tem 112 MB; só a dimensão da planilha foi lida: 66.154 escolas, A1:EG66164).
3. Reativações e "extinta → ativa" (2 casos em 2024→2025) precisam de regra de revisão manual na P10.1.
