# Modelo de identidade escolar · P10.1

Migration **v9** (`packages/db/src/exec/ddl-v9.ts`), aditiva e reversível (`DROP` de três tabelas; nada existente depende delas). `exec_entity` **não foi alterada** (o `CHECK (kind BETWEEN 1 AND 5)` permanece): a escola liga-se ao município por `exec_edu_school_year.entity_id`.

## 1. As três tabelas

| Tabela | Chave | Papel | Colunas |
|---|---|---|---|
| `exec_edu_school` | `inep` (inteiro de 8 dígitos) | **Identidade.** Alvo das chaves estrangeiras das ondas P10.2+ (matrículas, infraestrutura, docentes, Ideb, programas). Só cresce. | `inep` |
| `exec_edu_school_year` | `(inep, year)` | **Fotografia por edição.** Um registro por escola × edição do Censo. | `entity_id` (município **naquela** edição), `name`, `dep` (1 federal, 2 estadual, 3 municipal, 4 privada), `loc` (1 urbana, 2 rural, NULL), `sit` (1 em atividade, 2 paralisada, 3 extinta no ano, 4 extinta em anos anteriores), `flags` |
| `exec_edu_cov` | `(year, uf)` | **Cobertura** por edição × UF: contrato das contagens. | `layout`, `rows_in`, `valid`, `rejected`, `active`, `with_mat`, `univ`, `muns` |

`flags`: bit0 = matrícula na educação básica > 0; bit1 = **recorte da Sinopse** (em atividade **e** com matrícula); bit2 = nome ausente no arquivo (recebe o rótulo neutro "Escola <código>").

Índices: a PK `(inep, year)` serve "escola por código" e "histórico de uma escola"; `exec_edu_school_year_ent (year, entity_id)` serve "escolas por município e ano" e "por UF e ano" (UF = semi-junção sobre `exec_entity.uf_code`). Nenhum outro índice foi criado: dependência, situação e localização filtram dentro de uma fatia município × ano (centenas de linhas) ou são agregadas.

## 2. Decisões de eficiência (G1)

1. **Sem tabela de histórico de nomes** (a proposta da P10 previa `exec_edu_school_name` e `exec_edu_school_identity`). Nome, município, dependência, localização e situação **já estão por edição** no snapshot; a mudança é a comparação de duas edições consecutivas (`LAG` por `inep`), calculada sob demanda (`getEducationSchoolHistory`) e nos relatórios. Uma tabela de nomes duplicaria o dado sem benefício de consulta: o histórico de uma escola são ≤ 19 linhas lidas pela PK.
2. **Sem `exec_ind_value`/indicadores para contagens de escolas.** As contagens por território saem de `exec_edu_school_year` e de `exec_edu_cov` com índice; replicá-las como indicadores seria a duplicação que a diretriz proíbe. Quando uma página precisar de série pronta, usa `getEducationMunicipalitySchools().series`.
3. **Sem `jsonb`.** Todas as colunas são tipadas e curtas (smallint/integer + o nome).
4. **Sem chave interna substituta.** O código INEP (8 dígitos, cabe em `integer`) é a chave natural estável e a única relevante para as ondas seguintes; um `serial` extra só somaria uma coluna e uma junção.
5. **Carga inicial sem change log.** A primeira publicação de uma fatia (UF × edição) usa `bootstrap` (como as ondas anteriores): as linhas inseridas não geram eventos de log (o log custaria mais que os próprios dados: 218 B por evento). A integridade da carga inicial vem da reconciliação e do replay a partir do RAW; **retificações** (hash diferente) publicam só o que mudou, com log, e têm rollback exato.
6. **Identidade fora do hash da fatia.** `exec_edu_school` é gravada na fase `derive` da mesma transação (a FK de `exec_edu_school_year` é `DEFERRABLE INITIALLY DEFERRED`: verificada no COMMIT). Assim o hash da fatia cobre só o que é da fatia e o rollback de uma UF/edição continua válido depois de outras UFs/edições serem publicadas.

## 3. Regras de significado

- Cadastro (linha do arquivo) ≠ escola em atividade (`sit = 1`) ≠ escola com matrícula (bit0) ≠ recorte da Sinopse (bit1) ≠ escola pública ≠ rede municipal ≠ escola localizada no município.
- **Ausência numa edição não é fechamento.** Só `sit` 2/3/4, informado pela fonte, é paralisação/extinção. As edições 2007–2010 só listam escolas em atividade (`sit` = 1 em 100% das linhas): a ausência nelas não informa nada. A API devolve lacunas como `AUSENTE_NA_EDICAO_NAO_IMPLICA_FECHAMENTO`.
- O município e a dependência são os registrados **na edição**; a mudança entre edições é um evento da escola (transição), não uma correção do passado.
- Linhas rejeitadas (código inválido/duplicado, município inexistente, UF incompatível, dependência/localização/situação fora do domínio) não entram no snapshot; ficam contadas em `exec_edu_cov.rejected`, em `exec_ingestion_run.quality` (motivos e até 50 números de linha) e nunca com dados pessoais.

## 4. Privacidade (G7)

Colunas **gravadas**: código INEP, município, UF (via município), nome oficial da escola, dependência, localização, situação e dois indicadores de universo. **Não existem** colunas de gestor, CPF, e-mail, telefone, endereço, CEP, latitude/longitude nem dado de aluno/docente (o teste de migração falha se uma coluna com esses nomes aparecer). O extrator (`scripts/exec/censo_escola_extract.py`) lê **8 colunas** do arquivo oficial (whitelist) e ignora as demais; para 2025 só as tabelas `Escola` e `Matrícula` foram copiadas ao RAW (por Range): `Gestor` e `Docente` nunca foram baixadas.

## 5. Pontos de extensão para as próximas ondas

- P10.2 (matrículas/turmas/oferta): `exec_edu_school_offer_year (inep, year, …)` com FK para `exec_edu_school`; o bit0 de `flags` já existe e será conferido contra a soma por escola.
- P10.3 (infraestrutura/docentes): `exec_edu_school_infra_year (inep, year, …)`; docentes **não somam** entre escolas.
- P10.4 (Ideb/Saeb): `exec_edu_school_indicator (inep, …)`.
- P10.6/P10.7: PDDE por escola usa `inep`; contratos e obras só se ligam a escola com chave oficial (nunca por texto).
- Os read models devolvem `extensions: {}` nos pontos onde essas ondas se encaixam.
