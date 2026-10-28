# Contratos read models P11.2

| função | contrato |
|---|---|
| `getHigherEducationTerritoryOverview` | indicadores de um território/ano, com valores nulos preservados |
| `getHigherEducationSeries` | série 2022–2024 do serving compacto |
| `searchHigherEducationIes` | IES por nome/UF/ano, paginação limitada a 100 |
| `searchHigherEducationCourses` | cursos por IES/município/nome, paginação limitada a 100 |
| `getHigherEducationComparison` | município × UF × Brasil, descritivo, com ressalvas EAD |

O cliente não acessa fonte externa nem PostgreSQL diretamente; estes contratos recebem um objeto compatível com `Pool` no backend.
