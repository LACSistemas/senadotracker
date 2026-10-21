# Contratos de consulta — estados e municípios (revisão 2)

Data: 2026-10-19 · Proposta; as tabelas citadas **não existem no banco do Cívica**. As latências são **metas**, a medir no benchmark isolado (referência medida hoje: 49–108 ms em leituras indexadas por Casa, cache frio). Volumes são ordens de grandeza a partir de cardinalidades medidas.

Convenções: `:uf` sigla; `:ufcode` código IBGE da UF (32 = ES); `:saude`/`:educacao` são `domain`; `:vit` = `entity_id` de Vitória; `:ibge` = `source` da população IBGE; `:cnes`; `:ind` = `indicator_id`. Páginas multi-consulta usam `BEGIN READ ONLY ISOLATION LEVEL REPEATABLE READ`. Competências usam `valid_to > c` (intervalos semiabertos). **Nenhuma consulta acessa partição.**

## 0. Verificação executada

O DDL revisado (21 tabelas) e as consultas foram executados num **PostgreSQL 17 descartável** (cluster temporário em diretório de scratch, porta 55432, sem qualquer ligação com `projetoeleitor_db`; removido ao final): (a) o DDL criou as 21 tabelas sem erro; (b) as 13 consultas distintas (Q2 repete Q1; Q15 é uma sequência transacional) executaram sem erro com dados sintéticos mínimos; Q5 e Q9 devolveram as linhas esperadas após acrescentar um município de população semelhante e um hospital sem leitos; (c) `ym_next(202412) = 202501` e `ym_prev(202501) = 202412`; (d) são **rejeitados** pelo banco: competência 202500, segundo intervalo aberto do mesmo CNES, FK para CNES inexistente e `exec_ind_latest` sem valor correspondente; (e) publicação de uma fatia de leitos (mudança + reaparecimento) e **rollback pelo change log** devolveram o estado com **hash idêntico** ao anterior; (f) falha injetada no meio de uma publicação deixou o estado inalterado. Isto prova a *consistência dos contratos*, não latência (os dados são mínimos).

## 1. As 15 consultas

### Q1 · Resumo de Saúde do Espírito Santo
```sql
SELECT s.section, s.source_key, s.built_at, s.payload FROM civica_exec.exec_story s JOIN civica_exec.exec_entity e ON e.entity_id = s.entity_id WHERE e.kind = 3 AND e.uf = :uf AND s.domain = :saude;
SELECT p.dataset_id, p.competence, p.stage, p.activated_at, p.row_count FROM civica_exec.exec_publication p JOIN civica_exec.exec_entity e ON e.uf_code = p.uf AND e.kind = 3 WHERE e.uf = :uf;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_story`, `exec_entity`, `exec_publication` |
| Índices / caminho de acesso | `exec_entity (kind, ibge7)` + `exec_entity (uf_code, kind)`; PK `(entity_id, domain, section)`; PK `(dataset_id, uf, competence)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | nenhuma além do próprio domínio de Saúde; `exec_story` só existe depois da Fase 1E |
| Volume | ≤ 5 + ≈ 15 linhas |
| Cache | `React.cache()` por request; `source_key` ≠ ponteiros ⇒ reconstrução em `after()` (padrão `house_story`) |
| Custo esperado (**meta, não medido**) | < 5 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | UF = entidade `kind 3`; `uf` é a sigla (a mesma de `civica.profiles.uf` em `/quem-me-representa?uf=`); nacional = `uf 0` em `exec_publication` |

### Q2 · Resumo de Saúde do Rio de Janeiro
```sql
-- Q1 com :uf = 'RJ'
```
| Item | Detalhe |
|---|---|
| Tabelas | idem Q1 |
| Índices / caminho de acesso | idem Q1 |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | idem Q1 |
| Volume | idem |
| Cache | idem |
| Custo esperado (**meta, não medido**) | < 5 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | contrato idêntico para as 27 UFs |

### Q3 · Indicadores municipais de Vitória
```sql
SELECT d.code, d.method_version, d.label, d.unit, l.period_start, l.status, l.value, l.numerator, l.denominator, l.flags, l.published_at FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE l.entity_id = :vit AND d.domain = :saude ORDER BY d.sort_order;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_latest`, `exec_ind_def` |
| Índices / caminho de acesso | `exec_ind_latest (entity_id, indicator_id)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | `exec_ind_def` populado; Fase 1E |
| Volume | ≈ 14 linhas |
| Cache | por request; invalidar por `max(activated_at)` |
| Custo esperado (**meta, não medido**) | < 3 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | `exec_ind_latest` guarda a versão metodológica vigente do indicador (id distinto por versão); `status=1` preliminar deve aparecer rotulado; `flags` bit 4 = cobertura parcial; ausência de linha = sem registro |

