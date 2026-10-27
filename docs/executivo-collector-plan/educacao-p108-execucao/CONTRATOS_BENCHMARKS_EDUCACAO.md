# Contratos de benchmarks educacionais

`sameEducationBenchmarkDimension` exige indicador, edição, unidade, rede, etapa, estágio financeiro e universo idênticos. Falta ou supressão permanece `NULL`.

`getEducationMunicipalityBenchmarks` compara município, UF e Brasil para matrícula, internet e Ideb. Ideb usa a mesma rede/etapa e agregados oficiais.

Municípios semelhantes: mesma UF, matrículas entre 0,5× e 2× o alvo, ordenados pela distância absoluta entre logaritmos das matrículas; máximo 20. Não há mínimo garantido, ranking, índice único ou semelhança baseada apenas em proximidade geográfica.

