# Relatório de execução — P14.1

## Resultado

P14.1 foi executada no banco `projetoeleitor_db` com schema `civica_jud`. O resultado é **PASS_WITH_CAVEATS**: a fundação institucional e os dois provedores-piloto operacionais passaram; TJES, crosswalk JN e jurisdição IBGE permanecem limitações documentadas.

## Carga real

Foram persistidos 93 tribunais, 3764 unidades piloto, 2888 relações de comarca, 5 snapshots e 3 revisões. Os registros TJBA repetidos por ID foram deduplicados; nenhum dado foi inventado para município ou jurisdição.

## Segurança operacional

A guarda confirmou `current_database() = projetoeleitor_db`. O RAW foi mantido exclusivamente em `D:\Civica\judiciario`. Não houve DataJud, processo, indicador ou frontend. O crescimento observado desde o baseline P14.0 foi 8732672 bytes, abaixo do envelope de 75.000.000 bytes.

## Gates

- DATABASE_GUARD: PASS
- SOURCE_AUTHORITY: PASS_WITH_CAVEATS
- CANONICAL_SCHEMA: PASS
- NATURAL_KEYS: PASS
- RAW_PROVENANCE: PASS
- IMMUTABLE_REVISIONS: PASS
- SNAPSHOT_TEMPORALITY: PASS
- TERRITORIAL_SEMANTICS: PASS_WITH_CAVEATS
- REPLAY_IDEMPOTENCY: PASS
- NO_DATAJUD_CALLS: PASS
- P14.2: READY_WITH_BLOCKERS

Detalhes de fontes, hashes, reconciliação e prontidão estão nos 11 artefatos companheiros.
