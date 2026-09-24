# F3-227 — reconciliação do mercado de fornecedores

Executado com `node --import tsx scripts/reconcile-supplier-market.ts` sobre o banco publicado.

| Verificação | Resultado |
| --- | ---: |
| Revisão ativa | `e8c4e040-6a19-41c7-b195-0c89b1578d3c` |
| Ano | 2026 |
| Total global parlamentar | R$ 110.106.173,44 |
| Soma Câmara + Senado | R$ 110.106.173,44 |
| Diferença | R$ 0,00 |
| Fornecedores anuais observados | 16.979 |
| Links de despesas confirmados | 224.865 |

O verificador falha se a soma global não coincidir com a soma por Casa ou se o total global for negativo. Valores institucionais continuam em tabelas e semântica próprias; não são somados silenciosamente ao total parlamentar.
