# Contratos dos read models

## Contrato de observação

`WellbeingObservation` contém `indicatorCode`, `indicatorId`, `label`, `territory`, `value`, `unit`, `measureType`, `periodStart`, `periodEnd`, `frequency`, `source`, `dataset`, `release`, `sourceUrl`, `methodVersion`, `universe`, `numerator`, `denominator`, `coverageStatus`, `dataThrough`, `sourcePublishedAt`, `ingestedAt`, `publicationId`, `revision`, `isComparable`, `comparisonRejectionReason` e `flags`.

## Contratos de consulta

- `getWellbeingOverview(pool, territoryRef)` retorna território, 27 observações, capítulos, cobertura local e contexto financeiro.
- `getWellbeingChapter(pool, territoryRef, chapter)` retorna o overview com `observations` restritas ao capítulo.
- `getWellbeingSeries(pool, territoryRef, indicatorCode)` retorna a série ativa ordenada por período.
- `getWellbeingComparators(pool, territoryRef, indicatorCode)` retorna município/UF/Brasil com elegibilidade, valor, período, denominador, fonte e motivos de rejeição.
- `getWellbeingCoverage(pool, indicatorCode?, entityId?, period?)` retorna universo esperado, observado, válido, nulos, percentual e status.
- `getWellbeingMethodology(pool, indicatorCode)` retorna unidade, frequência, denominadores, semântica de nulo, fonte e permissões de agregação/ranking.
- `getWellbeingFinanceContext(pool, territoryRef, year?)` retorna EMP/LIQ/PAG da função 08, em centavos e BRL.

## Regras invariantes

1. Somente `exec_publication.state=1` é servido.
2. A revisão ativa é identificada por `run_id`; o join de detalhe usa o mesmo `run_id`.
3. Falha de refresh preserva a publicação anterior.
4. `NULL`, ausência de publicação e cobertura parcial são estados distintos de zero.
5. Caged mensal e RAIS anual não são combinados em uma taxa implícita.
6. Comparações são descritivas, nunca ranking automático.
