# Arquitetura de persistência da Educação no Modelo D · G15

Estado: **CLEAR_TO_IMPLEMENT** (P10.1 pode começar pela camada de identidade; DDL abaixo é **proposta, não executada**) · Base: `inventario_reuso_civica_educacao.md`, `contrato_identidade_escolas.md`, `contratos_benchmarks_educacao.md`, `contrato_privacidade_educacao.md`.

## 1. Princípios (a menor extensão possível)
1. **Não alterar nenhuma tabela existente** (Saúde, Segurança, Legislativo continuam intactas). Só tabelas novas; exceção única e opcional: coluna de cobertura de função 12 em `exec_fin_cov` (P10.5, §6).
2. **Três camadas**: identidade institucional → fatos especializados → indicadores territoriais (reusando `exec_ind_def/value/latest`).
3. **Sem** tabela por estado, município ou ano; **sem** indicador duplicado por fonte; **sem** motor financeiro paralelo; **sem** cópia independente do PNCP.
4. Publicação, hash, rollback e log pelo motor existente (`publishSlice`, `rollbackRun`, `replayFrom`, `exec_change_log`), com `dataset_id`/`tableId` novos em `specs.ts`.
5. Escola **não** vira `exec_entity` (o `CHECK (kind BETWEEN 1 AND 5)` e o uso de `kind` em leituras de Saúde/Segurança tornariam isso arriscado). Escola é entidade própria que **aponta** para `exec_entity` (município).

## 2. Camada 1 — identidade (P10.1)
```sql
-- PROPOSTA (não executada)
CREATE TABLE civica_exec.exec_edu_school (
  school_id   integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  inep_code   integer NOT NULL UNIQUE CHECK (inep_code BETWEEN 10000000 AND 99999999),
  first_year  smallint NOT NULL, last_year smallint NOT NULL
);
CREATE TABLE civica_exec.exec_edu_school_snapshot (   -- 1 linha por escola × edição do Censo
  school_id integer NOT NULL REFERENCES civica_exec.exec_edu_school,
  year      smallint NOT NULL,
  entity_id integer NOT NULL REFERENCES civica_exec.exec_entity,   -- município (kind 4/5) da edição
  uf_code   smallint NOT NULL,
  dependencia smallint NOT NULL CHECK (dependencia BETWEEN 1 AND 4),   -- 1 fed, 2 est, 3 mun, 4 priv
  rede smallint, localizacao smallint, loc_dif smallint,
  situacao smallint NOT NULL CHECK (situacao BETWEEN 1 AND 4),         -- 1 ativa, 2 paralisada, 3 extinta, 4 extinta antes
  offer_mask integer NOT NULL DEFAULT 0,                               -- etapas ofertadas (bits)
  PRIMARY KEY (school_id, year)
);
CREATE TABLE civica_exec.exec_edu_school_name (       -- só quando o nome muda
  school_id integer NOT NULL REFERENCES civica_exec.exec_edu_school, year_from smallint NOT NULL, name text NOT NULL,
  PRIMARY KEY (school_id, year_from)
);
CREATE TABLE civica_exec.exec_edu_school_identity (   -- mesma escola em outras fontes
  source smallint NOT NULL, code text NOT NULL, school_id integer NOT NULL REFERENCES civica_exec.exec_edu_school,
  valid_from smallint NOT NULL DEFAULT 0, valid_to smallint, evidence_ref text,
  PRIMARY KEY (source, code, valid_from)
);
CREATE TABLE civica_exec.exec_edu_cov (               -- cobertura por fonte × ano × UF
  source smallint NOT NULL, year smallint NOT NULL, uf_code smallint NOT NULL, status smallint NOT NULL, rows integer NOT NULL, expected integer,
  PRIMARY KEY (source, year, uf_code)
);
CREATE INDEX ON civica_exec.exec_edu_school_snapshot (entity_id, year, dependencia);
CREATE INDEX ON civica_exec.exec_edu_school_snapshot (year, dependencia, situacao);
```
Regras: `UNIQUE(inep_code)`; `situacao` e `dependencia` vêm do arquivo; ausência numa edição = **sem linha de snapshot** (nunca "extinta"); `exec_edu_school_identity` guarda PDDE (`co_escola` = INEP, `evidence_ref` = "mesmo código"), obras e quaisquer fontes futuras.

