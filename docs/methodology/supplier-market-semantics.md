# Semântica do mercado de fornecedores

As despesas parlamentares CEAP/CEAPS e a execução institucional são universos independentes. O valor parlamentar é `net_cents - refund_cents`; o valor institucional publicado é a soma com sinal dos movimentos financeiros cujo `phase=payment` e cuja fonte foi aprovada na reconciliação. Contrato, nota fiscal, empenho ou liquidação não são convertidos em pagamento.

Categorias de cota são preservadas com o texto oficial da Casa. Não há agrupamento automático entre categorias do Senado e da Câmara: nomes parecidos não provam equivalência. O painel só agrega categorias dentro do mesmo universo e deixa a Casa explícita.

`primeiro observado` é a primeira competência publicada na série coberta; não é data de abertura da empresa. `novo` e crescimento só podem ser mostrados quando a comparação tem anos/meses equivalentes e cobertura suficiente. Meses futuros e competências não publicadas permanecem ausentes, nunca zero.

Alcance significa parlamentares, UFs, partidos e Casas pagadores observados. Concentração é participação financeira do maior cliente ou do Top N no denominador filtrado; são descrições estatísticas e não classificações de irregularidade.

## Hub unificado `/legislativo/fornecedores`

"Valor observado ligado ao Congresso" é a soma de duas séries publicadas de forma independente — `parliamentary_net_scaled` (despesa líquida de gabinete) e `institutional_paid_scaled` (pagamento institucional comprovado) — nunca um valor único reconciliado. Elas descrevem fatos financeiros diferentes (uma despesa de cota, um pagamento de contrato) que apenas compartilham o mesmo fornecedor, e não há forma correta de decidir que uma parcela de gasto institucional "é a mesma coisa" que uma parcela de despesa parlamentar. Por isso a soma nunca é, e não pretende ser, deduplicada por valor.

A contagem de fornecedores, ao contrário, deduplica por entidade: um fornecedor com as duas dimensões observadas conta uma vez em `suppliersLinked`, porque a pergunta ali é "quantas entidades distintas", não "quanto dinheiro". A lente (`tudo`/`parlamentar`/`institucional`) nunca dispara uma nova consulta — ela seleciona, entre os campos já calculados numa única leitura por Casa/ano, quais exibir; isso vale para os quatro KPIs, a distribuição por categoria e a série mensal por Casa.
