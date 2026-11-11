# Arquitetura de dados proposta

## Camadas

1. **RAW externo:** `D:\Civica\judiciario\<provider>/<resource>/<snapshot>` com URL, status, MIME, bytes, SHA-256 e data.
2. **Staging:** parser versionado, sem exposição pública, validação de schema e contagem.
3. **Canonical:** reuso de dimensões territoriais/identidade; namespace aditivo `civica_jud` somente em P14.1.
4. **Revision:** uma publicação coerente por provider/edição/snapshot; last-known-good.
5. **Serving:** agregados por Brasil/ramo/tribunal/grau/unidade, sem processo bruto.

## Entidades candidatas

`judicial_branches`, `judicial_tribunals`, `judicial_degrees`, `judicial_units`, `judicial_jurisdiction_areas`, `judicial_unit_aliases`, `judicial_metrics`, `judicial_metric_definitions`, `judicial_source_snapshots`, `judicial_revisions`, `judicial_stj_documents`, `judicial_stj_people` (somente quando permitido). Processos DataJud não fazem parte do MVP.

## Chaves e invariantes

Chaves naturais devem incluir fonte, código oficial, vigência e edição. Valores estatísticos carregam unidade, denominador, ano-base, edição, `dataThrough` e comparabilidade. Nenhuma junção de execução processual deve multiplicar despesas ou documentos. Todas as métricas devem apontar para proveniência.

## Reuso

Reusar PostgreSQL, `civica_state`/território existente, revisões, publicações ativas, SHA-256, `raw_objects` somente para objetos pequenos e armazenamento D: para arquivos. Não criar Elasticsearch/ClickHouse antes de medir um caso real.
