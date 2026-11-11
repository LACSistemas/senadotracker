# Modelo e serving

O modelo separa indicadores, fatos financeiros, agregados de folha e cobertura. A revisão é imutável por snapshot; a publicação ativa aponta para p145-finance-20261104. Métodos de leitura: getJudiciaryFinancialOverview, getJudiciaryAnnualExpenses, getJudiciaryFinancialHistory, getJudiciaryBudgetExecution, getJudiciaryPersonnelCostOverview, getJudiciaryPayrollAggregate, getJudiciaryFinancialCoverage, getJudiciaryFinancialMethodology.

Não há acesso direto do frontend à fonte nem ao PostgreSQL; P14.5 não altera frontend.
