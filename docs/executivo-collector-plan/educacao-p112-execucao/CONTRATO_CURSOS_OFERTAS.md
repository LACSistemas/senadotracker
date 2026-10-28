# Contrato de cursos e ofertas

## Entidades

- `exec_edu_higher_course`: identidade `CO_CURSO`, nome e classificações CINE/grau/nível, com primeiro/último ano.
- `exec_edu_higher_offer_year`: fato anual por IES/curso/local/modalidade/dimensão. Métricas são `bigint` e podem ser nulas.
- `exec_edu_higher_territory_year`: serving compacto por Brasil (`scope=1`), UF (`scope=3`) e município (`scope=4`).

## Regras

`QT_MAT`, `QT_ING` e `QT_CONC` são, respectivamente, matrículas, ingressantes e concluintes do Censo. Não são pessoas deduplicadas longitudinalmente. `TP_DIMENSAO` não é descartada. Município zero/nulo não é transformado em sede da IES. Dimensões 3/4 entram apenas no agregado Brasil quando não há geografia observável.

## Leitura

`getHigherEducationTerritoryOverview`, `getHigherEducationSeries`, `searchHigherEducationIes`, `searchHigherEducationCourses` e `getHigherEducationComparison` estão em `packages/db/src/exec/educacao-superior-read.ts`. Comparações são explicitamente descritivas e preservam `null`.
