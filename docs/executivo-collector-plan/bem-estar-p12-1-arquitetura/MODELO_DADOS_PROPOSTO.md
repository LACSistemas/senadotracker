# Modelo de dados proposto

## Reuso

O núcleo publicado reutiliza `exec_entity`, `exec_entity_external_id`, `exec_territory_population`, `exec_ind_def`, `exec_ind_value`, `exec_ind_latest`, `exec_ingestion_run`, `exec_raw_manifest`, `exec_publication`, `exec_change_log` e `exec_story`. O padrão já é usado por Saúde, Segurança, Educação, Finanças, Prouni/Fies e Capes.

O staging fica em `D:\Civica\staging\bem-estar`, particionado por família, edição e run. O arquivo bruto original permanece em `D:\Civica\raw\bem-estar` com SHA-256 e manifesto. Nenhum desses diretórios foi alterado na P12.1.

## Estruturas especializadas propostas (não executadas)

1. `wellbeing_source_observation_stage`: arquivo/Parquet ou tabela de staging futura com chave source-native, dimensão, valor bruto, dicionário e hash da linha. Não é tabela de serving.
2. `wellbeing_coverage_snapshot`: projeção de cobertura por indicador/recurso/território/período, caso `exec_access_coverage` e os contratos existentes não comportem a família. A decisão de criar só pode ser tomada após P12.2.

Não há migration nesta fase. A solução não propõe seis famílias de tabelas só porque P12 estimou seis collectors.

## Diagrama lógico

```text
organization/system/dataset/resource/edition
                 │
             source_run ─── raw_manifest
                 │
      stage(source key, dimensions, raw value)
                 │ validação
       indicator_definition(method_version)
                 │
 entity ───── indicator_value ───── publication
    │              │                    │
 geography_version │                latest/read story
    └──── external ids/crosswalk      coverage
```

## Chaves e restrições

- source-native key é preservada e nunca substituída por posição de linha;
- hash da linha detecta retificação e replay;
- `(indicator, entity, period, dimension)` não pode duplicar;
- mesma observação replayada não cria nova publicação se o hash não mudou;
- entidade exige código oficial ou crosswalk aprovado; nome isolado fica `UNRESOLVED`;
- linha de pessoa física não entra no modelo canônico.

## Índices futuros

Os índices abaixo são proposta, não execução: `(entity_id, indicator_id, period_start)`, `(indicator_id, period_start, entity_id)`, `(source_run_id, source_key)`, `(geography_version, entity_id)` e cobertura `(indicator_id, period_start, coverage_status)`. Criar apenas após `EXPLAIN` em P12.7.

## DDL ilustrativo (não executar)

```sql
-- Contrato conceitual; não é migration P12.1.
CREATE TABLE wellbeing_coverage_snapshot (
  coverage_id bigint generated always as identity,
  indicator_code text not null,
  source_run_id bigint not null,
  geography_version text not null,
  period_start date not null,
  expected_territories integer,
  observed_territories integer not null,
  valid_values bigint not null,
  suppressed_values bigint not null,
  absent_territories integer not null,
  not_applicable_territories integer not null,
  status text not null,
  primary key (coverage_id)
);
```

## Integração com publicação

O collector futuro cria run preliminar, valida, promove para definitivo e chama a publicação por fatia. A publicação deve apontar `previous_run_id`; em caso de falha, rollback para a revisão anterior. O read model só pode consultar a revisão ativa.

