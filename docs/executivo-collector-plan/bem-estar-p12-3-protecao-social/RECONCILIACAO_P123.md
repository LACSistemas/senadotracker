# Reconciliação P12.3

Não há reconciliação financeira/social publicada porque as três fontes de fatos não passaram a barreira de aquisição segura. `SOURCE_ROWS = 0`, `PARSED_ROWS = 0`, `PUBLISHED_ROWS = 0` para CadÚnico, Bolsa Família e BPC.

O único recurso ingerido foi o crosswalk SIAFI→IBGE, que não contém benefícios nem pessoas. Ele passou 5.589/5.589 linhas com cinco campos. As 19 colisões de código IBGE foram preservadas como relação source-native; não foram somadas como fatos.

Não há total indicado, aprovado, pago ou benefício para comparar. Portanto, `AMOUNT_PARITY = NOT_APPLICABLE`, e não zero. Não houve risco de dupla contagem ou publicação parcial.
