# F3-175 — migration e backfill inicial de fornecedores

**Executado em:** 23/09/2026  
**Banco:** `data/senadotracker.sqlite`

## Migrations

- migration 29: identidade, aliases, papéis, vínculos e publicação;
- migration 30: lotes/raw normalizado e entidades de contratação/execução;
- schema final observado: 30.

As migrations são aditivas. Nenhuma coluna ou linha de `expenses` foi removida ou reescrita.

## Dry-run global

| Métrica | Valor |
| --- | ---: |
| Linhas ativas examinadas | 259.977 |
| Linhas com match forte | 224.865 |
| Linhas não resolvidas | 35.112 |
| Fornecedores candidatos | 26.122 |
| Aliases distintos | 30.205 |
| Sentinelas | 7.693 |
| Ocorrências tipadas como CPF | 2.604 |
| Ocorrências tipadas como CNPJ | 229.954 |

## Canário Câmara/2026

- 75.567 linhas;
- 73.775 vínculos fortes;
- 15.405 fornecedores;
- 17.044 aliases;
- 1.792 não resolvidas;
- zero conflitos;
- zero FKs órfãs.

## Publicação global

| Tabela/métrica | Valor |
| --- | ---: |
| `suppliers` | 26.122 |
| `supplier_identifiers` | 26.122 |
| `supplier_names` | 30.205 |
| `supplier_roles` | 28.395 |
| `expense_supplier_links` | 224.865 |
| aliases canônicos conflitantes | 0 |
| links órfãos | 0 |
| conflitos de identidade | 0 |

Batch publicado inicialmente: `e74df58d-2ae6-4e8c-bc82-81d369c08472`.

## Idempotência

Uma segunda execução global gerou nova revisão auditável, mas manteve exatamente:

```text
suppliers                 26.122 → 26.122
supplier_identifiers      26.122 → 26.122
supplier_names            30.205 → 30.205
supplier_roles            28.395 → 28.395
expense_supplier_links   224.865 → 224.865
```

## Rollback

Desativar `active_supplier_identity_publication` e voltar os adaptadores às consultas legadas restaura o comportamento anterior sem restaurar backup, pois os fatos brutos não foram alterados. Exclusão física das tabelas só pode ocorrer em migration reversa explícita depois de verificar dependências.

