# F3-212/F3-213 — alcance, dependência e recorrência

Implementação atual: `publishedSupplierMarket` consulta os agregados publicados por fornecedor, ano e Casa. A consulta retorna total líquido, número de lançamentos e parlamentares, UFs, partidos, participação dos cinco maiores, fornecedores compartilhados por cinco ou mais parlamentares e fornecedores novos no recorte.

Para os 100 maiores fornecedores por valor, a relação materializada `supplier_parliamentary_clients` agrega o valor líquido por fornecedor e parlamentar. `dependency_share` é a participação do maior parlamentar no total observado daquele fornecedor. Essa métrica é descritiva: não é classificação de risco, influência ou irregularidade.

A recorrência é calculada somente na série histórica publicada: fornecedores observados em um ano, em três ou mais anos e em todos os anos disponíveis. Um fornecedor “novo” significa primeiro ano observado na base coberta, nunca data de abertura empresarial.

A página `/fornecedores-parlamentares` também exibe uma série mensal de até 36 observações disponíveis, agregada por Casa quando filtrada. A série não cria meses futuros nem transforma ausência de publicação em zero; cada ponto traz valor líquido e número de fornecedores observados.

Quando há meses comuns entre o ano selecionado e o anterior, `growth` compara somente essas competências e retorna valores, diferença, taxa e número de meses usados. Sem meses comuns, a variação fica nula e a interface explica a falta de base comparável.

O feed editorial da página é determinístico e limitado a três fatos observáveis: maior concentração encontrada, quantidade de fornecedores compartilhados por cinco ou mais parlamentares e quantidade cujo primeiro ano observado é o recorte atual. Nenhum item usa linguagem de suspeita ou transforma o primeiro registro em data de abertura.

Para os 100 maiores fornecedores, `velocity` percorre a série mensal publicada e registra o primeiro mês observado e os primeiros marcos cumulativos de R$ 100 mil e R$ 500 mil. O cálculo é limitado para proteger o tempo de resposta; marcos não atingidos permanecem nulos.

O mesmo recorte retorna `clients.current`, `clients.previous` e `clients.delta` para os 100 fornecedores líderes, contando parlamentares distintos em anos consecutivos. A variação fica nula quando um dos anos não tem cobertura.

O F3-219 agora possui os dois sentidos de navegação sob demanda: fornecedor → parlamentares e parlamentar → fornecedores. Ambos usam links para os perfis/entidades e limites explícitos, sem renderizar a rede completa.

O agregado `concentration` fecha o total líquido em quatro parcelas: Top 1, Top 5, Top 20 e demais fornecedores. As participações são calculadas sobre o mesmo universo filtrado e permanecem nulas quando o denominador é zero.

F3-214 aceita `year`, `house`, `search`, `category` e `limit`; a busca e a categoria são aplicadas ao universo dos totais e do ranking, enquanto detalhes relacionais permanecem sob demanda. O scatter limita o primeiro payload a 1.000 pontos na página.

O script `scripts/benchmark-supplier-market.ts` mede as consultas do mercado, filtros e explorador sobre o banco local. No corte atual, o explorador ficou em p50 9,4 ms/p95 15,9 ms; o mercado completo ficou em p50 567,9 ms/p95 649,5 ms; o mercado filtrado ficou em p50 295,7 ms/p95 306,6 ms. A migration 36 adiciona índices para links de fornecedor, lançamentos financeiros e busca por nome/CNPJ.

## Desempenho e limites

- A página lê `supplier_global_yearly`/`supplier_global_house_yearly` e não revarre todo o histórico para os KPIs.
- A consulta de dependência é limitada aos 100 maiores fornecedores para manter o payload previsível; fornecedores fora desse conjunto não recebem `dependency_share` no primeiro carregamento.
- O scatter continua limitado a 2.500 pontos e oferece tabela/links como alternativa acessível.
- Estornos permanecem com sinal no valor líquido.
- Ausência de série histórica suficiente mantém a métrica indisponível.

## Validação

Após a materialização da relação cliente, o benchmark local ficou: mercado p50 347,6 ms/p95 436,6 ms/cold 297,6 ms; mercado filtrado p50 335,7 ms/p95 384,7 ms; explorador p50 9,6 ms/p95 16,6 ms. A migration 37 cria `supplier_parliamentary_clients` e seu índice de consulta.

`npm.cmd test` passou com 183 testes; os typechecks de `@senadotracker/web`, `@senadotracker/db` e `@senadotracker/collector` também passaram após a inclusão dos painéis de concentração e recorrência.
