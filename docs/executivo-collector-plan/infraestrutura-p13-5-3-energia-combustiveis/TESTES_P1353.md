# Testes P13.5.3

**Data:** 2026-10-31  
**Banco:** `projetoeleitor_db`  
**RAW:** `D:\Civica\raw\infraestrutura\energia_expandida`  

- DATABASE_GUARD: PASS (`projetoeleitor_db`).
- Migration v30/v31/v32/v33: PASS.
- Typecheck `@senadotracker/db`: PASS.
- MMGD, tarifas, postos e GLP: publicação transacional PASS.
- Replay 2: todos `NO_CHANGE`, crescimento 0 bytes, sem inserções duplicadas observadas.
- EXPLAIN ANALYZE MMGD por município: índice PK, 0,190 ms.
- RAW somente em D: PASS; frontend não alterado; PNCP não interrompido.
- Preços: bloqueados; gasodutos: não avaliados.
