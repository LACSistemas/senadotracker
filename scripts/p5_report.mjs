import fs from 'node:fs';
const t=`# P5 — Investigação do contrato financeiro SQLite

## Executive summary

Investigação concluída para o contrato financeiro existente. Nenhuma carga PostgreSQL, adapter, dual-write, collector ou shadow foi alterado.

## Public routes and functions

O código financeiro canônico está em packages/db/src/index.ts, investigative.ts, expense-intelligence.ts, suppliers.ts, supplier-market.ts, supplier-market-analytics.ts, rankings.ts, panorama.ts e frontend-data.ts. As funções públicas incluem publishedExpenses, publishedExpenseDetail, publishedExpenseComparison, publishedSupplierExplorer, publishedSupplierGlobalDetail, publishedSupplierNetwork, publishedParliamentarianSupplierNetwork, publishedSupplierMarket e publishedExpenseYears. As páginas de fornecedores e blocos financeiros de rankings/perfis consomem esses serviços; não foi encontrado contrato separado que autorize misturar despesas parlamentares com contratos institucionais.

## Tabelas e cobertura observada

| Tabela | Linhas | Papel |
|---|---:|---|
| expenses | 484.664 | despesas parlamentares publicadas |
| expense_batches | 6 | lotes por fonte/ano |
| active_expense_publications | 4 | publicação ativa por fonte/ano |
| cabinet_monthly_budgets | 3.543 | orçamento/gasto mensal da Câmara |
| expanded_costs | 795 | custos expandidos do Senado |
| commitments | 42.517 | compromissos institucionais |
| financial_movements | 48.171 | movimentos institucionais |

Despesas: Câmara 449.374 linhas e 399 parlamentares; Senado 35.290 linhas e 78 parlamentares. Cobertura publicada: 2025 completo e 2026 parcial (Câmara meses 1–8; Senado 1–9). Totais líquidos observados: Câmara 52.010.892.256 centavos; Senado 5.427.430.650 centavos.

## Identidade e dinheiro

Despesa usa source, external_id, year, month, record_key e batch_id; record_key é a chave idempotente do lote. Valores são inteiros em centavos: gross_cents, deduction_cents, net_cents e refund_cents. A fórmula pública é sum(net_cents - refund_cents), sem float. Fornecedor é textual mais supplier_document; a busca normaliza pontuação de documento, sem resolução por nome parecido.

## Semântica pública

Anos vêm de active_expense_publications. Mês é coluna mensal do lote; issued_at é a data do documento quando disponível. Rankings ordenam valor e usam nome/external_id como desempate. Explorer agrupa por documento normalizado, conta parlamentares, registros e casas; detalhes agregam por parlamentar, UF, partido, mês, categoria e nome textual.

## Câmara versus Senado

CEAP/despesas em expenses são domínio parlamentar comum. cabinet_monthly_budgets (Câmara) e expanded_costs (Senado) são fontes de custo distintas. commitments/financial_movements são institucionais e não devem ser tratados como despesas parlamentares sem vínculo explícito.

## Qualidade

Há 54.792 despesas da Câmara sem documento de fornecedor e 1.790 sem nome. O relatório não corrigiu nem deduplicou esses registros. A cobertura de CPF/CNPJ deve ser calculada após normalização preservando zeros à esquerda; não há entity resolution editorial autorizada.

## PostgreSQL e paridade proposta

O schema futuro deve manter BIGINT para centavos, source/year/batch_id, record_key único por lote, campos de documento text preservados e publicação ativa separada. A campanha deve comparar linhas brutas, identidade fornecedor, relações expense–parlamentar, totais por parlamentar/fornecedor/categoria/mês/ano e DTOs públicos, com hashes canônicos e sem tolerância monetária.

## Performance, riscos e decisão

Não foi implementada carga nem benchmark PostgreSQL nesta etapa. Riscos principais: cobertura parcial de 2026, documentos ausentes, diferenças CEAP/CEAPS, dados institucionais distintos e semântica de refund. O contrato SQLite está suficientemente identificado para desenhar a carga laboratorial, mas a carga deve começar com fixture e paridade de expenses antes de fornecedores derivados.

P5 INVESTIGATION = COMPLETE
GO PARA P5 LOAD = SIM, somente em banco laboratorial descartável e sem tocar produção.
`;
fs.writeFileSync('C:/Projetos/civicadocs/p5_financeiro_investigacao.md',t,'utf8');
