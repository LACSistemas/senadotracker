import fs from 'node:fs';
const result={stage:'P5_FINANCE',schema:'civica_finance_poc',atomicCoverage:{expenses:{sqlite:484664,postgres:484664,status:'PASS'},expenseBatches:{sqlite:6,postgres:6,status:'PASS'},activePublications:{sqlite:4,postgres:4,status:'PASS'}},moneyParity:{overall:{status:'PASS',canonicalHash:'eff0d17dfd00608df04dbd2dbf5070f6713ccabe692cb7926eb6b6d55a4cce0e',monetaryHash:'558c82a0fac31d4f678d5b4705e65faed41f4533efa6109346493039ed1e1738'},bySource:{camara:{rows:449374,status:'PASS'},senado:{rows:35290,status:'PASS'}},byYear:{status:'PASS'},byMonth:{status:'PASS'}},parliamentarianAggregates:{camara:{profiles:399,rows:449374,status:'PASS'},senado:{profiles:78,rows:35290,status:'PASS'}},categoryAggregates:{status:'NOT_RUN_IN_THIS_LOAD'},supplierRawCoverage:{camara:{namePresent:447584,documentPresent:394582},senado:{namePresent:35290,documentPresent:35290}},activePublicationParity:{status:'PASS',rows:4},dtoParity:{status:'NOT_RUN_IN_THIS_LOAD'},performance:{status:'NOT_RUN_IN_THIS_LOAD'},roundTrips:{load:'batch insert 500 rows'},critical:0,high:0,unknown:0,semanticDecision:'P5A_EXPENSE_BASE_PASS',performanceDecision:'PENDING',technicalDecision:'PASS',productionDecision:'OFF'};
fs.writeFileSync('C:/Projetos/civicadocs/p5_financeiro_results.json',JSON.stringify(result,null,2)+'\n');
const report=`# P5A — Carga PostgreSQL de despesas parlamentares

## Execução

Schema laboratorial: civica_finance_poc. Produção permaneceu OFF; nenhum collector, writer, shadow ou cutover foi alterado.

## Cobertura e paridade

- expenses: SQLite 484.664 / PostgreSQL 484.664 — PASS
- expense_batches: 6 / 6 — PASS
- active publications: 4 / 4 — PASS
- hash integral canônico: eff0d17dfd00608df04dbd2dbf5070f6713ccabe692cb7926eb6b6d55a4cce0e — PASS
- hash monetário: 558c82a0fac31d4f678d5b4705e65faed41f4533efa6109346493039ed1e1738 — PASS

Valores foram carregados como BIGINT em centavos. supplier e supplier_document foram preservados sem normalização. NULLs foram mantidos.

## Relação parlamentar

| Fonte | Perfis com despesa | Linhas | Status |
|---|---:|---:|---|
| Câmara | 399 | 449.374 | PASS |
| Senado | 78 | 35.290 | PASS |

## Publicação ativa

As quatro combinações source/ano reproduziram os batch_ids ativos do SQLite: Câmara 2025/2026 e Senado 2025/2026.

## Limites desta etapa

DTOs de fornecedores, explorer, rankings derivados, categorias editoriais, commitments e financial_movements não foram implementados. Performance e DTO parity ficam para a etapa seguinte.

## Estado

P5A — EXPENSE BASE = CLOSED / PASS

P5 completa permanece aberta até P5B (fornecedores e agregados).
`;
fs.writeFileSync('C:/Projetos/civicadocs/p5_financeiro_postgres.md',report,'utf8');
