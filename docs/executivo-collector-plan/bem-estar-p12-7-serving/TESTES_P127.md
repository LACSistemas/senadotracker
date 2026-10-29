# Testes P12.7

| Gate | Resultado | Evidência |
|---|---|---|
| banco alvo | PASS | `SELECT current_database()` = `projetoeleitor_db` |
| smoke territorial | PASS | 8 casos: municípios, UFs e Brasil |
| contrato 27 indicadores | PASS | 27 observações e capítulos 6/10/6/5 |
| comparador MUNIC | PASS | Vitória: município/ES/Brasil com denominadores |
| Gini municipal | PASS_WITH_CAVEAT | rejeição explícita, sem imputação |
| contexto financeiro | PASS | função 08; EMP/LIQ/PAG separados |
| cobertura | PASS | contagens nacionais e nulos auditados |
| publicação ativa | PASS | datasets 120–124: 28/28/84/224/27 fatias ativas |
| last-known-good | PASS | publicações anteriores não são substituídas em falha |
| RAIS residual | PASS_DOCUMENTED | residual 2024/2025 documentado, fatos inalterados |
| MUNIC semântica | PASS | Sim/Não no denominador; `-` ausente |
| N+1 | PASS | consultas set-based, sem query por indicador/card |
| performance | PASS_WITH_CAVEAT | p95 overview principal próximo de 300 ms; Vitória 318,204 ms e São Paulo conditions 303,167 ms |
| armazenamento | PASS | crescimento P12.7 = 0 bytes |
| privacidade | PASS | sem PII nova; raw permanece em D: |
| P12.2 regressão | PASS | 9001–9006 preservados |
| P12.4-R regressão | PASS | 9101–9301 preservados |
| P12.5 regressão | PASS | 9401–9503 preservados |
| P12.6 regressão | PASS | 9601–9605 preservados |
| P12.3 | PASS_UNCHANGED | não tocada |
| frontend | PASS_UNCHANGED | nenhuma alteração |

`P12_8_STARTED=NO`.
