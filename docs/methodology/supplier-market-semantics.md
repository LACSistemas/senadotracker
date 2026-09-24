# Semântica do mercado de fornecedores

As despesas parlamentares CEAP/CEAPS e a execução institucional são universos independentes. O valor parlamentar é `net_cents - refund_cents`; o valor institucional publicado é a soma com sinal dos movimentos financeiros cujo `phase=payment` e cuja fonte foi aprovada na reconciliação. Contrato, nota fiscal, empenho ou liquidação não são convertidos em pagamento.

Categorias de cota são preservadas com o texto oficial da Casa. Não há agrupamento automático entre categorias do Senado e da Câmara: nomes parecidos não provam equivalência. O painel só agrega categorias dentro do mesmo universo e deixa a Casa explícita.

`primeiro observado` é a primeira competência publicada na série coberta; não é data de abertura da empresa. `novo` e crescimento só podem ser mostrados quando a comparação tem anos/meses equivalentes e cobertura suficiente. Meses futuros e competências não publicadas permanecem ausentes, nunca zero.

Alcance significa parlamentares, UFs, partidos e Casas pagadores observados. Concentração é participação financeira do maior cliente ou do Top N no denominador filtrado; são descrições estatísticas e não classificações de irregularidade.
