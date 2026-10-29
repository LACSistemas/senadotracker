# Testes P12.5

## Integridade e replay

- Banco conectado: `SELECT current_database()` → `projetoeleitor_db`.
- Replay completo: 308/308 fatias (`84 RAIS + 224 Caged`) retornaram `NO_CHANGE`.
- Tamanho antes/depois do replay: 33.950.739.603 / 33.950.739.603 bytes; crescimento `0`.
- Manifesto RAW: dois arquivos oficiais, SHA-256 registrados; payloads continuam em D:.
- Há uma execução histórica `FAILED` durante a correção inicial do parser Caged; ela não está ativa (`active_failed_publications=0`) e o replay final foi limpo.
- O adapter P12.5 usa `upsertIndicators` do motor comum, portanto mudanças futuras de uma competência registram `exec_change_log`; o replay inalterado não cria run novo.

## Paridade

- RAIS Brasil: 3/3 anos exatos.
- RAIS municipal: 3/3 anos exatos após exclusão semântica do `999999`.
- Caged: 44.792/44.792 saldos exatos.
- P12.2: indicadores 9001–9006 mantiveram as contagens esperadas (5.598, 5.598, 28, 5.598, 5.598, 5.598).
- P12.4-R: indicadores 9101–9301 mantiveram as contagens publicadas; nenhuma linha foi atualizada pela P12.5.

## Planos de consulta reais

`EXPLAIN (ANALYZE, BUFFERS)`:

- RAIS municipal 2025: 5.571 linhas em 4,623 ms, usando `exec_ind_value_pkey` e hash join.
- Caged municipal agosto/2026 (admissão/desligamento/saldo): 5.571 linhas em 59,963 ms; usa índices por entidade/indicador/período, sem leitura de fonte externa.

Os tempos são smoke de consulta, não p95/p99. Não foram criados índices novos porque os planos existentes são indexados e o custo é compatível com read model agregado.

## Segurança operacional

Nenhum frontend foi alterado, nenhum microdado identificável foi persistido, nenhum cluster de teste foi usado e nenhum collector de outra frente foi interrompido.
