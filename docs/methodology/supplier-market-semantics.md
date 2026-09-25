# Semântica do mercado de fornecedores

As despesas parlamentares CEAP/CEAPS e a execução institucional são universos independentes. O valor parlamentar é `net_cents - refund_cents`; o valor institucional publicado é a soma com sinal dos movimentos financeiros cujo `phase=payment` e cuja fonte foi aprovada na reconciliação. Contrato, nota fiscal, empenho ou liquidação não são convertidos em pagamento.

Categorias de cota são preservadas com o texto oficial da Casa. Não há agrupamento automático entre categorias do Senado e da Câmara: nomes parecidos não provam equivalência. O painel só agrega categorias dentro do mesmo universo e deixa a Casa explícita.

`primeiro observado` é a primeira competência publicada na série coberta; não é data de abertura da empresa. `novo` e crescimento só podem ser mostrados quando a comparação tem anos/meses equivalentes e cobertura suficiente. Meses futuros e competências não publicadas permanecem ausentes, nunca zero.

Alcance significa parlamentares, UFs, partidos e Casas pagadores observados. Concentração é participação financeira do maior cliente ou do Top N no denominador filtrado; são descrições estatísticas e não classificações de irregularidade.

## Hub unificado `/legislativo/fornecedores`

"Valor observado ligado ao Congresso" é a soma de duas séries publicadas de forma independente — `parliamentary_net_scaled` (despesa líquida de gabinete) e `institutional_paid_scaled` (pagamento institucional comprovado) — nunca um valor único reconciliado. Elas descrevem fatos financeiros diferentes (uma despesa de cota, um pagamento de contrato) que apenas compartilham o mesmo fornecedor, e não há forma correta de decidir que uma parcela de gasto institucional "é a mesma coisa" que uma parcela de despesa parlamentar. Por isso a soma nunca é, e não pretende ser, deduplicada por valor.

A contagem de fornecedores, ao contrário, deduplica por entidade: um fornecedor com as duas dimensões observadas conta uma vez em `suppliersLinked`, porque a pergunta ali é "quantas entidades distintas", não "quanto dinheiro". A lente (`tudo`/`parlamentar`/`institucional`) nunca dispara uma nova consulta — ela seleciona, entre os campos já calculados numa única leitura por Casa/ano, quais exibir; isso vale para os quatro KPIs e a série mensal por Casa.

### Distribuição por categoria (seção "Como os pagamentos se distribuem")

Esta seção não segue a lente: representa sempre o universo único de pagamentos observados (parlamentar + institucional, nas Casas do filtro ativo), publicado por `publishedCongressSupplierCategoryMix`. Cada linha é a tripla (universo, Casa, categoria oficial da fonte) — parlamentar usa a categoria oficial de cota; institucional usa `expense_nature_key`/`expense_nature_raw` do movimento de pagamento (`financial_movements.phase='payment'`), nunca a categoria de cota. Categorias nunca são fundidas entre Câmara e Senado nem entre universos, mesmo com nomes parecidos (ex.: "Telefonia" parlamentar e uma categoria institucional semanticamente próxima permanecem linhas distintas) — não existe camada de consolidação editorial.

Pagamento institucional sem `expense_nature_key`/`expense_nature_raw` publicado entra como "Sem classificação disponível" (uma linha por Casa), nunca distribuído entre as demais categorias e nunca omitido. Como a coleta de classificação institucional roda periodicamente, o tamanho dessa linha cai com o tempo à medida que a fonte publica mais pagamentos classificados — sem qualquer mudança de código. A soma de (categorias exibidas no Top 6) + Outros + Sem classificação disponível reconcilia exatamente com o total do universo filtrado. A barra de cada linha é proporcional ao maior item do ranking, não ao percentual do total — por isso, hoje, com a maior parte do pagamento institucional ainda sem classificação, as categorias parlamentares aparecem como barras curtas mesmo tendo percentual pequeno mas não desprezível.