### Q4 · Todos os municípios do ES com indicadores de Saúde
```sql
SELECT e.entity_id, e.ibge7, e.name, d.code, l.value, l.denominator, l.flags FROM civica_exec.exec_entity e JOIN civica_exec.exec_ind_latest l ON l.entity_id = e.entity_id JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE e.uf_code = :ufcode AND e.kind = 4 AND d.domain = :saude;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_entity`, `exec_ind_latest`, `exec_ind_def` |
| Índices / caminho de acesso | `exec_entity (uf_code, kind)`; `exec_ind_latest (entity_id, indicator_id)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | Fase 1E |
| Volume | 78 × 14 ≈ 1,1 mil (SP ≈ 9 mil) |
| Cache | HTTP `s-maxage` curto + invalidação por ponteiro |
| Custo esperado (**meta, não medido**) | 5–15 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | `kind = 4` exclui o município-ignorado (kind 5); a soma dos municípios ≠ total da UF (a UF inclui o kind 5) |

### Q5 · Municípios de população semelhante a Vitória
```sql
WITH base AS (SELECT value AS pop FROM civica_exec.exec_territory_population WHERE entity_id = :vit AND year = 2026 AND source = :ibge) SELECT p.entity_id, e.name, e.uf, p.value AS pop, d.code, l.value FROM base b JOIN LATERAL (SELECT entity_id, value FROM civica_exec.exec_territory_population WHERE year = 2026 AND source = :ibge AND value BETWEEN b.pop * 0.7 AND b.pop * 1.3 AND entity_id <> :vit ORDER BY abs(value - b.pop) LIMIT 20) p ON true JOIN civica_exec.exec_entity e ON e.entity_id = p.entity_id AND e.kind = 4 JOIN civica_exec.exec_ind_latest l ON l.entity_id = p.entity_id JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE d.domain = :saude AND d.ranking_allowed AND l.denominator >= d.min_denominator;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_territory_population`, `exec_entity`, `exec_ind_latest`, `exec_ind_def` |
| Índices / caminho de acesso | `exec_territory_population (year, source, value)`; PK de entity; `exec_ind_latest (entity_id, indicator_id)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | população 2026 carregada; Fase 1E |
| Volume | ≈ 50 candidatos; 20 × n indicadores |
| Cache | por request |
| Custo esperado (**meta, não medido**) | 5–10 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | filtra `kind = 4` (a tabela de população contém também UFs); só compara indicadores com `ranking_allowed` e denominador mínimo |

### Q6 · Hospitais de um município
```sql
SELECT c.cnes, c.name, v.tp_unid, v.vinc_sus, v.nat_jur FROM civica_exec.exec_sau_cnes_estab_v v JOIN civica_exec.exec_sau_cnes_estab c USING (cnes) WHERE v.entity_id = :vit AND v.valid_to IS NULL AND v.tp_unid IN (5, 7) ORDER BY c.name;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_sau_cnes_estab_v`, `exec_sau_cnes_estab` |
| Índices / caminho de acesso | `exec_sau_cnes_estab_v (entity_id, valid_from)` (filtra o intervalo aberto e o tipo no heap); PK de `exec_sau_cnes_estab` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | identidade (H02) populada; nomes dependem do DEMAS, ausentes ⇒ `name` nulo |
| Volume | Vitória 22; São Paulo ≈ 230 |
| Cache | por request |
| Custo esperado (**meta, não medido**) | < 5 ms; < 30 ms na capital (meta) |
| Risco de query lenta | baixo (se medir lento, índice parcial `WHERE valid_to IS NULL`) |
| Semântica territorial/temporal/flags | "vigente" = intervalo aberto na última competência publicada; `tp_unid` 5 = hospital geral, 7 = hospital especializado (códigos CNES); o município é o do **estabelecimento**, não o de residência dos pacientes |

