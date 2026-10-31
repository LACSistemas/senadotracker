# Read models

Migrations `ddl-v36.ts`–`ddl-v39.ts` registram catálogo editorial, snapshot de cobertura e `exec_work_territory_rollup`. O rollup possui linhas Brasil/UF/município e separa `single_municipality_projects`, `multi_territory_projects`, valores alocados e projetos sem localização. A listagem de obras usa consulta set-based sobre localização e projeto; detalhes usam allowlist de colunas.
