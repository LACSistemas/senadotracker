# Contratos estatísticos — RAIS e Novo Caged

## RAIS

`WB-LABOR-RAIS-STOCK` mede vínculos formais ativos em 31 de dezembro, por localização do estabelecimento. É contagem de vínculos, não de pessoas, moradores empregados ou ocupações totais. O indicador tem frequência anual e os períodos 2023, 2024 e 2025 são comparáveis dentro da edição de tabelas RAIS 2025.

`WB-LABOR-RAIS-REMUNERATION-MEAN-DEC` é a remuneração média real de dezembro publicada no recorte Brasil/UF. Não é mediana, salário de admissão nem média municipal calculada. Ausência de linha permanece ausente; nenhum zero foi imputado.

## Novo Caged

`WB-LABOR-CAGED-ADM`, `...-DIS` e `...-BAL` são movimentações mensais ajustadas da mesma competência e universo. A identidade é `saldo = admissões - desligamentos`; foi verificada em 44.792 combinações entidade×mês.

`WB-LABOR-CAGED-STOCK` é o estoque mensal de referência publicado pelo MTE. Não é obtido somando saldos ao estoque RAIS e não deve ser interpretado como estoque de pessoas residentes.

## Cobertura e comparação

Todos os seis indicadores usam `exec_entity`: município (`kind=4`), UF (`kind=3`) e Brasil (`kind=1`). Comparações devem respeitar família, período e método de ajuste. Não há ranking permitido, taxa de desemprego, PEA estimada ou agregação simples de remunerações.

## Revisão

Uma nova edição/competência produz nova impressão de fonte e nova revisão candidata. A publicação é por fatia UF×período, com `source_hash`; replay inalterado retorna `NO_CHANGE`. Revisões posteriores não são somadas como novos movimentos e o last-known-good permanece ativo até validação.
