# P13.5-R2 — modelo compacto e publicação nacional

## Resultado

`P13_5R2_STATUS=PASS_WITH_CAVEATS`.

O staging nacional existente foi reutilizado sem nova coleta. A migration v28 criou um serving compacto isolado do v27: IDs internos inteiros, dicionários para valores repetidos, relação municipal deduplicada e somente campos necessários ao serving. O snapshot nacional foi publicado no `projetoeleitor_db` como revisão compacta `revision_id=1`, dataset 145, run 38142.

O crescimento real, medido no PostgreSQL, foi `109.854.720` bytes, dentro dos `199.557.632` bytes disponíveis. O replay do mesmo snapshot retornou `NO_CHANGE`. O piloto v27 (dataset 143/run 38141) não foi apagado nem convertido.

Ressalva: estudos de viabilidade permanecem somente no staging D: (`PRODUCT_G=STAGED_NOT_PUBLISHED`), pois não são necessários para o catálogo territorial atual. Descrições extensas e geometria detalhada também permanecem preservadas no staging, enquanto o serving mantém a relação oficial projeto–município.
