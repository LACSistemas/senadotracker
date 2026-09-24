# F3-200 — agregados publicados de fornecedores

Os agregados são publicados em uma revisão imutável e a troca de `active_supplier_aggregate_revision` ocorre na mesma transação. Duas publicações consecutivas produziram as mesmas contagens, sem duplicatas nas chaves compostas.

Revisão ativa em 24/09/2026: `e8c4e040-6a19-41c7-b195-0c89b1578d3c`.

| Agregado | Linhas |
| --- | ---: |
| fornecedor/ano/Casa parlamentar | 38.564 |
| fornecedor/ano/Congresso parlamentar | 36.005 |
| fornecedor/mês/Casa parlamentar | 108.013 |
| fornecedor/categoria/Casa parlamentar | 39.136 |
| fornecedor/ano/Casa institucional | 8 |
| fornecedor/ano global | 36.013 |
| fornecedor/ano/Casa global | 38.572 |

A consulta direta do ranking parlamentar do Congresso usa `supplier_parliamentary_congress_filter`, sem B-tree temporária: 1,73 ms a frio e 0,30–0,36 ms quente para 50 linhas. O explorador global completo, incluindo contagem, identidade pública e aliases da página, mediu 23,7 ms sem busca e 9,2 ms no recorte Senado. Busca prefixada por nome/CNPJ mediu 96–98 ms no banco de referência.

Os campos `parliamentary_net_scaled` e `institutional_paid_scaled` permanecem separados. O agregado institucional usa somente movimentos de pagamento das fontes financeiras aprovadas; contrato, cobrança, empenho e liquidação não alimentam esse campo.
