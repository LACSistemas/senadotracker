# Testes P12.4-R

| Teste | Resultado |
|---|---|
| conexão `SELECT current_database()` | PASS — `projetoeleitor_db` |
| parser CRAS completo | PASS — 8.546/8.546 |
| IDs CRAS/IDCRAS/IDCREAS únicos | PASS |
| join IBGE7/IBGE6 | PASS — zero unresolved entre valores não nulos |
| reconciliação CRAS↔IDCRAS respondents | PASS — 5.333/5.333 |
| deduplicação CREAS por sede | PASS — 2.609 sedes |
| zero falso | PASS — nulos não viraram zero |
| publicação Brasil + 27 UFs | PASS — 28/28 |
| replay completo | PASS — 28/28 `NO_CHANGE` |
| P12.2 IDs 9001–9006 | PASS — contagens preservadas (5.598, 5.598, 28, 5.598, 5.598, 5.598) |
| RH | PASS — não baixado/não ingerido |
| frontend/P12.5 | PASS — não alterado/não iniciado |

As tentativas controladas interrompidas durante a otimização ficaram apenas como histórico de run com `status=FAILED`; nenhuma publicação ativa aponta para run falho e as 28 fatias finais estão `status=9`/`stage=2`.

## Benchmark real

`EXPLAIN (ANALYZE, BUFFERS)` no banco oficial:

- consulta municipal paginada (500 linhas): planejamento 8,568 ms; execução 42,657 ms;
- detalhe de um município (10 indicadores): planejamento 0,591 ms; execução 0,535 ms;
- resumo nacional por indicador: planejamento 0,789 ms; execução 81,112 ms.

Os números são do read model real após a publicação, sem mock.
