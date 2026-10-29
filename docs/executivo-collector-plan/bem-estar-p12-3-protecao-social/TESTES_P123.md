# Testes P12.3

| Teste | Resultado |
|---|---|
| Catálogo CSV: 20 linhas, 18 campos | PASS |
| Universos dos nove registros corrigidos | PASS |
| Crosswalk: 5 campos em 5.589 linhas | PASS |
| SIAFI→IBGE sem fuzzy matching | PASS |
| MDS pages HTTP | PASS documental |
| Portal CGU pages HTTP | PASS documental |
| APIs CGU sem token | BLOCKED (401 documentado) |
| PII em download social | PASS (não baixado) |
| DB guard `current_database()` | PASS (`projetoeleitor_db`) |
| DB crescimento P12.3 | PASS (0 bytes) |
| P12.2 IDs 9001–9006 | PASS, 6 definições; valores permanecem 5.598/5.598/28/5.598/5.598/5.598 |
| Replay/idempotência | NOT_APPLICABLE: nenhum candidato social foi publicado |

Não foram executados testes de publicação com dados vazios, para evitar revisão falsa ou substituição de last-known-good.
