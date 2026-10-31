# Crosswalk conjunto de unidades consumidoras ↔ município

`indqual-municipio.csv` foi validado com 42.699 linhas, 5.574 códigos municipais, 15.162 conjuntos e 28 siglas UF. A chave `(CodMunicipio, IdeConjUnidConsumidoras)` não tem duplicatas.

O relacionamento é muitos-para-muitos: 6.135 conjuntos aparecem em mais de um município e 5.560 municípios aparecem em mais de um conjunto. O arquivo não oferece número de consumidores, participação, energia, pesos ou fórmula de rateio. Portanto é um crosswalk de pertencimento, não uma tabela de ponderação.

Conclusão: `MUNICIPAL_DEC_FEC_ELIGIBLE = NO` nesta fase. O crosswalk fica disponível para futura publicação source-native ou para uma metodologia oficial posterior.
