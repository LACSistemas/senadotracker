# Contratos TypeScript

Implementação: `packages/db/src/exec/infrastructure-read.ts`; exportação: `packages/db/src/exec/index.ts`. Serviços: `getInfrastructureOverview`, `getInfrastructureEditorialKpis`, `getInfrastructureFamilies`, `getInfrastructureIndicators`, `getInfrastructureIndicatorDetail`, `getInfrastructureIndicatorComparison`, `getInfrastructureCoverage`, `getInfrastructureFreshness`, `getInfrastructureWorksOverview`, `getInfrastructureWorksList`, `getInfrastructureWorkDetail`, `getInfrastructureWorkFinancialEvidence`, `getInfrastructureFacilities`, `getInfrastructureLogistics`, `getInfrastructureEnergy`, `getInfrastructureUrbanConditions`, `getInfrastructureHousing` e `getInfrastructureWaterSecurity`.

Todos recebem `Pool` e parâmetros tipados; paginação é server-side; nenhum serviço chama fonte externa.
