# Custo real PostgreSQL

Banco confirmado: `projetoeleitor_db`.

Antes da v28: `34.178.501.779` bytes. Depois da migration + publicação compacta: `34.288.356.499` bytes. Crescimento P13.5-R2: **109.854.720 bytes**.

Tamanhos reais (`pg_total_relation_size`):

| tabela | heap | índices | total |
|---|---:|---:|---:|
| project | 27.746.304 | 11.862.016 | 39.649.280 |
| location | 12.525.568 | 12.902.400 | 25.460.736 |
| physical | 6.152.192 | 5.087.232 | 11.272.192 |
| commitment | 14.802.944 | 12.034.048 | 26.877.952 |
| history | 3.022.848 | 376.832 | 3.432.448 |
| contract | 1.687.552 | 442.368 | 2.170.880 |
| municipality/dictionaries/revision/coverage | — | — | 800.816 |

O custo observado inclui índices e preenchimento de páginas; não foi usado apenas `total/200`. TOAST não foi necessário para as tabelas compactas. O v27 continua preservado para o piloto e não entra na nova publicação.
