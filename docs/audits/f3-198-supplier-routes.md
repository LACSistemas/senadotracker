# F3-198 — auditoria das rotas de fornecedores

Auditoria executada em 24/09/2026 sobre o banco de referência e o código atual.

## Rotas existentes

- `/legislativo/fornecedores`: radar parlamentar por CNPJ; filtros `casa`, `ano`, `busca` e `pagina`.
- `/legislativo/fornecedores/[documento]`: detalhe parlamentar invertido, acessado também pela página de gastos do parlamentar.
- `publishedSupplierRadar`: agrupa diretamente `expenses` e só pagina depois de materializar todo o resultado em JavaScript.
- `publishedSupplierDetail`: carrega todos os lançamentos do CNPJ no ano e agrega pessoas, UFs, partidos, categorias, Casas e meses em JavaScript.

Os links existentes serão preservados como aliases para o detalhe global. A arquitetura alvo usa `/fornecedores` para pagamentos institucionais, `/fornecedores/explorar` para busca global e `/fornecedores-parlamentares` para o mercado CEAP/CEAPS.

## Medição inicial

No recorte 2026, a consulta do radar levou **1,347 s** e produziu 16.985 grupos antes de devolver apenas 25 linhas. O plano usa temporários para `GROUP BY`, dois `count(distinct)` e ordenação. Busca, paginação e total não acontecem no banco sobre um agregado compacto. O detalhe também lê todos os lançamentos antes da paginação.

## Decisões

- manter universo institucional e parlamentar separados;
- usar a entidade global `suppliers` e identificadores fortes;
- publicar agregados por revisão e trocar a revisão ativa atomicamente;
- paginação, busca e ordenação no SQL;
- detalhes e séries sob demanda;
- nenhuma rota inicial serializa contratos, movimentos ou lançamentos completos;
- preservar as URLs antigas por alias ou redirecionamento;
- medir novamente após os agregados, usando o mesmo banco.
