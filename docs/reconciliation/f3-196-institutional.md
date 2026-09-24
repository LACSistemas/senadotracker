# F3-196 — reconciliação institucional atual

Executado com `node --import tsx scripts/reconcile-institutional.ts`.

| Entidade | Quantidade |
| --- | ---: |
| Licitações | 7.560 |
| Contratos | 3.594 |
| Itens de contrato | 7 |
| Aditivos | 11 |
| Empenhos | 35 |
| Movimentos financeiros | 170 |
| Movimentos de pagamento | 62 |

| Lacuna | Quantidade |
| --- | ---: |
| Contratos sem fornecedor | 49 |
| Contratos sem licitação vinculada | 1.447 |
| Empenhos sem contrato | 0 |
| Movimentos sem empenho | 0 |

As lacunas de fornecedor e licitação permanecem explícitas e não são preenchidas por inferência. A base atual ainda não contém processos de contratação (`0`), portanto a reconciliação de cadeia completa órgão → processo → licitação → item → contrato ainda depende da coleta de processos e do enriquecimento das relações. Pagamentos são contados somente em `financial_movements.phase='payment'`.
