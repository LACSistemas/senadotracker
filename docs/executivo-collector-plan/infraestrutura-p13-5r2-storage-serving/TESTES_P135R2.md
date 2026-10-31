# Testes

- Banco guard: PASS (`projetoeleitor_db`).
- Snapshot staging reutilizado: PASS.
- Migration v28: PASS; v27/piloto preservados.
- Catálogo nacional: PASS, 155.037 IDs únicos.
- Localização: PASS, 240.004 vínculos e zero órfãos.
- Relações físicas/financeiras/históricas: PASS por chave oficial.
- Orçamento: PASS; crescimento real 109.854.720 bytes, saldo 89.702.912.
- Replay: PASS/NO_CHANGE.
- EXPLAIN ANALYZE BUFFERS: PASS.
- P13.1–P13.4, saúde, educação, segurança, bem-estar, Siconfi e PNCP: somente leitura; não reiniciados.
- Frontend: não alterado.
