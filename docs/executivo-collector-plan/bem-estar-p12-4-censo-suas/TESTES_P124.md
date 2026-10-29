# Testes P12.4

| Teste | Resultado | Evidência |
|---|---|---|
| conexão oficial | PASS | `SELECT current_database()` = `projetoeleitor_db` |
| acesso relatório nacional | PASS | HTTP 200; 1.724.732 bytes; SHA registrado |
| layout HTML | PASS | 1 tabela nacional + 1 tabela por relatório municipal piloto |
| edição 2024 | PASS | título e tabelas explicitam Censo SUAS 2024 |
| 2025 consolidado | NOT VERIFIED | apenas referências a monitoramento/preenchimento |
| território | PARTIAL | 11/12 pedidos encontrados; sem IBGE no relatório |
| equipamento estável | FAIL_FOR_PUBLICATION | nenhuma chave de unidade |
| CRAS versus CREAS | PASS | seções e indicadores distintos |
| regionalização CREAS | NOT READY | sede/atendidos ausentes |
| respondente versus existente | NOT READY | denominador ausente |
| capacidade versus atendimento | PASS | não misturados |
| privacidade | PASS | nenhum dado pessoal ingerido |
| idempotência/replay | NOT RUN | nenhuma escrita |
| retificação/LKG | DESIGN DOCUMENTED | contrato preparado, sem revisão publicada |
| armazenamento | PASS | RAW somente em D:, DB growth P12.4 = 0 |
| P12.2 regressão | PASS | indicadores 9001–9006 e publicação 120 lidos sem alteração |
| P12.3 independência | PASS | nenhum fato P12.3 alterado |

Conclusão: não executar carga nacional até obter exportação tabular oficial ou comprovar exportação pública com conteúdo e chaves suficientes.
