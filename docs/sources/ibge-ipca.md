# IBGE — IPCA (número-índice)

Série mensal do número-índice do IPCA, agregado 1737 / variável 2266 do SIDRA, base dezembro de 1993 = 100. Coletada por `collect-price-index --index ipca`, que guarda a resposta bruta como evidência e publica um lote próprio.

- **Número-índice, não variação mensal.** Deflacionar entre dois meses quaisquer é o quociente de dois índices. Acumular doze taxas mensais por ano introduziria arredondamento a cada passo e daria resultados diferentes conforme o caminho percorrido.
- **Inteiro escalado por 10.000** em `price_index_values.index_scaled`, pela mesma disciplina que mantém dinheiro em centavos: dado publicado não passa por ponto flutuante. O fator de correção é uma razão entre dois inteiros, e só o resultado final volta a centavos, arredondado uma vez.
- **Mês ausente não é estimado.** `publishedPriceIndex` devolve `null` quando o mês pedido não está no lote ativo, e `publishedDeflator` devolve `null` se qualquer uma das duas pontas faltar. Nunca cai no mês mais próximo nem no mais recente — a regra de que séries não são completadas com o valor corrente vale aqui como vale para os valores normativos.
- **Valores "...", "-" e períodos malformados** da resposta do SIDRA são descartados em vez de virarem zero.

O índice não é um valor monetário: é adimensional e não tem base legal, por isso vive em tabela própria e não em `normative_values`, cujo schema exige `value_cents`, `unit`, `legal_basis` e `official_url` para cada linha.

Uso atual: a página de variação patrimonial oferece comparar os dois pleitos em valores nominais ou corrigidos, tomando como meses de referência as datas das próprias eleições registradas nas candidaturas. Quando o índice de qualquer um dos dois meses não está publicado, a opção de correção fica desabilitada com a razão, em vez de exibir um valor estimado.