## 3. Camada 2 — fatos especializados
Tabelas **largas por família** (uma linha por escola × ano), porque o modelo estreito (`school, year, measure, value`) estimado em G16 chega a >150 M linhas.
```sql
-- PROPOSTA (não executada) — colunas = whitelist de privacidade e de aditividade
CREATE TABLE civica_exec.exec_edu_school_offer_year (  -- P10.2
  school_id integer NOT NULL, year smallint NOT NULL,
  mat_bas integer, mat_inf_cre integer, mat_inf_pre integer, mat_fund_ai integer, mat_fund_af integer, mat_med integer, mat_eja integer, mat_prof integer, mat_integral integer,
  tur_bas integer, tur_inf_cre integer, /* … */ doc_bas integer,
  flags integer NOT NULL DEFAULT 0,          -- IN_COMUM_*, IN_EJA, IN_PROFISSIONALIZANTE, IN_ESPECIAL_EXCLUSIVA (bits)
  PRIMARY KEY (school_id, year), FOREIGN KEY (school_id, year) REFERENCES civica_exec.exec_edu_school_snapshot
);
CREATE TABLE civica_exec.exec_edu_school_infra_year (  -- P10.3: 0 = declarou que não tem, 1 = tem, NULL = não informado
  school_id integer NOT NULL, year smallint NOT NULL,
  internet smallint, banda_larga smallint, biblioteca smallint, lab_info smallint, quadra smallint, agua_rede smallint, energia_rede smallint, esgoto_rede smallint, /* … */
  salas_utilizadas smallint, desktop_aluno smallint, comp_portatil_aluno smallint,
  PRIMARY KEY (school_id, year)
);
CREATE TABLE civica_exec.exec_edu_school_indicator (   -- P10.4: indicadores OFICIAIS por escola (Ideb, N, P, TDI, ATU, HAD, AFD, IED, IRD, DSU, ICG, INSE, rendimento)
  school_id integer NOT NULL, edition smallint NOT NULL, indicator_id smallint NOT NULL, stage smallint NOT NULL, value real,
  PRIMARY KEY (school_id, edition, indicator_id, stage)
);
```
- **Financeiro (P10.5):** reutiliza `exec_fin_fact` (função 12 já existe; subfunções entram com novos `exec_ref_code`); SIOPE em `exec_edu_siope_fact(entity_id, exercicio, periodo, item_id, valor bigint)` + `exec_edu_siope_decl(entity_id, exercicio, periodo, decl_date, retificadora, hash)`. Sem `Remuneracao_Siope` e sem `Dados_Responsaveis`.
- **Programas (P10.6):** `exec_edu_transfer(ym, tipo, fav_kind, entity_id, cnpj bigint, acao smallint, plano smallint, valor bigint)` (Portal, filtrado por função 12); `exec_edu_pdde(school_id, year, programa_id, previsto bigint, devido bigint, pago bigint, uex_cnpj bigint)`; `exec_edu_uex(cnpj bigint, school_id, valid_from)` (crosswalk escola–UEx; valida o vínculo U→UEx→escola).
- **Contratos e obras (P10.7):** `exec_fin_contract` (única cópia) + `exec_fin_contract_class` (ver `plano_reuso_pncp_educacao.md`); `exec_edu_work(work_id text PK, uf smallint, entity_id integer, situacao smallint, prev_start date, prev_end date, valor_prev bigint, executor_cnpj bigint)` (sem texto livre de endereço).
- **Superior (P10.8):** `exec_edu_ies(ies_id integer PK, co_ies integer UNIQUE, co_mantenedora integer)`, `exec_edu_ies_year(ies_id, year, entity_id, rede, categoria, organizacao, doc_total, …)`, `exec_edu_course_offer_year(ies_id, year, co_curso integer, entity_id, modalidade smallint, grau smallint, nivel smallint, vagas, inscritos, ingressantes, matriculas, concluintes, …, PRIMARY KEY (ies_id, year, co_curso, entity_id, modalidade, row_seq smallint))` (`row_seq` resolve as 461 duplicatas medidas em 2023).

