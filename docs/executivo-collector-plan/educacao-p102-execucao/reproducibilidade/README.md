# Reprodutibilidade · P10.2

Pré-requisitos: RAW do Censo em `D:\Civica\raw\inep\censo_escolar\AAAA\` (hashes no manifesto), Python com PyMuPDF (só para os PDFs), `EXEC_DATABASE_URL` apontando para o banco alvo (use cópia restaurada de backup para ensaios).

Ordem:
1. Investigação: `headers_all.py`, `identidades*.py`, `particao_exata.py`, `cobertura_colunas.py`, `dic_vars.py`, `pdf_text.py`, `grep_ctx.py` (saídas em `../evidencias/`).
2. Sinopse de referência: `sinopse_tabela.py`, `sinopse_batch2.sh` (tabelas 1.1, 1.2, 4.1, 4.2 por ano).
3. Publicação: `p102_producao.sh` (migration v10, `oferta-extract`, `oferta-publish all`, `register-docs`, `measure`) via `scripts/exec/educacao-pilot.ts`.
4. Verificação: `reconcilia_oferta.py`, `gera_reconciliacoes_p102.py`, `checks_tsv.py`; `scripts/exec/educacao-oferta-report.ts`, `-bench.ts`, `-numeros.ts`, `-g11.ts`.
5. Testes: `npm test` (inclui os dois arquivos da P10.2).

Python sempre com `-I -X utf8`. Reexecutar a publicação é idempotente (`NO_CHANGE`). Sem commit e sem push.
