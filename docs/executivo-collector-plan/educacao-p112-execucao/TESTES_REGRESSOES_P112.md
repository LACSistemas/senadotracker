# Testes e regressões

Executados:

1. `node --import tsx --test tests/unit/educacao-p112.test.ts` — 2/2 PASS.
2. `npm.cmd run typecheck --workspace=@senadotracker/db` — PASS.
3. `npm.cmd run typecheck --workspace=@senadotracker/collector` — PASS.
4. smoke real de leitura (`p112-read-smoke.ts`) no banco oficial — PASS (overview, série, busca IES, busca curso, comparação município/UF/Brasil).
5. `EXPLAIN ANALYZE BUFFERS` dos quatro contratos — PASS; todos abaixo de 4 ms isolados.
6. validação SQL de cobertura — PASS: 0 municípios não resolvidos quando o código source está presente; 0 colisões na chave final.

Não foram executados testes de frontend por escopo explícito. A reconciliação externa com Sinopse está pendente por indisponibilidade do download oficial.
