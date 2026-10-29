# Auditoria do catálogo P12.2

## Achado

O catálogo `bem-estar-p12-2-ibge/CATALOGO_INDICADORES_CORRIGIDO.csv` tinha nove registros com 17 campos em vez dos 18 do contrato. A ausência era a coluna `universe`, deslocando as colunas seguintes. Os IDs afetados foram:

`WB-LABOR-RAIS-STOCK`, `WB-LABOR-CAGED-ADM`, `WB-LABOR-CAGED-DIS`, `WB-LABOR-CAGED-BAL`, `WB-SOCIAL-CADUNICO-FAM`, `WB-SOCIAL-CADUNICO-UPDATE`, `WB-SOCIAL-PBF-FAM`, `WB-SUAS-CRAS`, `WB-SUAS-CREAS`.

## Correção

Os nove universos foram preenchidos com a semântica source-native documentada. O catálogo corrigido agora tem cabeçalho com 18 colunas, 20 indicadores e 20/20 linhas com largura 18. Foram preservados os seis IDs IBGE e seus valores; não houve escrita no banco nesta fase.

## Divergência histórica

O `P122_RESULTS.json` registrou PASS estrutural, mas a inspeção reproduzível encontrou a falha de largura. Este artefato supersede apenas essa afirmação estrutural; não reabre nem altera os fatos P12.2.
