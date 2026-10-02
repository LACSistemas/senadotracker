# R4 — Resíduos públicos

## Resultado

`patrimonyRanking` e `commissionDetail` foram comparados campo a campo contra os wrappers SQLite atuais no banco PostgreSQL `projetoeleitor_db`.

| Métrica | Resultado |
| --- | --- |
| Contratos | 2/2 exact |
| Mismatches | 0 |
| Erros | 0 |
| DATA_CONTRACT_PARITY | PASS |
| PUBLIC_UI_CONTENT | PASS |
| Technical checks | PASS |
| Performance sanity | PASS |

`DB_TYPECHECK` e `WEB_TYPECHECK` passaram. O código do build não apresentou erro; o build de produção continua bloqueado apenas pela tentativa do Next.js de baixar `Fraunces` e `Inter` de Google Fonts no ambiente offline (`WEB_BUILD_EXTERNAL_ASSET_FETCH = BLOCKED_ENVIRONMENT`).

## Correções

- Patrimônio agora usa a mesma granularidade SQLite (`person_id + year + asset_id`), descarta e contabiliza versões conflitantes, publica o perfil sem metadados internos, ordena por `changeRate/changeCents` e reproduz cobertura, lote e `deflatorAvailable`.
- Os 457 valores IPCA e a publicação ativa foram materializados 1:1 em `civica_elections_poc`; o runtime do adapter não abre SQLite.
- Relatorias de comissão reproduzem a cardinalidade histórica do join SQLite, inclusive quando há duas linhas de perfil para o mesmo `external_id`.

## Gates

```ini
R4 = PASS
R4_STATUS = CLOSED/PASS
DATA_CONTRACT_PARITY = PASS
PUBLIC_UI_CONTENT = PASS
RUNTIME_SQLITE_ZERO = PASS
semanticDecision = R4_PASS
productionDecision = OFF
critical = 0
high = 0
unknown = 0
```

Comparator: [`full-web-sqlite-postgres-parity-r4.json`](./full-web-sqlite-postgres-parity-r4.json).