### Q7 · Abrir um hospital e mostrar seus leitos
```sql
SELECT l.tp_leito, l.cod_leito, l.qt_exist, l.qt_sus, l.qt_nsus, l.valid_from FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = :cnes AND l.valid_to IS NULL ORDER BY l.tp_leito, l.cod_leito;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_sau_cnes_leito_v` |
| Índices / caminho de acesso | PK `(cnes, tp_leito, cod_leito, valid_from)` (prefixo `cnes`) + índice único parcial dos abertos |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | H03 populada |
| Volume | dezenas |
| Cache | por request |
| Custo esperado (**meta, não medido**) | < 2 ms (meta) |
| Risco de query lenta | mínimo |
| Semântica territorial/temporal/flags | `valid_from` mostra desde quando o valor vigente existe; rótulos de tipo via `exec_ref_code` |

### Q8 · Evolução dos leitos de um município desde 2013
```sql
SELECT v.period_start, v.numerator AS leitos_existentes, v.value AS leitos_por_mil, v.status, v.flags FROM civica_exec.exec_ind_value v JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE d.code = 'IND-SAU-05' AND v.entity_id = :vit AND v.period_start >= DATE '2013-01-01' ORDER BY v.period_start;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_value`, `exec_ind_def` |
| Índices / caminho de acesso | PK `(indicator_id, entity_id, period_start)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | IND-05 mensal derivado dos intervalos de leitos e da população (Fase 1A + Fase 0) |
| Volume | 165 linhas (2013-01…2026-09) |
| Cache | por request |
| Custo esperado (**meta, não medido**) | 2–5 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | período = mês da competência (`period_start` = `ym_date(competence)`, `period_end` = primeiro dia do mês seguinte); município sem leito aparece com `numerator = 0`, **não** como ausência, porque o CNES cobre todo estabelecimento; município sem estabelecimento no mês: sem linha |

### Q9 · Estabelecimentos sem leitos cadastrados
```sql
SELECT v.cnes, c.name, v.tp_unid FROM civica_exec.exec_sau_cnes_estab_v v JOIN civica_exec.exec_sau_cnes_estab c USING (cnes) WHERE v.entity_id = :vit AND v.valid_to IS NULL AND v.tp_unid IN (5, 7, 15, 20, 21) AND NOT EXISTS (SELECT 1 FROM civica_exec.exec_sau_cnes_leito_v l WHERE l.cnes = v.cnes AND l.valid_to IS NULL);
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_sau_cnes_estab_v`, `exec_sau_cnes_estab`, `exec_sau_cnes_leito_v` |
| Índices / caminho de acesso | os de Q6 + índice único parcial dos leitos abertos (prefixo `cnes`) |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | H01, H02, H03; lista de tipos com internação possível a validar com especialista |
| Volume | ≤ centenas por município; nacional ≈ 500 mil `NOT EXISTS` |
| Cache | nacional em lote (não em tempo real) |
| Custo esperado (**meta, não medido**) | município < 10 ms; nacional 1–2 s (meta) |
| Risco de query lenta | médio só na versão nacional |
| Semântica territorial/temporal/flags | "sem leito cadastrado" é ausência de registro no CNES, não leito zero; códigos 15, 20, 21 = unidade mista, pronto-socorro geral e especializado (a validar) |

### Q10 · Série histórica de internações de um hospital
```sql
SELECT competence, sum(n_aih) AS aih, sum(valor_cents) AS valor_aprovado_cents, sum(dias_perm) AS dias, sum(obitos) AS obitos FROM civica_exec.exec_sau_hosp_mes_subgrupo WHERE cnes = :cnes GROUP BY competence ORDER BY competence;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_sau_hosp_mes_subgrupo` |
| Índices / caminho de acesso | PK `(cnes, competence, subgrupo)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | H06; identidade de CNES |
| Volume | ≈ 165 meses × 9,4 subgrupos ≈ 1,6 mil linhas |
| Cache | por request |
| Custo esperado (**meta, não medido**) | 2–6 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | `competence` é a competência de **processamento** do SIH, não a de alta; valor aprovado ≠ pago; óbito é hospitalar; mês sem linha ⇒ sem registro |