## 4. Camada 3 — indicadores territoriais
Reusar `exec_ind_def/value/latest`: o **domínio 2 (Educação) já está reservado** em `DOMAIN` (`packages/db/src/exec/indicator-defs.ts`: saúde 1, educação 2, segurança 3, bem-estar 4, infraestrutura 5) e nenhuma definição o usa ainda; `indicator_id` em faixa própria (coluna `smallint`: livre de 9001 a 32767). Os bits `FLAG` já existentes (`smallN`, `preliminary`, `partialCoverage`, `suppressed`, `unavailable`, `notInformed`, `inexistent`, `composite`…) cobrem os estados de dado da Educação sem novo mecanismo. Sugestão: 9001–9199 cadastro/matrícula (P10.1–2), 9201–9399 infraestrutura/docentes (P10.3), 9401–9599 aprendizagem (P10.4), 9601–9799 finanças (P10.5), 9801–9899 programas (P10.6), 9901–9999 contratos/obras (P10.7), 10001+ superior (P10.8). Entidades: Brasil (kind 1), UF (3), município (4). Marcas: `flags` (suprimido, parcial, descontinuidade 2019, rede), `valid_from/valid_to`, `method_version` quando a metodologia muda.
- `exec_ind_latest` e as leituras de benchmark seguem o mesmo contrato dos módulos de Segurança.
- Série **só** com os anos publicados; 2022–2023 sem população → nenhuma taxa per capita.

## 5. Performance (índices e leitura)
- Página de município: 1 consulta por família a `exec_ind_latest`/`exec_ind_value` por `entity_id` (padrão P9.8: ≤ 60 SQL por página) + 1 para escolas da rede (`exec_edu_school_snapshot` por `(entity_id, year, dependencia)`).
- Página de escola: `school` por `inep_code` + 3 consultas por PK `(school_id, year)`.
- Índices: `inep_code`; `(school_id, year)`; `(entity_id, year, dependencia)`; `(year, dependencia, situacao)`; `exec_ind_value` já indexado por `(entity_id, indicator_id, period)` (verificar no plano de execução na P10.9).
- Estimativas de linhas e GB: `estimativa_armazenamento_educacao.csv`.

## 6. Mudanças em tabelas existentes (somente duas, ambas aditivas)
1. `exec_fin_cov`: o campo `fn06 CHECK (fn06 IN (0,1))` é de Segurança. Proposta: **nova coluna** `fn12 smallint NOT NULL DEFAULT 0 CHECK (fn12 IN (0,1))` (aditiva; reversível com `DROP COLUMN`). Teste de regressão: fingerprints P9.7/P9.8.
2. `exec_fin_contract`: aceitar novos códigos em `org_kind`/`theme` (faixa ≥ 200) — sem alteração de esquema (colunas `smallint`).
Nenhuma delas renumera ids existentes.

## 7. Migrations previstas (não executadas)
| Versão | Conteúdo | Reversão |
|---|---|---|
| v9 (P10.1–4) | `exec_edu_school*`, `exec_edu_cov`, `exec_edu_school_offer_year`, `…_infra_year`, `…_indicator`, ref codes novos e definições do domínio 2 | `DROP TABLE` das tabelas novas; `DELETE` dos ref codes/indicadores do domínio 2 |
| v10 (P10.5–7) | `fn12` em `exec_fin_cov`, `exec_edu_siope_*`, `exec_edu_transfer`, `exec_edu_pdde`, `exec_edu_uex`, `exec_fin_contract_class`, `exec_edu_work` | idem; `DROP COLUMN fn12` |
| v11 (P10.8) | `exec_edu_ies*`, `exec_edu_course_offer_year` | `DROP TABLE` |
Cada migration seguida do padrão P9: backup `pg_dump -Fc` em `D:\Civica\backups`, restauração em cluster de teste, `lc_messages=C` nos testes antigos, fingerprints antes/depois.

## 8. Riscos
- Tabelas largas exigem disciplina de whitelist (privacidade) — o teste de esquema da G14 cobre.
- `exec_change_log` (3,3 GB) cresce com cada publicação; escolas são ≈ 215 mil linhas/ano: planejar espaço (G16). A retenção do log **não** é aplicada nesta fase.
- Faixa de ids de indicador deve ser registrada antes de qualquer script paralelo (lição da P9.6: ids posicionais).
