# Versionamento, replay e last-known-good

A revisão p147r-theme-metadata-20261105-v2 tem row_count=0: é uma revisão de semântica, não uma nova coleta. Seu provenance contém factRevisionId=p146-jn-themes-20261105. Os IDs P146 permanecem como aliases de compatibilidade porque a identidade do fato (variável oficial + chave tribunal/ano) não mudou; a taxonomia pública é determinada por provenance.semanticTheme.

O replay do mesmo semantic hash retornou UNCHANGED_REPLAY; não houve inserções de observações. A revisão P14.6 permanece ativa como last-known-good dos fatos históricos, e a revisão metadata é a única ativa para o catálogo/serving. Rollback consiste em desativar a revisão metadata e reativar a anterior, sem apagar fatos.