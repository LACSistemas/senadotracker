# Fontes ANA/SNISB validadas

Endpoint oficial ArcGIS FeatureServer: https://www.snirh.gov.br/arcgis/rest/services/IG/SNISB/FeatureServer/0. O metadata retornou camada pontual, objectId `BAR_CD_SNISB`, paginação e 28.836 registros. A coleta final usou `returnIdsOnly + objectIds` em 58 páginas; uma tentativa anterior por offset parou em 18.000 e foi descartada. Foram publicados 28.835 registros após deduplicação determinística por `BAR_CD_SNISB`.

Metadata SHA-256: d4abba997baf3e9f6d737161f66e6f21b57bdcebf05a1a999c7388b62802dd4a.
