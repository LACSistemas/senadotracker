# Modelo de dados e serving— P14.2

A P14.2 estende `civica_jud` com `jud_jn_indicator`, `jud_jn_crosswalk`, `jud_jn_observation` e `jud_jn_parity_check`. O modelo é normalizado: não há uma coluna para cada variável nem fatos processuais. Cada observação guarda indicador, tribunal canônico, ano, edição, valor, numerador/denominador quando comprovados, unidade, cobertura, comparabilidade, snapshot, revisão e hash da linha.

Serviços exportados em `packages/db/src/postgres-judiciary-statistics.ts`: overview, catálogo, estatística de tribunal/ano, série histórica, estatística por ramo, comparadores, cobertura e metodologia. Nenhum serviço consulta o CNJ durante SSR e nenhuma página foi criada.

Agregação: contagens, pessoal e despesas são somáveis apenas no universo declarado; taxas não são somadas nem transformadas em média nacional; tempos permanecem descritivos. Município não é dimensão de estatística JN.
