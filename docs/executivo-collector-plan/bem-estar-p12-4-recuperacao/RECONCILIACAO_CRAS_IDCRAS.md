# Reconciliação CRAS × IDCRAS

- CRAS CSV: **8.546** linhas e **8.546** `NU_IDENTIFICADOR` únicos.
- IDCRAS unidade: **8.546** linhas e **8.546** identificadores únicos.
- IDCRAS municipal: **5.571** códigos IBGE7 únicos.
- Entre os 5.333 códigos IBGE7 com CRAS no CSV, os respondentes municipais do IDCRAS coincidem em **5.333/5.333** casos; divergências de contagem: **0**.
- IDCRAS médio não nulo: **5.570** municípios; um município tem média nula e permanece sem valor.

O script oficial `_carregamento.R` faz a junção histórica por `Nº IDENTIFICADOR do CRAS` e `NU_IDENTIFICADOR`. A implementação P12.4-R preserva essa regra e não soma versões de linha. A contagem municipal CRAS é calculada uma vez por identificador/código territorial; a execução não é juntada de forma que multiplique valores.

`Alto Rio Novo/ES` é uma exceção documentada: aparece no arquivo municipal do IDCRAS, mas não no CSV CRAS final. O valor IDCRAS foi preservado porque é fonte oficial; não foi inventado um CRAS para fechar a diferença.