### Q11 · Comparar um indicador entre os 27 Executivos estaduais/distrital
```sql
SELECT e.uf, l.value, l.numerator, l.denominator, l.period_start, l.status, l.flags FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_entity e ON e.entity_id = l.entity_id WHERE l.indicator_id = :ind AND e.kind = 3 ORDER BY e.uf;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_latest`, `exec_entity` |
| Índices / caminho de acesso | PK `(indicator_id, entity_id)` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | UF/Brasil derivados dos municípios na publicação |
| Volume | 27 |
| Cache | por request |
| Custo esperado (**meta, não medido**) | < 2 ms (meta) |
| Risco de query lenta | nenhum |
| Semântica territorial/temporal/flags | o valor da UF é recalculado de numeradores e denominadores municipais **incluindo** a entidade kind 5; nunca é média de taxas; `flags` marca cobertura parcial |

### Q12 · Comparar um indicador entre os municípios brasileiros
```sql
SELECT e.ibge7, e.name, e.uf, l.value, l.denominator, l.flags FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_entity e ON e.entity_id = l.entity_id JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE l.indicator_id = :ind AND e.kind = 4 AND d.ranking_allowed AND l.denominator >= d.min_denominator AND (l.flags & 8) = 0 ORDER BY l.value DESC NULLS LAST LIMIT 50 OFFSET 0;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_latest`, `exec_entity`, `exec_ind_def` |
| Índices / caminho de acesso | PK `(indicator_id, entity_id)` (≈ 5,6 mil linhas por indicador) |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | Fase 1E |
| Volume | ≈ 5,6 mil lidas, 50 devolvidas |
| Cache | por request; paginação |
| Custo esperado (**meta, não medido**) | 5–15 ms (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | só indicador com `ranking_allowed`; exclui suprimidos (bit 8) e denominador abaixo do mínimo; nunca ranquear mortalidade materna |

### Q13 · Indicadores de Saúde e Educação do mesmo município
```sql
SELECT d.domain, d.code, d.label, l.value, l.period_start, l.flags FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE l.entity_id = :vit AND d.domain IN (:saude, :educacao) ORDER BY d.domain, d.sort_order;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_latest`, `exec_ind_def` |
| Índices / caminho de acesso | os de Q3 |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | **Educação ainda não existe**: a consulta é válida, o conjunto de Educação virá de fase futura |
| Volume | ≈ 14 + 12 |
| Cache | por request |
| Custo esperado (**meta, não medido**) | < 3 ms (meta) |
| Risco de query lenta | nenhum |
| Semântica territorial/temporal/flags | períodos podem diferir entre domínios; a interface exibe `period_start` de cada um |

### Q14 · Visão geral do município com cinco domínios
```sql
SELECT d.domain, d.code, d.label, d.unit, l.value, l.period_start, l.flags FROM civica_exec.exec_ind_latest l JOIN civica_exec.exec_ind_def d USING (indicator_id) WHERE l.entity_id = :vit;
SELECT p.dataset_id, max(p.competence) AS data_through, max(p.activated_at) AS published_at FROM civica_exec.exec_publication p JOIN civica_exec.exec_entity e ON e.uf_code = p.uf AND e.kind = 3 WHERE e.uf = :uf GROUP BY p.dataset_id;
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_ind_latest`, `exec_ind_def`, `exec_publication`, `exec_entity` |
| Índices / caminho de acesso | os de Q3 e Q1 |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | quatro dos cinco domínios dependem de fases futuras |
| Volume | ≈ 70 + 15 |
| Cache | resposta inteira por (município, `max(activated_at)`) |
| Custo esperado (**meta, não medido**) | 10–20 ms em transação `REPEATABLE READ` (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | cobertura por UF (as publicações são por UF) — o município herda o `data_through` da UF; as duas consultas rodam na mesma transação para enxergar uma única fotografia |

### Q15 · Atualizar apenas uma UF sem bloquear as demais
```sql
-- Ver PUBLISH em modelo_dados_territorial_saude.md §7.2: lock advisory por (dataset, uf), upsert/delete da fatia (competence, uf), derivados e UPSERT em exec_publication numa transação
```
| Item | Detalhe |
|---|---|
| Tabelas | `exec_publication`, `exec_change_log`, tabelas de fato da fatia |
| Índices / caminho de acesso | `exec_sau_hosp_mes_subgrupo (competence, uf)`; PK de `exec_publication` |
| Partições acessadas | nenhuma (Fase 1 sem partições) |
| Dependências ainda não criadas | coleta completa da UF; manifesto `VERIFIED` |
| Volume | ES ≈ 700 linhas/mês; SP ≈ 4–6 mil/mês |
| Cache | invalidação de `exec_story` da UF após o commit |
| Custo esperado (**meta, não medido**) | < 5 s (meta) |
| Risco de query lenta | baixo |
| Semântica territorial/temporal/flags | leitores de qualquer UF não bloqueiam (MVCC); escritores de outras UFs usam outro lock; falha ⇒ rollback integral da fatia |

## 2. Resumo

| Consulta | Linhas lidas | Latência-alvo (p95, meta) | Risco |
|---|---:|---:|---|
| Q1 | ≤ 5 + ≈ 15 linhas | < 5 ms (meta) | baixo |
| Q2 | idem | < 5 ms (meta) | baixo |
| Q3 | ≈ 14 linhas | < 3 ms (meta) | baixo |
| Q4 | 78 × 14 ≈ 1,1 mil (SP ≈ 9 mil) | 5–15 ms (meta) | baixo |
| Q5 | ≈ 50 candidatos; 20 × n indicadores | 5–10 ms (meta) | baixo |
| Q6 | Vitória 22; São Paulo ≈ 230 | < 5 ms; < 30 ms na capital (meta) | baixo (se medir lento, índice parcial `WHERE valid_to IS NULL`) |
| Q7 | dezenas | < 2 ms (meta) | mínimo |
| Q8 | 165 linhas (2013-01…2026-09) | 2–5 ms (meta) | baixo |
| Q9 | ≤ centenas por município; nacional ≈ 500 mil `NOT EXISTS` | município < 10 ms; nacional 1–2 s (meta) | médio só na versão nacional |
| Q10 | ≈ 165 meses × 9,4 subgrupos ≈ 1,6 mil linhas | 2–6 ms (meta) | baixo |
| Q11 | 27 | < 2 ms (meta) | nenhum |
| Q12 | ≈ 5,6 mil lidas, 50 devolvidas | 5–15 ms (meta) | baixo |
| Q13 | ≈ 14 + 12 | < 3 ms (meta) | nenhum |
| Q14 | ≈ 70 + 15 | 10–20 ms em transação `REPEATABLE READ` (meta) | baixo |
| Q15 | ES ≈ 700 linhas/mês; SP ≈ 4–6 mil/mês | < 5 s (meta) | baixo |

## 3. Navegação `/quem-me-representa → UF → território → Saúde`

A rota existente **não é modificada**. O fluxo proposto:

1. `GET /quem-me-representa?uf=ES&casa=camara` — painel Legislativo da UF (inalterado). `uf` já é validado pelo conjunto `ufs`.
2. Novo **bloco "Poder Executivo · Saúde"** na mesma página (ou link para `/executivo/estados/ES/saude`), alimentado por Q1 (resumo da UF) e Q4 (municípios). O bloco **não lê `casa`**, não entra em `summary.byHouse` e exibe `DataCoverage` adaptado de `ProductCoverage` (`AVAILABLE → available`, `PARTIAL/DEGRADED → partial`, demais → `unavailable`).
3. `/executivo/municipios/3205309/saude` — Q3, Q6, Q8, Q14.

Resolução da UF para território: `SELECT entity_id FROM civica_exec.exec_entity WHERE kind = 3 AND uf = :uf` (a sigla vem do parâmetro já validado). A associação é por igualdade de sigla entre `civica.profiles.uf`/`ufs` e `exec_entity.uf`; **não há FK** entre `civica*` e `civica_exec`.

Regras de separação: Legislativo (`casa`, cota, presença, votações, gabinete) e Executivo (indicadores de Saúde) **não são somados, ordenados juntos nem comparados na mesma tabela**; o rótulo "Poder Executivo" é obrigatório; o `LegislativeSubnav` não ganha item de Executivo; o mapa continua com os 27 links `?uf=XX` fixados por `tests/unit/state-map.test.ts`. Um futuro mapa de Saúde reaproveita `StateChoroplethMap` com outro callback `href`.

## 4. Contratos das páginas (TypeScript proposto)

```ts
export type TerritoryKind = 'BR' | 'REGION' | 'UF' | 'MUNICIPALITY' | 'MUNICIPALITY_UNKNOWN';
export type IndicatorValue = {
  code: string; methodVersion: number; label: string; unit: string;
  value: number | null;               // null = sem registro (nunca 0 no lugar de ausência)
  numerator: number | null; denominator: number | null;
  periodStart: string | null; status: 'preliminary' | 'final';
  flags: { smallN: boolean; preliminary: boolean; partialCoverage: boolean; suppressed: boolean; denominatorDivergent: boolean; above100: boolean };
  rankingAllowed: boolean;
  coverage: DataCoverage;              // adaptador a partir da cobertura publicada; ProductCoverage só para o domínio Assembleias
};
export type TerritoryHealthSummary = {
  entity: { id: number; kind: TerritoryKind; ibge7: number; name: string; uf: string; parentId: number | null };
  asOf: string;                        // max(activated_at) da transação
  indicators: IndicatorValue[];
  facilities?: { hospitals: number; ubs: number; withoutBeds: number };
  publications: Array<{ datasetId: number; dataThrough: string; stage: 'preliminary' | 'final'; publishedAt: string }>;
};
export type StateHealthSummary = TerritoryHealthSummary & { municipalities: Array<{ id: number; ibge7: number; name: string; indicators: Record<string, number | null> }> };
```

Rotas novas propostas (não alteram as existentes): `GET /executivo/estados/[uf]/saude`, `GET /executivo/municipios/[ibge]/saude`, `GET /executivo/hospitais/[cnes]` e `GET /api/executivo/{estados,municipios}/[id]/saude`. `[ibge]` aceita 7 dígitos e, por tolerância, 6 (resolvido por `exec_entity_external_id`); `[uf]` valida contra `STATE_HOUSES`/`ufs`.

## 5. Integração com as páginas atuais

* `/legislativo/estaduais/**` (Assembleias) **não muda**; a ligação com o Executivo da UF é por sigla.
* `StateProductProfile`, `StateFinanceProduct` etc. e `/api/estaduais/**` permanecem; nenhuma coluna é adicionada a `civica_state`.
* `getStateHouseStory` é o modelo de `getTerritoryStory(entityId, domain)` (duas consultas pequenas, `source_key`, reconciliação em `after()`).
* O cache em memória de `lib/data.ts` (TTL 120 s) é o da rota `/quem-me-representa`; o bloco de Saúde usa módulo próprio (`packages/db/src/postgres-exec-*.ts`) com `React.cache()` + HTTP.

## 6. Cache

| Camada | Estratégia |
|---|---|
| Request | `React.cache()` por `(entityId, domain)` |
| UF/Brasil | `exec_story` (JSONB) + `source_key` e reconciliação em `after()` |
| Município | sem read model; `exec_ind_latest` (≈ 80 mil linhas) é o serving |
| HTTP | `s-maxage` curto + `stale-while-revalidate`; invalidação por `max(activated_at)` |
| Banco | `shared_buffers` 1 GiB acomoda `exec_ind_latest`, `exec_entity` e índices de indicadores (< 0,2 GiB) |


---

## Revisão 2 — correções que afetam este arquivo

| ID | Diagnóstico anterior | Evidência nova | Correção | Impacto na arquitetura | Impacto no armazenamento | Impacto no plano |
|---|---|---|---|---|---|---|
| **C01** Escopo da investigação de páginas | Investiguei `/legislativo/estaduais` (Assembleias Legislativas) como se fosse a experiência territorial do produto. | A experiência territorial existente é `/quem-me-representa` (`?uf=` e `?casa=`): Legislativo federal (Senado e Câmara) por UF. É a rota da navegação "Estados" (cabeçalho, mapa, cartão da home) e dela partem os 27 links do mapa (`/quem-me-representa?uf=XX`). Ela nada tem de executivo. | Nova seção 2A em `investigacao_backend_territorial_atual.md` com o fluxo URL → parâmetros → componentes → loader → SQL → tabelas, inventário de rotas territoriais e regras de separação Legislativo × Executivo. | A integração futura de Saúde parte de `?uf=` (validado pelo conjunto `ufs` do domínio), com seção própria "Poder Executivo", sem usar `casa` nem entrar em `summary.byHouse`. A rota não é modificada. | nenhum | Fase 1E ganha um ponto de integração com a navegação existente; `DataCoverage` (rota) e `ProductCoverage` (Assembleias) precisam de adaptador. |
| **C02** Aritmética de competência (`yyyymm − 1`) | O algoritmo de intervalos fechava versões com `valid_to = c − 1`. Para `c = 202501` isso dá `202500`, que não é competência. | Teste de mesa executado: `202501 − 1 = 202500` (inválido). Implementação de referência com `ym_prev`/`ym_next` e `CHECK` de mês 01–12 passou nos 7 cenários, incluindo dezembro → janeiro. | Intervalos **semiabertos** `[valid_from, valid_to)`: encerrar = gravar `valid_to = c` (competência em que o estado deixa de valer). Nenhuma subtração. Funções `ym_next`/`ym_prev` (SQL) só para a guarda de contiguidade; tipo `civica_exec.competence` com `CHECK`. | Todas as tabelas de intervalo (`exec_sau_cnes_estab_v`, `_leito_v`, `_equip_v`) e consultas passam a usar `valid_to > c`. | nenhum | Critério de aceite da Fase 1A inclui os 7 testes de mesa como testes automatizados. |
| **C05** Unicidade e temporalidade dos indicadores | `exec_ind_value` tinha PK `(indicator_id, entity_id, period_start)` sem lugar para duas metodologias nem para preliminar/definitivo; `run_id` era `integer` numa tabela e `bigint` em outra. | A cobertura de APS tem duas metodologias sem sobreposição (AB até 202012; APS desde 202112) e o SINASC/SIM publica preliminar e definitivo do mesmo ano. | Uma linha de `exec_ind_def` por **versão metodológica** (ids distintos, `supersedes_id`, `valid_from_period`/`valid_to_period`); `status` (1 preliminar, 2 definitivo) em `exec_ind_value`; definitivo **substitui** preliminar na mesma PK (o valor anterior fica no change log e no RAW); `period_end` explícito; `run_id integer` em todas as tabelas. | Séries que cruzam versões são montadas por união explícita; a lacuna 2021 é declarada, não interpolada. | +0,04 GiB (colunas extras) | Fase 1B/1D publicam só versões com definição aprovada. |
| **C10** Consultas SQL | Q1 usava tabela inexistente (`exec_dataset`); Q6/Q9 referenciavam `exec_sau_cnes_estab_cur`; filtros temporais assumiam intervalos fechados; faltavam `kind`, `status` e dependências. | Auditoria linha a linha das 15 consultas contra o DDL revisado. | Consultas reescritas com intervalos semiabertos, identidade de CNES, `kind`, `status`, `flags` e lista de dependências; navegação `/quem-me-representa → UF → território → Saúde` adicionada. | Nenhuma tabela nova além de `exec_change_log`. | nenhum | Latências continuam metas a medir no benchmark. |

